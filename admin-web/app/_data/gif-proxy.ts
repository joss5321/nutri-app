/**
 * Resuelve la URL final de un GIF de ejercicio.
 *
 * - URLs de Supabase Storage: se devuelven tal cual. Son públicas, sirven
 *   directo desde el CDN de Supabase, sin requests a WorkoutX.
 *
 * - URLs de WorkoutX (plan agotado): no hay forma de servirlas → null
 *   (fallback a emoji). Ya no existe ni se usa ninguna Edge Function
 *   gif-proxy — se retiró de producción.
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
