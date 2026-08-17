/**
 * import-workoutx — Edge Function
 *
 * Importa el catálogo de WorkoutX a la tabla `ejercicios` de Supabase.
 * Diseñada para ejecución manual (no se activa sola al arrancar la app).
 *
 * Idioma: todos los requests incluyen lang=es (parámetro oficial de WorkoutX).
 * Traduce: nombre, instrucciones, bodyPart, equipment, target, category.
 * Fallback: inglés para ejercicios sin traducción disponible en WorkoutX.
 *
 * Variables de entorno requeridas (Supabase Secrets):
 *   WORKOUTX_API_KEY    — clave privada de WorkoutX (nunca exponer al frontend)
 *   WORKOUTX_BASE_URL   — URL base de la API (default: https://api.workoutxapp.com)
 *   WORKOUTX_PAGE_SIZE  — ejercicios por página (default: 10)
 *   ANTHROPIC_API_KEY   — clave de Anthropic (solo necesaria si translate=true)
 *
 * Query params opcionales:
 *   startOffset — reanudar desde este offset (default: 0). No borra lo ya importado.
 *   maxPages    — limitar número de páginas desde startOffset (ej. ?maxPages=2)
 *   pageDelayMs — pausa entre páginas en ms (default: 1500)
 *   translate   — traducir campos restantes con Claude Haiku (default: false)
 *
 * Ejemplos:
 *   supabase functions invoke import-workoutx            ← importa/actualiza en español
 *   supabase functions invoke import-workoutx -- ?maxPages=1   ← prueba 1 página
 *
 * Respuesta:
 *   { totalApi, startOffset, processed, created, updated, errors }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic         from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Configuración ──────────────────────────────────────────────────────────
const WORKOUTX_BASE_URL = Deno.env.get("WORKOUTX_BASE_URL") ?? "https://api.workoutxapp.com";
const WORKOUTX_API_KEY  = Deno.env.get("WORKOUTX_API_KEY") ?? "";
const PAGE_SIZE         = Math.max(1, parseInt(Deno.env.get("WORKOUTX_PAGE_SIZE") ?? "10", 10));

// ── Tipos WorkoutX ─────────────────────────────────────────────────────────
interface WorkoutXExercise {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  secondaryMuscles: string[];
  instructions: string[];
  gifUrl: string;
  category: string;
  difficulty: string;
  mechanic: string;
  force: string;
  met: number;
  caloriesPerMinute: number;
  description: string;
  isUnilateral: boolean;
  popularityRank: number;
  recommendedSets: string;
  recommendedReps: string;
  joint_focus: string;
  intensity_level: string;
  movement_tags: string[];
  lang: string;
}

interface WorkoutXResponse {
  total: number;
  count: number;
  data: WorkoutXExercise[];
}

interface ImportStats {
  totalApi: number;
  startOffset: number;
  processed: number;
  created: number;
  updated: number;
  errors: number;
}

// ── Mapeo WorkoutX → fila de ejercicios ───────────────────────────────────
function mapToRow(ex: WorkoutXExercise): Record<string, unknown> {
  return {
    source:              "workoutx",
    external_id:         ex.id,
    nombre:              ex.name,
    emoji:               "💪",
    grupo_muscular:      ex.target           || null,
    grupos_secundarios:  Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [],
    descripcion:         ex.description      || null,
    instrucciones:       Array.isArray(ex.instructions)     ? ex.instructions     : [],
    gif_url:             ex.gifUrl           || null,
    body_part:           ex.bodyPart         || null,
    equipment:           ex.equipment        || null,
    difficulty:          ex.difficulty       || null,
    category:            ex.category         || null,
    mechanic:            ex.mechanic         || null,
    force:               ex.force            || null,
    met:                 ex.met              ?? null,
    calories_per_minute: ex.caloriesPerMinute ?? null,
    is_unilateral:       ex.isUnilateral     ?? false,
    popularity_rank:     ex.popularityRank   ?? null,
    recommended_sets:    ex.recommendedSets  ?? null,
    recommended_reps:    ex.recommendedReps  ?? null,
    joint_focus:         ex.joint_focus      || null,
    intensity_level:     ex.intensity_level  || null,
    movement_tags:       Array.isArray(ex.movement_tags)    ? ex.movement_tags    : [],
    language:            ex.lang             || "es",
    // Catálogo global: created_by = NULL equivale a ejercicios del superadmin
    created_by:          null,
    video_url:           null,
    video_storage_path:  null,
  };
}

// ── Traducción de un lote de ejercicios con Claude Haiku ─────────────────
async function translateExercises(
  anthropic: Anthropic,
  exercises: WorkoutXExercise[],
): Promise<WorkoutXExercise[]> {
  const input = exercises.map((e) => ({
    id:           e.id,
    name:         e.name,
    description:  e.description ?? "",
    instructions: e.instructions ?? [],
  }));

  const message = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    system: [
      "Eres un traductor especializado en fitness, anatomía y entrenamiento físico.",
      "Traduce del inglés al español de manera natural y precisa.",
      "RESPONDE ÚNICAMENTE con un JSON array válido, sin markdown, sin explicaciones.",
      "Preserva el campo `id` sin modificarlo.",
      "Traduce `name`, `description` e `instructions` al español.",
      "En `instructions` traduce cada elemento del array por separado.",
      "Usa terminología de fitness en español de México/Latinoamérica.",
    ].join(" "),
    messages: [{ role: "user", content: `Traduce estos ejercicios:\n${JSON.stringify(input)}` }],
  });

  const raw       = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`Claude no devolvió JSON. Preview: ${raw.slice(0, 150)}`);

  const translated: { id: string; name: string; description: string; instructions: string[] }[] =
    JSON.parse(jsonMatch[0]);

  // Fusionar las traducciones de vuelta a los objetos originales
  const translatedMap = new Map(translated.map((t) => [t.id, t]));
  return exercises.map((ex) => {
    const t = translatedMap.get(ex.id);
    if (!t) return ex;
    return { ...ex, name: t.name, description: t.description, instructions: t.instructions };
  });
}

// ── Fetch de una página con retry+backoff conservador en 429 ─────────────
async function fetchPage(offset: number): Promise<WorkoutXResponse> {
  // lang=es: parámetro oficial de WorkoutX para español (documentado en workoutxapp.com/docs.html)
  const url = `${WORKOUTX_BASE_URL}/v1/exercises?limit=${PAGE_SIZE}&offset=${offset}&lang=es`;
  const maxRetries = 5;
  // Backoff conservador: 2s → 4s → 8s → 16s → 32s
  let delay = 2_000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      headers: {
        "X-WorkoutX-Key": WORKOUTX_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 429) {
      // Respetar Retry-After si lo manda el servidor
      const retryAfterRaw = res.headers.get("Retry-After");
      const retryAfterMs  = retryAfterRaw
        ? parseFloat(retryAfterRaw) * 1000   // el header viene en segundos
        : delay;
      const waitMs = Math.max(retryAfterMs, delay);

      console.log(
        `[WorkoutX] Rate limited (429) en offset=${offset} — ` +
        `reintento ${attempt}/${maxRetries} en ${waitMs}ms` +
        (retryAfterRaw ? ` (Retry-After: ${retryAfterRaw}s)` : ""),
      );

      await sleep(waitMs);
      delay = Math.min(delay * 2, 32_000); // tope en 32 s
      continue;
    }

    if (!res.ok) {
      throw new Error(`WorkoutX HTTP ${res.status} en offset=${offset}: ${res.statusText}`);
    }

    return res.json() as Promise<WorkoutXResponse>;
  }

  throw new Error(`[WorkoutX] Máximo de reintentos alcanzado en offset=${offset}`);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ── Handler principal ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validar que la API key está configurada (sin imprimirla)
  if (!WORKOUTX_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "WORKOUTX_API_KEY no está configurada en los Supabase Secrets del proyecto.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Cliente con service role para bypassear RLS (permite created_by = NULL)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Parámetros de control ──────────────────────────────────────────────
  const reqUrl = new URL(req.url);

  // startOffset: reanudar desde un offset específico sin tocar lo ya importado
  const startOffsetRaw = reqUrl.searchParams.get("startOffset");
  const startOffsetParsed = startOffsetRaw !== null ? parseInt(startOffsetRaw, 10) : 0;
  const startOffset = Number.isFinite(startOffsetParsed) && startOffsetParsed >= 0
    ? startOffsetParsed
    : 0;

  // maxPages: límite de páginas desde startOffset (útil para pruebas)
  const maxPagesStr = reqUrl.searchParams.get("maxPages");
  const maxPages    = maxPagesStr ? Math.max(1, parseInt(maxPagesStr, 10)) : Infinity;

  // pageDelayMs: pausa cortés entre páginas — default 1500 ms
  const pageDelayRaw = reqUrl.searchParams.get("pageDelayMs");
  const pageDelay    = pageDelayRaw !== null
    ? Math.max(0, parseInt(pageDelayRaw, 10))
    : 1_500;

  // translate: traducir al español con Claude Haiku (requiere ANTHROPIC_API_KEY)
  const translateEnabled = reqUrl.searchParams.get("translate") === "true";
  let anthropic: Anthropic | null = null;
  if (translateEnabled) {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "translate=true requiere ANTHROPIC_API_KEY en Supabase Secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    anthropic = new Anthropic({ apiKey: anthropicKey });
  }

  // ── Logs de inicio ─────────────────────────────────────────────────────
  console.log(
    startOffset > 0
      ? `[WorkoutX] Importación iniciada desde offset=${startOffset}`
      : `[WorkoutX] Importación iniciada desde el principio (offset=0)`,
  );
  console.log(`[WorkoutX] Delay entre páginas: ${pageDelay}ms`);
  console.log(`[WorkoutX] Traducción automática: ${translateEnabled ? "SÍ (Claude Haiku)" : "NO"}`);
  if (isFinite(maxPages)) {
    console.log(`[WorkoutX] Modo prueba: máximo ${maxPages} página(s) desde offset=${startOffset}`);
  }

  const stats: ImportStats = {
    totalApi: 0,
    startOffset,
    processed: 0,
    created: 0,
    updated: 0,
    errors: 0,
  };

  let offset    = startOffset;
  let pageCount = 0;

  try {
    while (pageCount < maxPages) {
      console.log(`[WorkoutX] Página offset=${offset}`);

      // ── Obtener página de WorkoutX ──
      let pageData: WorkoutXResponse;
      try {
        pageData = await fetchPage(offset);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[WorkoutX] ${msg}`);
        stats.errors++;
        break;
      }

      // Registrar el total de la API en la primera respuesta exitosa
      if (pageCount === 0) {
        stats.totalApi = pageData.total;
        console.log(`[WorkoutX] Total reportado por la API: ${pageData.total}`);
      }

      let exercises = pageData.data ?? [];
      console.log(`[WorkoutX] ${exercises.length} ejercicios recibidos`);

      if (exercises.length === 0) break;

      // ── Traducir al español si está habilitado ──
      if (translateEnabled && anthropic && exercises.length > 0) {
        try {
          exercises = await translateExercises(anthropic, exercises);
          console.log(`[WorkoutX] Traducción completada para offset=${offset}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[WorkoutX] Error de traducción offset=${offset}: ${msg} — importando en inglés`);
          // No bloqueamos la importación: si falla la traducción, importamos en inglés
        }
      }

      // ── Verificar cuáles ya existen (un solo SELECT por página) ──
      const externalIds = exercises.map((e) => e.id);

      const { data: existing, error: selError } = await supabase
        .from("ejercicios")
        .select("id, external_id")
        .eq("source", "workoutx")
        .in("external_id", externalIds);

      if (selError) {
        console.error(`[WorkoutX] Error verificando existentes offset=${offset}: ${selError.message}`);
        stats.errors += exercises.length;
        offset += PAGE_SIZE;
        pageCount++;
        continue;
      }

      const existingMap = new Map<string, string>(
        (existing ?? []).map((r) => [r.external_id as string, r.id as string]),
      );

      const toInsert = exercises.filter((e) => !existingMap.has(e.id));
      const toUpdate = exercises.filter((e) =>  existingMap.has(e.id));

      // ── Batch INSERT de nuevos ──
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("ejercicios")
          .insert(toInsert.map(mapToRow));

        if (insertError) {
          console.error(`[WorkoutX] Error en INSERT (offset=${offset}): ${insertError.message}`);
          stats.errors += toInsert.length;
        } else {
          stats.created += toInsert.length;
        }
      }

      // ── UPDATE de existentes ──
      for (const ex of toUpdate) {
        const rowId = existingMap.get(ex.id)!;
        const { error: updError } = await supabase
          .from("ejercicios")
          .update(mapToRow(ex))
          .eq("id", rowId);

        if (updError) {
          console.error(`[WorkoutX] Error en UPDATE external_id=${ex.id}: ${updError.message}`);
          stats.errors++;
        } else {
          stats.updated++;
        }
      }

      stats.processed += exercises.length;
      offset    += PAGE_SIZE;
      pageCount += 1;

      // Condición de parada: llegamos al final del catálogo
      if (offset >= pageData.total) break;

      // Pausa cortés entre páginas
      if (pageDelay > 0) await sleep(pageDelay);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[WorkoutX] Error general: ${msg}`);
    return new Response(
      JSON.stringify({ error: msg, stats }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  console.log(`[WorkoutX] Importación finalizada:`, JSON.stringify(stats));

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
