/**
 * Resuelve la URL final de un GIF de ejercicio.
 * Post-migración: gif_url apunta a Supabase Storage → se devuelve directo.
 * Pre-migración: gif_url apunta a WorkoutX → se redirige al proxy.
 */
const SUPABASE_URL = "https://uvfdbvzydbogfkntfuix.supabase.co";

export function proxyGifUrl(gifUrl: string | null | undefined): string | null {
  if (!gifUrl) return null;
  if (gifUrl.includes("supabase.co/storage")) return gifUrl;
  // URL de WorkoutX → plan agotado → null (emoji fallback)
  if (gifUrl.includes("workoutxapp.com")) return null;
  return gifUrl;
}
