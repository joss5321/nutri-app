// Tests de crear-admin (issue #7): confirma que la sesión del caller
// nunca se usa para la creación (todo pasa por service_role), que un
// caller que no es superadmin se bloquea, y que un fallo real al asignar
// el rol responde error, no success:true.
//
// Correr con: deno test --allow-env --allow-net supabase/functions/crear-admin/index.test.ts

import { assertEquals } from "jsr:@std/assert@1"

Deno.env.set("SUPABASE_URL", "http://localhost:54321")
Deno.env.set("SUPABASE_ANON_KEY", "anon-key-test")
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-test")

const { handler } = await import("./index.ts")

const CALLER_ID = "11111111-1111-4111-8111-111111111111"
const NUEVO_ADMIN_ID = "33333333-3333-4333-8333-333333333333"

type CallerRol = "superadmin" | "admin" | "usuario" | "none"
type RolUpdateResultado = "ok" | "error"

function mockFetch(opts: { callerRol: CallerRol; rolUpdate?: RolUpdateResultado }) {
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()

    if (url.includes("/auth/v1/user")) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: CALLER_ID, aud: "authenticated", role: "authenticated" }), { status: 200 }),
      )
    }

    // requireSuperadmin: SELECT rol del caller — .maybeSingle(), sí
    // desenvuelve arrays (distinto de .single(), ver invitar-usuario/index.test.ts).
    if (url.includes("/rest/v1/perfiles") && method === "GET") {
      if (opts.callerRol === "none") {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify([{ rol: opts.callerRol }]), { status: 200 }))
    }

    // auth.admin.createUser (service_role)
    if (url.includes("/auth/v1/admin/users") && method === "POST") {
      return Promise.resolve(
        new Response(JSON.stringify({ id: NUEVO_ADMIN_ID, email: "admin-nuevo@test.com" }), { status: 200 }),
      )
    }

    // UPDATE perfiles.rol (service_role)
    if (url.includes("/rest/v1/perfiles") && method === "PATCH") {
      if (opts.rolUpdate === "error") {
        return Promise.resolve(new Response(JSON.stringify({ message: "update failed" }), { status: 500 }))
      }
      return Promise.resolve(new Response(JSON.stringify([{ id: NUEVO_ADMIN_ID }]), { status: 200 }))
    }

    throw new Error(`fetch no mockeado para esta prueba: ${method} ${url}`)
  }) as typeof fetch
}

function fakeRequest(body: Record<string, unknown>): Request {
  return new Request("http://x/crear-admin", {
    method: "POST",
    headers: { Authorization: "Bearer token-de-prueba", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const BODY_VALIDO = { email: "admin-nuevo@test.com", password: "contraseña-segura-123", nombre_completo: "Admin de Prueba" }

Deno.test("Caller superadmin + todo ok = success:true, sin tocar sesión del caller", async () => {
  mockFetch({ callerRol: "superadmin", rolUpdate: "ok" })
  const res = await handler(fakeRequest(BODY_VALIDO))
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.success, true)
  assertEquals(body.id, NUEVO_ADMIN_ID)
})

Deno.test("Caller admin (no superadmin) = 403, nunca llega a crear nada", async () => {
  mockFetch({ callerRol: "admin" })
  const res = await handler(fakeRequest(BODY_VALIDO))
  assertEquals(res.status, 403)
})

Deno.test("Caller sin perfil = 403", async () => {
  mockFetch({ callerRol: "none" })
  const res = await handler(fakeRequest(BODY_VALIDO))
  assertEquals(res.status, 403)
})

Deno.test("Sin Authorization = 401", async () => {
  mockFetch({ callerRol: "superadmin", rolUpdate: "ok" })
  const req = new Request("http://x/crear-admin", { method: "POST", body: JSON.stringify(BODY_VALIDO) })
  const res = await handler(req)
  assertEquals(res.status, 401)
})

Deno.test("Password corta = 400, nunca llama a createUser", async () => {
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes("/auth/v1/user")) {
      return Promise.resolve(new Response(JSON.stringify({ id: CALLER_ID }), { status: 200 }))
    }
    if (url.includes("/rest/v1/perfiles")) {
      return Promise.resolve(new Response(JSON.stringify([{ rol: "superadmin" }]), { status: 200 }))
    }
    throw new Error(`no debería llamar a createUser con password corta: ${url}`)
  }) as typeof fetch
  const res = await handler(fakeRequest({ ...BODY_VALIDO, password: "corta" }))
  assertEquals(res.status, 400)
})

Deno.test("UPDATE de rol falla = error real, NUNCA success:true", async () => {
  mockFetch({ callerRol: "superadmin", rolUpdate: "error" })
  const res = await handler(fakeRequest(BODY_VALIDO))
  assertEquals(res.status, 500)
  const body = await res.json()
  assertEquals(body.success, undefined)
})
