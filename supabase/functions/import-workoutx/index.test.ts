// Smoke tests de autorización para import-workoutx. No llaman a WorkoutX,
// Anthropic ni Supabase reales — solo mockean /auth/v1/user y
// /rest/v1/perfiles para requireSuperadmin(). Confirman:
//   - no-superadmin → nunca llega a la lógica principal (WORKOUTX_API_KEY)
//   - superadmin → sí llega (se detiene en el 500 de config, esperado
//     porque en este test deliberadamente no se configura WORKOUTX_API_KEY)
//
// Correr con: deno test --allow-env --allow-net supabase/functions/import-workoutx/index.test.ts

import { assertEquals } from "jsr:@std/assert@1"

// WORKOUTX_API_KEY se lee a nivel de módulo en index.ts — se deja SIN
// configurar a propósito, y se fija el resto ANTES del import dinámico
// (un import estático se resolvería antes de que este archivo corra).
Deno.env.set("SUPABASE_URL", "http://localhost:54321")
Deno.env.set("SUPABASE_ANON_KEY", "anon-key-test")
const { handler } = await import("./index.ts")

const USER = { id: "11111111-1111-4111-8111-111111111111" }

function mockFetch(rol: string | null) {
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes("/auth/v1/user")) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: USER.id, aud: "authenticated", role: "authenticated" }), { status: 200 })
      )
    }
    if (url.includes("/rest/v1/perfiles")) {
      return Promise.resolve(new Response(JSON.stringify(rol ? [{ rol }] : []), { status: 200 }))
    }
    throw new Error(`fetch no mockeado para esta prueba: ${url}`)
  }) as typeof fetch
}

function fakeRequest(): Request {
  return new Request("http://x/import-workoutx", {
    headers: { Authorization: "Bearer token-de-prueba" },
  })
}

Deno.test("SEGURIDAD: rol usuario nunca llega a la lógica principal (403, no 500 de config)", async () => {
  mockFetch("usuario")
  const res = await handler(fakeRequest())
  assertEquals(res.status, 403)
})

Deno.test("SEGURIDAD: rol admin nunca llega a la lógica principal (403, no 500 de config)", async () => {
  mockFetch("admin")
  const res = await handler(fakeRequest())
  assertEquals(res.status, 403)
})

Deno.test("SEGURIDAD: superadmin SÍ llega a la lógica principal (500 de config esperado, no 401/403)", async () => {
  mockFetch("superadmin")
  const res = await handler(fakeRequest())
  assertEquals(res.status, 500)
  const body = await res.json()
  assertEquals(typeof body.error === "string" && body.error.includes("WORKOUTX_API_KEY"), true)
})
