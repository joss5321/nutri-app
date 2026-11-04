// Módulo compartido — NO es una Edge Function propia (prefijo `_`), solo
// importable desde otras funciones. Issue #29: hoy existe un único secreto
// STRIPE_SECRET_KEY (sin variante test/live separada), así que la forma
// más confiable de saber en qué modo corre una invocación real es leer el
// propio prefijo de la clave activa ('sk_test_'/'sk_live_') — evita que un
// indicador de modo independiente (una variable aparte) se desincronice de
// la clave real que de verdad se está usando para llamar a Stripe.
//
// Se llama una sola vez, a nivel de módulo (cold start), en cada Edge
// Function que inicializa un cliente de Stripe — así el modo queda visible
// en los logs de arranque de esa invocación sin tener que instrumentar
// cada ruta de código. Nunca imprime la clave en sí, solo el modo derivado.

export type StripeMode = "test" | "live" | "desconocido"

export function detectarModoStripe(key: string | undefined): StripeMode {
  if (!key) return "desconocido"
  if (key.startsWith("sk_test_")) return "test"
  if (key.startsWith("sk_live_")) return "live"
  return "desconocido"
}

export function logModoStripeAlArrancar(functionName: string, key: string | undefined): StripeMode {
  const modo = detectarModoStripe(key)
  if (modo === "desconocido") {
    console.error(`[stripe-mode] ${functionName}: STRIPE_SECRET_KEY ausente o con prefijo inesperado — no se pudo determinar test/live.`)
  } else {
    console.log(`[stripe-mode] ${functionName}: modo ${modo.toUpperCase()}`)
  }
  return modo
}
