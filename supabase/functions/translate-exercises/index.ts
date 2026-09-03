/**
 * translate-exercises — Edge Function
 *
 * Traduce nombre, descripcion e instrucciones de los ejercicios WorkoutX al español
 * usando Claude Haiku. Diseñada para ejecución manual como migración de datos.
 *
 * Variables de entorno requeridas (Supabase Secrets):
 *   ANTHROPIC_API_KEY — clave de la API de Anthropic
 *
 * Query params opcionales:
 *   startOffset — reanudar desde offset específico (default: 0)
 *   batchSize   — ejercicios por lote / llamada a Claude (default: 20)
 *   maxBatches  — limitar lotes para pruebas (default: sin límite)
 *   delayMs     — pausa entre lotes en ms (default: 500)
 *
 * Ejemplos:
 *   supabase functions invoke translate-exercises
 *   supabase functions invoke translate-exercises -- ?batchSize=5&maxBatches=1
 *
 * Respuesta:
 *   { total, startOffset, translated, errors, skipped }
 */

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSuperadmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  instrucciones: string[] | null;
}

interface TranslatedRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  instrucciones: string[] | null;
}

// ── Traducción en lote con Claude Haiku ──────────────────────────────────
async function translateBatch(
  anthropic: Anthropic,
  exercises: ExRow[],
): Promise<TranslatedRow[]> {
  const input = exercises.map((e) => ({
    id:           e.id,
    nombre:       e.nombre,
    descripcion:  e.descripcion ?? "",
    instrucciones: e.instrucciones ?? [],
  }));

  const message = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    system: [
      "Eres un traductor especializado en fitness, anatomía y entrenamiento físico.",
      "Traduce del inglés al español de manera natural y precisa.",
      "RESPONDE ÚNICAMENTE con un JSON array válido, sin markdown, sin explicaciones.",
      "Preserva el campo `id` sin modificarlo.",
      "Traduce `nombre`, `descripcion` e `instrucciones` al español.",
      "En `instrucciones` traduce cada elemento del array por separado.",
      "Usa terminología de fitness en español de México/Latinoamérica.",
      "Nombres de máquinas y equipos puedes adaptarlos (ej. 'barbell' → 'barra').",
    ].join(" "),
    messages: [{
      role: "user",
      content: `Traduce estos ejercicios al español:\n${JSON.stringify(input)}`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  // Extraer JSON aunque Claude añada markdown o texto extra
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Claude no devolvió JSON válido. Preview: ${raw.slice(0, 200)}`);
  }

  const parsed: TranslatedRow[] = JSON.parse(jsonMatch[0]);

  // Validación básica: misma cantidad de elementos
  if (parsed.length !== exercises.length) {
    throw new Error(
      `Lote de ${exercises.length} ejercicios pero Claude devolvió ${parsed.length} traducciones.`,
    );
  }

  return parsed;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Handler principal ──────────────────────────────────────────────────────
export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Herramienta manual/interna: solo superadmin puede dispararla. Nunca se
  // usa service_role para decidir esto — requireSuperadmin usa un cliente
  // anon+Authorization reenviado.
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.response;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY no está configurado en Supabase Secrets." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const supabase  = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Parámetros ────────────────────────────────────────────────────────
  const reqUrl      = new URL(req.url);
  const batchSize   = Math.max(1, Math.min(30, parseInt(reqUrl.searchParams.get("batchSize")   ?? "20",  10)));
  const maxBatches  = (() => { const v = parseInt(reqUrl.searchParams.get("maxBatches") ?? "", 10); return isFinite(v) ? v : Infinity; })();
  const delayMs     = Math.max(0, parseInt(reqUrl.searchParams.get("delayMs")   ?? "500", 10));
  const startOffsetRaw = parseInt(reqUrl.searchParams.get("startOffset") ?? "0", 10);
  const startOffset    = isFinite(startOffsetRaw) && startOffsetRaw >= 0 ? startOffsetRaw : 0;

  console.log(`[translate] startOffset=${startOffset} batchSize=${batchSize} maxBatches=${isFinite(maxBatches) ? maxBatches : "∞"} delayMs=${delayMs}`);

  // Contar total de ejercicios WorkoutX
  const { count } = await supabase
    .from("ejercicios")
    .select("id", { count: "exact", head: true })
    .eq("source", "workoutx");

  const total = count ?? 0;
  console.log(`[translate] Total ejercicios WorkoutX en BD: ${total}`);

  const stats = { total, startOffset, translated: 0, errors: 0 };

  let offset     = startOffset;
  let batchCount = 0;

  try {
    while (batchCount < maxBatches) {
      // Obtener siguiente lote
      const { data, error: fetchErr } = await supabase
        .from("ejercicios")
        .select("id, nombre, descripcion, instrucciones")
        .eq("source", "workoutx")
        .order("created_at", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (fetchErr) {
        console.error(`[translate] Error al leer lote offset=${offset}: ${fetchErr.message}`);
        stats.errors += batchSize;
        break;
      }

      const exercises = (data ?? []) as ExRow[];
      if (exercises.length === 0) {
        console.log("[translate] Sin más ejercicios — fin.");
        break;
      }

      console.log(`[translate] Lote offset=${offset} — ${exercises.length} ejercicios`);

      // Traducir con Claude
      let translations: TranslatedRow[];
      try {
        translations = await translateBatch(anthropic, exercises);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[translate] Error en traducción offset=${offset}: ${msg}`);
        stats.errors += exercises.length;
        offset    += batchSize;
        batchCount++;
        continue;
      }

      // Actualizar cada ejercicio en la BD
      for (const t of translations) {
        const { error: updErr } = await supabase
          .from("ejercicios")
          .update({
            nombre:       t.nombre,
            descripcion:  t.descripcion || null,
            instrucciones: Array.isArray(t.instrucciones) ? t.instrucciones : [],
            language:     "es",
          })
          .eq("id", t.id);

        if (updErr) {
          console.error(`[translate] Error UPDATE id=${t.id}: ${updErr.message}`);
          stats.errors++;
        } else {
          stats.translated++;
        }
      }

      console.log(`[translate] Lote finalizado — traducidos: ${stats.translated} / errores: ${stats.errors}`);

      offset    += batchSize;
      batchCount++;

      if (exercises.length < batchSize) break; // último lote incompleto

      if (delayMs > 0) await sleep(delayMs);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[translate] Error general: ${msg}`);
    return new Response(
      JSON.stringify({ error: msg, stats }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  console.log("[translate] Finalizado:", JSON.stringify(stats));

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(handler);
