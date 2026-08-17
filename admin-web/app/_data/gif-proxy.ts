/**
 * Resuelve la URL final de un GIF de ejercicio.
 *
 * - URLs de Supabase Storage (post-migración): se devuelven tal cual.
 *   Son públicas, sirven directo desde el CDN de Supabase, sin requests a WorkoutX.
 *
 * - URLs de WorkoutX (pre-migración): se redirigen al gif-proxy Edge Function
 *   que inyecta el API key server-side.
 *
 * Después de correr migrate-gifs, todos los gif_url apuntarán a Supabase Storage
 * y esta función simplemente los devuelve sin modificar.
 */
const SUPABASE_URL = "https://uvfdbvzydbogfkntfuix.supabase.co";

export function proxyGifUrl(gifUrl: string | null | undefined): string | null {
  if (!gifUrl) return null;

  // Ya está en Supabase Storage → devolver directo, sin proxy, sin requests a WorkoutX
  if (gifUrl.includes("supabase.co/storage")) return gifUrl;

  // URL de WorkoutX → plan agotado, no hay proxy disponible → null (emoji fallback)
  if (gifUrl.includes("workoutxapp.com")) return null;

  // Cualquier otra URL pública → devolver directo
  return gifUrl;
}
