// Tests de invitar-usuario (issue #4): el criterio de aceptación pide
// confirmar con una prueba real que, si el UPDATE final sobre perfiles
// falla, la función responde un error real y NUNCA success:true.
//
// Correr con: deno test --allow-env --allow-net supabase/functions/invitar-usuario/index.test.ts

import { assertEquals } from "jsr:@std/assert@1"

Deno.env.set("SUPABASE_URL", "http://localhost:54321")
Deno.env.set("SUPABASE_ANON_KEY", "anon-key-test")
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-test")

const { handler } = await import("./index.ts")

const CALLER_ID = "11111111-1111-4111-8111-111111111111"
const NUEVO_USER_ID = "22222222-2222-4222-8222-222222222222"

type CallerRol = "admin" | "superadmin" | "usuario" | null
type UpdateResultado = "ok" | "error"

function mockFetch(opts: { callerRol: CallerRol; updatePerfiles: UpdateResultado }) {
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()

    if (url.includes("/auth/v1/user")) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: CALLER_ID, aud: "authenticated", role: "authenticated" }), { status: 200 }),
      )
    }

    // SELECT rol del caller (cliente anon) — .single() pide
    // "Accept: application/vnd.pgrst.object+json": a diferencia de
    // .maybeSingle(), postgrest-js NO desenvuelve un array él mismo (ver
    // PostgrestBuilder.ts: el desenvolvido solo aplica si isMaybeSingle) —
    // confía en que el server ya responda un objeto suelto (o un error si
    // no hay exactamente 1 fila). Si no hay perfil, se simula el error real
    // que PostgREST devuelve para "object+json" con 0 filas.
    if (url.includes("/rest/v1/perfiles") && method === "GET") {
      if (!opts.callerRol) {
        return Promise.resolve(
          new Response(JSON.stringify({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }), { status: 406 }),
        )
      }
      return Promise.resolve(new Response(JSON.stringify({ rol: opts.callerRol }), { status: 200 }))
    }

    // auth.admin.inviteUserByEmail (cliente service_role) — éxito simulado.
    if (url.includes("/auth/v1/invite")) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: NUEVO_USER_ID, email: "paciente@test.com" }), { status: 200 }),
      )
    }

    // UPDATE final sobre perfiles (cliente service_role) — lo que este test controla.
    if (url.includes("/rest/v1/perfiles") && method === "PATCH") {
      if (opts.updatePerfiles === "error") {
        return Promise.resolve(new Response(JSON.stringify({ message: "update failed" }), { status: 500 }))
      }
      return Promise.resolve(new Response(JSON.stringify([{ id: NUEVO_USER_ID }]), { status: 200 }))
    }

    throw new Error(`fetch no mockeado para esta prueba: ${method} ${url}`)
  }) as typeof fetch
}

function fakeRequest(body: Record<string, unknown>): Request {
  return new Request("http://x/invitar-usuario", {
    method: "POST",
    headers: { Authorization: "Bearer token-de-prueba", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const BODY_VALIDO = { email: "paciente@test.com", nombre_completo: "Paciente de Prueba" }

Deno.test("UPDATE falla = error real, NUNCA success:true (issue #4)", async () => {
  mockFetch({ callerRol: "admin", updatePerfiles: "error" })
  const res = await handler(fakeRequest(BODY_VALIDO))
  assertEquals(res.status, 500)
  const body = await res.json()
  assertEquals(body.success, undefined)
  assertEquals(typeof body.error, "string")
})

Deno.test("UPDATE exitoso = success:true", async () => {
  mockFetch({ callerRol: "admin", updatePerfiles: "ok" })
  const res = await handler(fakeRequest(BODY_VALIDO))
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.success, true)
  assertEquals(body.id, NUEVO_USER_ID)
})

Deno.test("AUTH: sin Authorization = 401", async () => {
  mockFetch({ callerRol: "admin", updatePerfiles: "ok" })
  const req = new Request("http://x/invitar-usuario", { method: "POST", body: JSON.stringify(BODY_VALIDO) })
  const res = await handler(req)
  assertEquals(res.status, 401)
})

Deno.test("ROL: caller sin rol admin/superadmin = 403", async () => {
  mockFetch({ callerRol: "usuario", updatePerfiles: "ok" })
  const res = await handler(fakeRequest(BODY_VALIDO))
  assertEquals(res.status, 403)
})

Deno.test("VALIDACION: falta email = 400", async () => {
  mockFetch({ callerRol: "admin", updatePerfiles: "ok" })
  const res = await handler(fakeRequest({ nombre_completo: "Sin correo" }))
  assertEquals(res.status, 400)
})
