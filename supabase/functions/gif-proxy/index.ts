/**
 * gif-proxy — Edge Function
 *
 * Proxia las peticiones de GIFs de WorkoutX inyectando el API key server-side.
 * Los GIFs requieren autenticación y el navegador/app no puede enviar headers
 * personalizados desde <img> o expo-image.
 *
 * Deploy: supabase functions deploy gif-proxy --no-verify-jwt
 *
 * URL de uso:
 *   https://<project>.supabase.co/functions/v1/gif-proxy?file=0001.gif
 *
 * Seguridad:
 *   - El WORKOUTX_API_KEY nunca llega al cliente
 *   - El parámetro `file` se valida contra una expresión regular estricta
 *   - Los GIFs no son contenido sensible (demostraciones de ejercicios)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey",
};

// Regex estricta: solo [alfanumérico - _] seguido de .gif
// Evita path traversal (../) y cualquier otro tipo de archivo
const VALID_GIF_FILE = /^[\w\-]+\.gif$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url  = new URL(req.url);
  const file = url.searchParams.get("file") ?? "";

  // Validación del parámetro
  if (!file || !VALID_GIF_FILE.test(file)) {
    return new Response(
      JSON.stringify({ error: "Parámetro `file` inválido o ausente." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const apiKey  = Deno.env.get("WORKOUTX_API_KEY") ?? "";
  const baseUrl = Deno.env.get("WORKOUTX_BASE_URL") ?? "https://api.workoutxapp.com";

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "WORKOUTX_API_KEY no configurado." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const gifUrl = `${baseUrl}/v1/gifs/${file}`;

  let upstream: Response;
  try {
    upstream = await fetch(gifUrl, {
      headers: { "X-WorkoutX-Key": apiKey },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Error al contactar WorkoutX: ${msg}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `WorkoutX respondió ${upstream.status}` }),
      { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Transmitir el GIF con caché agresivo (los GIFs del catálogo no cambian)
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/gif",
      // 1 año de caché inmutable — el archivo 0001.gif siempre es el mismo ejercicio
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
