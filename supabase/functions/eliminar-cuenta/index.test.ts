// Tests de eliminar-cuenta (issue #85, parte de #33): confirma el guardia de
// pacientes (409), que las suscripciones se anonimizan ANTES de borrar
// auth.users, que deleteUser recibe el id correcto, y los casos de
// error/HTTP. NO tocan Stripe ni Supabase reales — mockean globalThis.fetch
// únicamente (mismo patrón que crear-checkout/index.test.ts y
// crear-admin/index.test.ts).
//
// Correr con: deno test --allow-env --allow-net supabase/functions/eliminar-cuenta/index.test.ts

import { assertEquals } from "jsr:@std/assert@1"

// index.ts instancia `new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)` a
// nivel de módulo — hay que fijar el env var antes del import dinámico,
// igual que en crear-checkout/index.test.ts.
Deno.env.set("STRIPE_SECRET_KEY", "sk_test_dummy_for_tests")
Deno.env.set("SUPABASE_URL", "http://localhost:54321")
Deno.env.set("SUPABASE_ANON_KEY", "anon-key-test")
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-test")

const { handler } = await import("./index.ts")

const CALLER_ID = "11111111-1111-4111-8111-111111111111"

type Suscripcion = { id: string; provider: string; stripe_subscription_id: string | null }

function mockFetch(opts: {
  pacientesAsignados?: number
  pacientesManuales?: number
  suscripciones?: Suscripcion[]
  anonimizarFails?: boolean
  deleteUserFails?: boolean
  callLog?: string[]
}) {
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
    opts.callLog?.push(`${method} ${url}`)

    if (url.includes("/auth/v1/user")) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: CALLER_ID, aud: "authenticated", role: "authenticated" }), { status: 200 })
      )
    }

    // Guardia de dependientes — ambos cuentan con .select(..., {head:true}),
    // lo que supabase-js envía como HEAD real: sin body, el conteo viaja en
    // el header content-range ("<rango>/<total>").
    if (url.includes("/rest/v1/perfiles") && method === "HEAD") {
      return Promise.resolve(
        new Response(null, { status: 200, headers: { "content-range": `0-0/${opts.pacientesAsignados ?? 0}` } })
      )
    }
    if (url.includes("/rest/v1/pacientes_manuales") && method === "HEAD") {
      return Promise.resolve(
        new Response(null, { status: 200, headers: { "content-range": `0-0/${opts.pacientesManuales ?? 0}` } })
      )
    }

    // Lectura de suscripciones activas/trialing.
    if (url.includes("/rest/v1/suscripciones") && method === "GET") {
      return Promise.resolve(new Response(JSON.stringify(opts.suscripciones ?? []), { status: 200 }))
    }

    // Dos PATCH distintos a suscripciones: marcar una fila como 'canceled'
    // (filtra por id) vs anonimizar todas las del usuario (filtra por
    // user_id) — se distinguen por el query string.
    if (url.includes("/rest/v1/suscripciones") && method === "PATCH") {
      if (url.includes("user_id=eq.")) {
        if (opts.anonimizarFails) {
          return Promise.resolve(new Response(JSON.stringify({ message: "update failed" }), { status: 500 }))
        }
        return Promise.resolve(new Response(JSON.stringify([{ id: "x" }]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify([{ id: "x" }]), { status: 200 }))
    }

    // supabase.auth.admin.deleteUser(id) — DELETE /auth/v1/admin/users/{id}.
    if (url.includes("/auth/v1/admin/users/") && method === "DELETE") {
      if (opts.deleteUserFails) {
        return Promise.resolve(new Response(JSON.stringify({ message: "delete failed" }), { status: 500 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ id: CALLER_ID }), { status: 200 }))
    }

    throw new Error(`fetch no mockeado para esta prueba: ${method} ${url}`)
  }) as typeof fetch
}

function fakeRequest(): Request {
  return new Request("http://x/eliminar-cuenta", {
    method: "POST",
    headers: { Authorization: "Bearer token-de-prueba" },
  })
}

// ── HTTP / método ────────────────────────────────────────────────────────
Deno.test("HTTP: OPTIONS responde 200 sin tocar auth", async () => {
  const res = await handler(new Request("http://x/eliminar-cuenta", { method: "OPTIONS" }))
  assertEquals(res.status, 200)
})

Deno.test("HTTP: GET responde 405", async () => {
  const res = await handler(new Request("http://x/eliminar-cuenta", { method: "GET" }))
  assertEquals(res.status, 405)
})

// ── AUTH ─────────────────────────────────────────────────────────────────
Deno.test("AUTH: POST sin Authorization = 401", async () => {
  const res = await handler(new Request("http://x/eliminar-cuenta", { method: "POST" }))
  assertEquals(res.status, 401)
})

Deno.test("AUTH: POST con JWT inválido (auth.getUser falla) = 401", async () => {
  globalThis.fetch = (() =>
    Promise.resolve(new Response(JSON.stringify({ message: "invalid token" }), { status: 401 }))) as typeof fetch
  const res = await handler(fakeRequest())
  assertEquals(res.status, 401)
})

// ── GUARDIA de dependientes (409) ───────────────────────────────────────
Deno.test("GUARDIA: nutriólogo con pacientes asignados (perfiles) = 409, nunca llega a suscripciones/deleteUser", async () => {
  const callLog: string[] = []
  mockFetch({ pacientesAsignados: 3, callLog })
  const res = await handler(fakeRequest())
  assertEquals(res.status, 409)
  const body = await res.json()
  assertEquals(body.pacientesAsignados, 3)
  assertEquals(callLog.some((c) => c.includes("/rest/v1/suscripciones")), false)
  assertEquals(callLog.some((c) => c.includes("/auth/v1/admin/users/")), false)
})

Deno.test("GUARDIA: nutriólogo con pacientes manuales = 409", async () => {
  mockFetch({ pacientesManuales: 1 })
  const res = await handler(fakeRequest())
  assertEquals(res.status, 409)
  const body = await res.json()
  assertEquals(body.pacientesAsignados, 1)
})

Deno.test("GUARDIA: pacientes asignados Y manuales se suman en el mensaje", async () => {
  mockFetch({ pacientesAsignados: 2, pacientesManuales: 1 })
  const res = await handler(fakeRequest())
  assertEquals(res.status, 409)
  const body = await res.json()
  assertEquals(body.pacientesAsignados, 3)
})

// ── ÉXITO: sin pacientes, sin suscripciones activas ─────────────────────
Deno.test("ÉXITO: sin pacientes ni suscripciones = success:true, deleteUser llamado con el id correcto", async () => {
  const callLog: string[] = []
  mockFetch({ suscripciones: [], callLog })
  const res = await handler(fakeRequest())
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.success, true)
  const deleteCall = callLog.find((c) => c.includes("/auth/v1/admin/users/"))
  assertEquals(deleteCall, `DELETE http://localhost:54321/auth/v1/admin/users/${CALLER_ID}`)
})

// ── ORDEN: anonimizar suscripciones ANTES de borrar auth.users ──────────
// Sin una suscripción Stripe real de por medio a propósito: el SDK de
// Stripe instancia su cliente HTTP al cargar el módulo (antes de que
// cualquier mockFetch() de este archivo pueda reemplazar globalThis.fetch),
// así que una llamada real a stripe.subscriptions.cancel() escapa al mock
// y pega contra la API real de Stripe — mismo motivo por el que
// crear-checkout/index.test.ts tampoco prueba esa ruta con mocks. La
// garantía de orden que pide el issue #85 (anonimizar ANTES de
// deleteUser) no depende de que haya o no una suscripción de Stripe por
// cancelar, así que se prueba igual de bien sin ella.
Deno.test("ORDEN: suscripciones se anonimiza ANTES de que se borre auth.users", async () => {
  const callLog: string[] = []
  mockFetch({ suscripciones: [], callLog })
  const res = await handler(fakeRequest())
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.success, true)

  const idxAnonimizar = callLog.findIndex((c) => c.includes("/rest/v1/suscripciones") && c.includes("user_id=eq."))
  const idxDeleteUser = callLog.findIndex((c) => c.includes("/auth/v1/admin/users/"))
  assertEquals(idxAnonimizar >= 0, true)
  assertEquals(idxDeleteUser >= 0, true)
  // Si no fuera así, una vez borrado auth.users ya no habría forma de
  // ubicar esas filas de suscripciones por user_id.
  assertEquals(idxAnonimizar < idxDeleteUser, true)
})

// ── Suscripciones de RevenueCat: nunca se intenta cancelar por API ──────
Deno.test("RevenueCat: suscripción activa de ese proveedor no dispara ninguna llamada a Stripe", async () => {
  const callLog: string[] = []
  mockFetch({
    suscripciones: [{ id: "sus_2", provider: "revenuecat", stripe_subscription_id: null }],
    callLog,
  })
  const res = await handler(fakeRequest())
  assertEquals(res.status, 200)
  assertEquals(callLog.some((c) => c.includes("api.stripe.com")), false)
})

// ── Errores: ninguno degrada a success:true ─────────────────────────────
// (La cancelación de Stripe fallando, y el marcado de 'canceled' fallando,
// solo se ejercen cuando SÍ hay una suscripción Stripe real de por medio —
// no se prueban aquí por la misma razón de arriba: esa llamada escapa al
// mock de fetch. Quedan cubiertos por smoke tests reales en modo test de
// Stripe, como el resto de las funciones de pagos de este proyecto.)
Deno.test("ERROR: falla anonimizar suscripciones = 500, nunca llega a deleteUser", async () => {
  const callLog: string[] = []
  mockFetch({ suscripciones: [], anonimizarFails: true, callLog })
  const res = await handler(fakeRequest())
  assertEquals(res.status, 500)
  assertEquals(callLog.some((c) => c.includes("/auth/v1/admin/users/")), false)
})

Deno.test("ERROR: falla deleteUser = 500, nunca success:true", async () => {
  mockFetch({ suscripciones: [], deleteUserFails: true })
  const res = await handler(fakeRequest())
  assertEquals(res.status, 500)
  const body = await res.json()
  assertEquals(body.success, undefined)
})
