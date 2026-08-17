/**
 * migrate-gifs — Edge Function
 *
 * Migración única: descarga los GIFs de WorkoutX y los sube a Supabase Storage.
 * Después de correr esta función, gif_url en la BD apunta a Supabase Storage
 * y los GIFs se sirven públicamente sin necesitar el API key de WorkoutX.
 *
 * Prerrequisito: crear el bucket en Supabase Dashboard:
 *   Storage → New bucket → nombre: "exercise-gifs" → Public: ON
 *
 * Variables de entorno (Supabase Secrets):
 *   WORKOUTX_API_KEY   — para descargar los GIFs originales
 *   WORKOUTX_BASE_URL  — URL base de WorkoutX (default: https://api.workoutxapp.com)
 *
 * Query params opcionales:
 *   startOffset — reanudar desde este índice (default: 0)
 *   batchSize   — GIFs por invocación (default: 50, max recomendado: 80)
 *   delayMs     — pausa entre descargas en ms (default: 200)
 *
 * Uso (4 bloques de ~330 GIFs, ~1-2 min cada uno):
 *   ?startOffset=0&batchSize=330
 *   ?startOffset=330&batchSize=330
 *   ?startOffset=660&batchSize=330
 *   ?startOffset=990&batchSize=400
 *
 * Respuesta:
 *   { total, startOffset, migrated, skipped, errors }
 *   - migrated: GIFs recién subidos a Storage
 *   - skipped:  ya estaban en Supabase Storage (idempotente)
 *   - errors:   fallaron (gif_url no cambia, se puede reintentar)
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET          = "exercise-gifs";
const WORKOUTX_KEY    = Deno.env.get("WORKOUTX_API_KEY")  ?? "";
const WORKOUTX_BASE   = Deno.env.get("WORKOUTX_BASE_URL") ?? "https://api.workoutxapp.com";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!WORKOUTX_KEY) {
    return new Response(
      JSON.stringify({ error: "WORKOUTX_API_KEY no configurado." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const reqUrl      = new URL(req.url);
  const startOffset = Math.max(0, parseInt(reqUrl.searchParams.get("startOffset") ?? "0", 10));
  const batchSize   = Math.max(1, Math.min(200, parseInt(reqUrl.searchParams.get("batchSize") ?? "50", 10)));
  const delayMs     = Math.max(0, parseInt(reqUrl.searchParams.get("delayMs") ?? "200", 10));

  console.log(`[migrate-gifs] startOffset=${startOffset} batchSize=${batchSize} delayMs=${delayMs}`);

  // Contar total pendiente de migrar
  const { count } = await supabase
    .from("ejercicios")
    .select("id", { count: "exact", head: true })
    .eq("source", "workoutx")
    .not("gif_url", "is", null);

  const stats = { total: count ?? 0, startOffset, migrated: 0, skipped: 0, errors: 0 };

  // Leer el lote de ejercicios a procesar
  const { data: exercises, error: fetchErr } = await supabase
    .from("ejercicios")
    .select("id, external_id, gif_url")
    .eq("source", "workoutx")
    .not("gif_url", "is", null)
    .order("external_id", { ascending: true })
    .range(startOffset, startOffset + batchSize - 1);

  if (fetchErr) {
    return new Response(
      JSON.stringify({ error: fetchErr.message, stats }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const rows = exercises ?? [];
  console.log(`[migrate-gifs] ${rows.length} ejercicios en este lote`);

  for (const row of rows) {
    const gifUrl = row.gif_url as string;

    // Ya está en Supabase Storage → saltar (idempotente)
    if (gifUrl.includes("supabase.co/storage")) {
      stats.skipped++;
      continue;
    }

    // Extraer nombre de archivo de la URL de WorkoutX
    const filename = gifUrl.split("/").pop();
    if (!filename || !filename.toLowerCase().endsWith(".gif")) {
      console.warn(`[migrate-gifs] URL inválida id=${row.id}: ${gifUrl}`);
      stats.errors++;
      continue;
    }

    // ── Descargar GIF de WorkoutX ──
    let gifBytes: Uint8Array;
    try {
      const res = await fetch(`${WORKOUTX_BASE}/v1/gifs/${filename}`, {
        headers: { "X-WorkoutX-Key": WORKOUTX_KEY },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      gifBytes = new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[migrate-gifs] Error descargando ${filename}: ${msg}`);
      stats.errors++;
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }

    // ── Subir a Supabase Storage ──
    const storagePath = filename; // ej. "0001.gif"
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, gifBytes, {
        contentType: "image/gif",
        upsert: true,   // si ya existe, sobreescribir
      });

    if (uploadErr) {
      console.error(`[migrate-gifs] Error subiendo ${storagePath}: ${uploadErr.message}`);
      stats.errors++;
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }

    // URL pública de Supabase Storage
    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicData.publicUrl;

    // ── Actualizar gif_url en la BD ──
    const { error: updErr } = await supabase
      .from("ejercicios")
      .update({ gif_url: publicUrl })
      .eq("id", row.id);

    if (updErr) {
      console.error(`[migrate-gifs] Error UPDATE id=${row.id}: ${updErr.message}`);
      stats.errors++;
    } else {
      stats.migrated++;
      if (stats.migrated % 10 === 0) {
        console.log(`[migrate-gifs] Progreso: ${stats.migrated} migrados, ${stats.errors} errores`);
      }
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  console.log("[migrate-gifs] Lote finalizado:", JSON.stringify(stats));

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
