/**
 * Resuelve la URL final de un GIF de ejercicio.
 * - gif_url en Supabase Storage: se usa directo (público, sin requests a WorkoutX).
 * - gif_url en WorkoutX (plan agotado): no hay forma de servirlo → null (fallback a emoji).
 *   Ya no existe ni se usa ninguna Edge Function gif-proxy — se retiró de producción.
 */
export function proxyGifUrl(gifUrl: string | null | undefined): string | null {
  if (!gifUrl) return null;
  if (gifUrl.includes("supabase.co/storage")) return gifUrl;
  // URL de WorkoutX → plan agotado → null (emoji fallback)
  if (gifUrl.includes("workoutxapp.com")) return null;
  return gifUrl;
}
