// Correr con: deno test --allow-env supabase/functions/_shared/stripe-mode.test.ts

import { assertEquals } from "jsr:@std/assert@1"
import { detectarModoStripe, logModoStripeAlArrancar } from "./stripe-mode.ts"

Deno.test("detectarModoStripe: sk_test_... = test", () => {
  assertEquals(detectarModoStripe("sk_test_abc123"), "test")
})

Deno.test("detectarModoStripe: sk_live_... = live", () => {
  assertEquals(detectarModoStripe("sk_live_abc123"), "live")
})

Deno.test("detectarModoStripe: undefined = desconocido", () => {
  assertEquals(detectarModoStripe(undefined), "desconocido")
})

Deno.test("detectarModoStripe: cadena vacía = desconocido", () => {
  assertEquals(detectarModoStripe(""), "desconocido")
})

Deno.test("detectarModoStripe: prefijo inesperado = desconocido (nunca asume live por defecto)", () => {
  assertEquals(detectarModoStripe("rk_live_restricted_key_xyz"), "desconocido")
})

Deno.test("logModoStripeAlArrancar: devuelve el modo detectado sin lanzar", () => {
  assertEquals(logModoStripeAlArrancar("test-fn", "sk_test_abc"), "test")
  assertEquals(logModoStripeAlArrancar("test-fn", "sk_live_abc"), "live")
  assertEquals(logModoStripeAlArrancar("test-fn", undefined), "desconocido")
})
