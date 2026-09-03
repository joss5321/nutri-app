/**
 * match-exercise-gifs — Edge Function (v3: manual UTF-8 decode)
 *
 * Mapea los ejercicios de WorkoutX al dataset gratuito ExerciseGymGifsDB
 * (jsDelivr CDN) usando índice invertido de palabras. Sin API keys externas.
 *
 * Params:
 *   startOffset   — reanudar desde este índice (default: 0)
 *   batchSize     — ejercicios a procesar por invocación (default: 300, max: 400)
 *   dryRun        — calcular sin actualizar BD (default: false)
 *   minSimilarity — umbral Jaccard mínimo (default: 0.50)
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { requireSuperadmin } from "../_shared/auth.ts";

const GIF_DB_URL =
  "https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/exercises.json";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Decodifica mojibake carácter a carácter (sin TextDecoder) ──────────────
// "ExtensiÃ³n" → "Extensión",  "TrÃ­ceps" → "Tríceps"
// Funciona porque: U+00C3 (Ã) es el byte 0xC3, que en UTF-8 inicia secuencias
// de 2 bytes. Si el char siguiente es un byte de continuación (0x80–0xBF),
// decodificamos ambos como un único carácter Unicode.
function decodeMojibake(text: string): string {
  // Char code 0x00C3 = 195 = 'Ã'. Si no está en el texto, nada que hacer.
  let hasC3 = false;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0x00C3) { hasC3 = true; break; }
  }
  if (!hasC3) return text;

  let result = "";
  let i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    // U+00C3 seguido de un byte de continuación UTF-8 → decodificar
    if (code === 0x00C3 && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0x80 && next <= 0xBF) {
        // Aritmética UTF-8 de 2 bytes: 110xxxxx 10xxxxxx → codepoint
        const codePoint = ((0xC3 & 0x1F) << 6) | (next & 0x3F);
        result += String.fromCodePoint(codePoint);
        i += 2;
        continue;
      }
    }
    result += text[i];
    i++;
  }
  return result;
}

// ── Normalización ──────────────────────────────────────────────────────────
function normalize(text: string): string {
  return decodeMojibake(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar diacríticos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Palabras significativas (>2 chars para ignorar artículos/preposiciones)
function significantWords(text: string): string[] {
  return normalize(text).split(" ").filter((w) => w.length > 2);
}

// Jaccard similarity sobre sets de palabras
function jaccard(wordsA: Set<string>, wordsB: Set<string>): number {
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  return intersection / (wordsA.size + wordsB.size - intersection);
}

// Actualizar BD en lotes paralelos con concurrencia limitada
async function batchUpdate(
  supabase: SupabaseClient,
  updates: { id: string; gif_url: string | null }[],
  concurrency = 40,
): Promise<number> {
  let done = 0;
  for (let i = 0; i < updates.length; i += concurrency) {
    const chunk = updates.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(({ id, gif_url }) =>
        supabase.from("ejercicios").update({ gif_url }).eq("id", id)
      ),
    );
    done += chunk.length;
  }
  return done;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Herramienta manual/interna: solo superadmin puede dispararla. Nunca se
  // usa service_role para decidir esto — requireSuperadmin usa un cliente
  // anon+Authorization reenviado.
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.response;

  const reqUrl    = new URL(req.url);
  const startOff  = Math.max(0, parseInt(reqUrl.searchParams.get("startOffset") ?? "0", 10));
  const batchSize = Math.min(400, Math.max(1, parseInt(reqUrl.searchParams.get("batchSize") ?? "300", 10)));
  const dryRun    = reqUrl.searchParams.get("dryRun") === "true";
  const minSim    = parseFloat(reqUrl.searchParams.get("minSimilarity") ?? "0.50");

  console.log(`[match-gifs] startOffset=${startOff} batchSize=${batchSize} dryRun=${dryRun} minSim=${minSim}`);

  // ── 1. Descargar ExerciseGymGifsDB ─────────────────────────────────────
  const gifRes = await fetch(GIF_DB_URL);
  if (!gifRes.ok) {
    return new Response(
      JSON.stringify({ error: `HTTP ${gifRes.status} al descargar ExerciseGymGifsDB` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { exercises: gifDb }: {
    exercises: { id: string; name: string; gifUrl: string; muscle: string }[]
  } = await gifRes.json();

  console.log(`[match-gifs] ${gifDb.length} ejercicios en ExerciseGymGifsDB`);

  // ── 2. Pre-computar índices ─────────────────────────────────────────────
  type GifEntry = { normName: string; words: Set<string>; gifUrl: string; idx: number };
  const gifEntries: GifEntry[] = gifDb.map((ex, idx) => ({
    normName: normalize(ex.name),
    words:    new Set(significantWords(ex.name)),
    gifUrl:   ex.gifUrl,
    idx,
  }));

  const exactMap = new Map<string, string>(
    gifEntries.map((e) => [e.normName, e.gifUrl]),
  );

  const invertedIndex = new Map<string, number[]>();
  for (const entry of gifEntries) {
    for (const word of entry.words) {
      if (!invertedIndex.has(word)) invertedIndex.set(word, []);
      invertedIndex.get(word)!.push(entry.idx);
    }
  }

  // ── 3. Cargar ejercicios WorkoutX del lote ─────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rows, error: dbErr } = await supabase
    .from("ejercicios")
    .select("id, nombre, gif_url")
    .eq("source", "workoutx")
    .order("external_id", { ascending: true })
    .range(startOff, startOff + batchSize - 1);

  if (dbErr) {
    return new Response(
      JSON.stringify({ error: dbErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const exercises = rows ?? [];
  console.log(`[match-gifs] ${exercises.length} ejercicios en lote (offset=${startOff})`);

  const stats = {
    processed: exercises.length,
    startOffset: startOff,
    matched: 0,
    no_match: 0,
    skipped: 0,
    sample_no_match: [] as string[],
    sample_matched: [] as string[],
  };

  const updates: { id: string; gif_url: string | null }[] = [];

  // ── 4. Matching ─────────────────────────────────────────────────────────
  for (const ex of exercises) {
    const gifUrl = ex.gif_url as string | null;

    if (gifUrl?.includes("supabase.co/storage")) { stats.skipped++; continue; }
    if (gifUrl?.includes("jsdelivr.net"))         { stats.skipped++; continue; }
    // gif_url null (fallo previo) o workoutxapp.com → reintentar

    const nombreRaw    = ex.nombre as string;
    const nombreFixed  = decodeMojibake(nombreRaw);
    const normNombre   = normalize(nombreFixed);

    // a) Exact match
    if (exactMap.has(normNombre)) {
      updates.push({ id: ex.id, gif_url: exactMap.get(normNombre)! });
      stats.matched++;
      if (stats.sample_matched.length < 5) {
        stats.sample_matched.push(`"${nombreFixed}" → exact`);
      }
      continue;
    }

    // b) Fuzzy via inverted index
    const dbWords = new Set(significantWords(nombreFixed));
    const candidateCount = new Map<number, number>();

    for (const word of dbWords) {
      for (const idx of (invertedIndex.get(word) ?? [])) {
        candidateCount.set(idx, (candidateCount.get(idx) ?? 0) + 1);
      }
    }

    const topCandidates = [...candidateCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([idx]) => gifEntries[idx]);

    let bestSim = 0;
    let bestGif: string | null = null;

    for (const cand of topCandidates) {
      const sim = jaccard(dbWords, cand.words);
      if (sim > bestSim) { bestSim = sim; bestGif = cand.gifUrl; }
    }

    if (bestSim >= minSim) {
      updates.push({ id: ex.id, gif_url: bestGif });
      stats.matched++;
      if (stats.sample_matched.length < 5) {
        stats.sample_matched.push(`"${nombreFixed}" → fuzzy(${bestSim.toFixed(2)})`);
      }
    } else {
      updates.push({ id: ex.id, gif_url: null });
      stats.no_match++;
      if (stats.sample_no_match.length < 20) {
        stats.sample_no_match.push(
          `"${nombreFixed}" (raw="${nombreRaw}", best=${bestSim.toFixed(2)})`,
        );
      }
    }
  }

  console.log(`[match-gifs] matched=${stats.matched} no_match=${stats.no_match} skipped=${stats.skipped}`);

  // ── 5. Actualizar BD ─────────────────────────────────────────────────────
  if (!dryRun && updates.length > 0) {
    const updated = await batchUpdate(supabase, updates);
    console.log(`[match-gifs] ${updated} filas actualizadas`);
  } else if (dryRun) {
    console.log("[match-gifs] dryRun=true — BD no modificada");
  }

  return new Response(JSON.stringify({ ...stats, dryRun }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(handler);
