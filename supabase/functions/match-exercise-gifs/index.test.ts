// Smoke tests de autorización para match-exercise-gifs. No llama al CDN
// real de ExerciseGymGifsDB ni a Supabase real — mockea /auth/v1/user,
// /rest/v1/perfiles (requireSuperadmin) y, para el caso "superadmin",
// también el CDN y /rest/v1/ejercicios (ambos devolviendo listas vacías,
// suficiente para probar que la ejecución llega hasta el final sin tocar
// ningún servicio real). Confirma:
//   - no-superadmin → nunca llega a descargar el CDN ni a leer ejercicios
//   - superadmin → sí llega, completa con 200 (lote vacío)
//
// match-exercise-gifs no tiene ninguna env var a nivel de módulo, así que
// un import estático normal es suficiente.
//
// Correr con: deno test --allow-env --allow-net supabase/functions/match-exercise-gifs/index.test.ts

import { assertEquals } from "jsr:@std/assert@1"
import { handler } from "./index.ts"

const USER = { id: "11111111-1111-4111-8111-111111111111" }
const GIF_DB_URL_SUBSTR = "ExerciseGymGifsDB"

function mockFetch(opts: { rol: string | null; allowDownstream: boolean }) {
  let downstreamCalled = false
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

    if (url.includes("/auth/v1/user")) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: USER.id, aud: "authenticated", role: "authenticated" }), { status: 200 })
      )
    }
    if (url.includes("/rest/v1/perfiles")) {
      return Promise.resolve(new Response(JSON.stringify(opts.rol ? [{ rol: opts.rol }] : []), { status: 200 }))
    }

    // Cualquier llamada posterior a la autorización — solo debe ocurrir
    // si opts.allowDownstream=true (caso superadmin).
    downstreamCalled = true
    if (!opts.allowDownstream) {
      throw new Error(`No debería llegar aquí sin autorización: ${url}`)
    }
    if (url.includes(GIF_DB_URL_SUBSTR)) {
      return Promise.resolve(new Response(JSON.stringify({ exercises: [] }), { status: 200 }))
    }
    if (url.includes("/rest/v1/ejercicios")) {
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    }
    throw new Error(`fetch no mockeado para esta prueba: ${url}`)
  }) as typeof fetch
  return { wasDownstreamCalled: () => downstreamCalled }
}

function fakeRequest(): Request {
  return new Request("http://x/match-exercise-gifs", {
    headers: { Authorization: "Bearer token-de-prueba" },
  })
}

Deno.test("SEGURIDAD: rol usuario nunca llega a la lógica principal (403, sin tocar CDN/BD)", async () => {
  Deno.env.set("SUPABASE_URL", "http://localhost:54321")
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key-test")
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-test")
  const tracker = mockFetch({ rol: "usuario", allowDownstream: false })
  const res = await handler(fakeRequest())
  assertEquals(res.status, 403)
  assertEquals(tracker.wasDownstreamCalled(), false)
})

Deno.test("SEGURIDAD: rol admin nunca llega a la lógica principal (403, sin tocar CDN/BD)", async () => {
  Deno.env.set("SUPABASE_URL", "http://localhost:54321")
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key-test")
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-test")
  const tracker = mockFetch({ rol: "admin", allowDownstream: false })
  const res = await handler(fakeRequest())
  assertEquals(res.status, 403)
  assertEquals(tracker.wasDownstreamCalled(), false)
})

Deno.test("SEGURIDAD: superadmin SÍ llega a la lógica principal (200, lote vacío)", async () => {
  Deno.env.set("SUPABASE_URL", "http://localhost:54321")
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key-test")
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-test")
  mockFetch({ rol: "superadmin", allowDownstream: true })
  const res = await handler(fakeRequest())
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.processed, 0)
})
