// Tests de requireSuperadmin() — mockean globalThis.fetch únicamente para
// GET {SUPABASE_URL}/auth/v1/user (auth.getUser) y para
// {SUPABASE_URL}/rest/v1/perfiles (el SELECT rol). Nunca tocan Supabase ni
// Stripe reales.
//
// El formato exacto que espera .maybeSingle() se verificó leyendo el
// código fuente real de @supabase/postgrest-js cacheado localmente
// (PostgrestBuilder.ts processResponse): con Accept pidiendo un objeto
// pero el server respondiendo un ARRAY JSON con status 200, postgrest-js
// interpreta array vacío → {data:null, error:null} (perfil ausente),
// array de 1 → {data: el objeto, error:null}, status no-2xx → error real.
// No se adivinó este comportamiento.
//
// Correr con: deno test --allow-env --allow-net supabase/functions/_shared/auth.test.ts

import { assertEquals } from "jsr:@std/assert@1"
import { requireSuperadmin } from "./auth.ts"

const ORIGINAL_FETCH = globalThis.fetch
const ENV_KEYS = ["SUPABASE_URL", "SUPABASE_ANON_KEY"] as const

function snapshotEnv() {
  const snap: Record<string, string | undefined> = {}
  for (const k of ENV_KEYS) snap[k] = Deno.env.get(k)
  return snap
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) Deno.env.delete(k)
    else Deno.env.set(k, snap[k]!)
  }
  globalThis.fetch = ORIGINAL_FETCH
}

function setBaseEnv() {
  Deno.env.set("SUPABASE_URL", "http://localhost:54321")
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key-test")
}

type PerfilMock =
  | { kind: "none" }              // perfil ausente → []
  | { kind: "rol"; rol: string }  // perfil con ese rol → [{rol}]
  | { kind: "error" }             // error real de servidor → 500 no-JSON válido de PostgREST

function mockFetch(opts: {
  authThrows?: boolean
  authUser: { id: string } | null
  perfil?: PerfilMock
}) {
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

    if (url.includes("/auth/v1/user")) {
      if (opts.authThrows) {
        return Promise.reject(new TypeError("network error simulada"))
      }
      if (!opts.authUser) {
        return Promise.resolve(new Response(JSON.stringify({ message: "invalid token" }), { status: 401 }))
      }
      return Promise.resolve(
        new Response(JSON.stringify({ id: opts.authUser.id, aud: "authenticated", role: "authenticated" }), { status: 200 })
      )
    }

    if (url.includes("/rest/v1/perfiles")) {
      const p = opts.perfil ?? { kind: "none" }
      if (p.kind === "error") {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "internal error" }), { status: 500 })
        )
      }
      if (p.kind === "none") {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify([{ rol: p.rol }]), { status: 200 }))
    }

    throw new Error(`fetch no mockeado para esta prueba: ${url}`)
  }) as typeof fetch
}

function fakeRequest(withAuth = true): Request {
  return new Request("http://x/fn", {
    headers: withAuth ? { Authorization: "Bearer token-de-prueba" } : {},
  })
}

// ── AUTH ─────────────────────────────────────────────────────────────────
Deno.test("AUTH: sin Authorization = 401", async () => {
  const result = await requireSuperadmin(fakeRequest(false))
  assertEquals(result.ok, false)
  if (!result.ok) assertEquals(result.response.status, 401)
})

Deno.test("AUTH: JWT inválido (auth.getUser devuelve error) = 401", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  mockFetch({ authUser: null })
  const result = await requireSuperadmin(fakeRequest())
  assertEquals(result.ok, false)
  if (!result.ok) assertEquals(result.response.status, 401)
  restoreEnv(snap)
})

Deno.test("AUTH: auth.getUser lanza excepción = 401", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  mockFetch({ authThrows: true, authUser: null })
  const result = await requireSuperadmin(fakeRequest())
  assertEquals(result.ok, false)
  if (!result.ok) assertEquals(result.response.status, 401)
  restoreEnv(snap)
})

// ── PERFIL / ROL ─────────────────────────────────────────────────────────
const USER = { id: "11111111-1111-4111-8111-111111111111" }

Deno.test("ROL: perfil inexistente = 403", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  mockFetch({ authUser: USER, perfil: { kind: "none" } })
  const result = await requireSuperadmin(fakeRequest())
  assertEquals(result.ok, false)
  if (!result.ok) assertEquals(result.response.status, 403)
  restoreEnv(snap)
})

Deno.test("ROL: rol usuario = 403", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  mockFetch({ authUser: USER, perfil: { kind: "rol", rol: "usuario" } })
  const result = await requireSuperadmin(fakeRequest())
  assertEquals(result.ok, false)
  if (!result.ok) assertEquals(result.response.status, 403)
  restoreEnv(snap)
})

Deno.test("ROL: rol admin = 403", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  mockFetch({ authUser: USER, perfil: { kind: "rol", rol: "admin" } })
  const result = await requireSuperadmin(fakeRequest())
  assertEquals(result.ok, false)
  if (!result.ok) assertEquals(result.response.status, 403)
  restoreEnv(snap)
})

Deno.test("ROL: rol superadmin = autorizado", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  mockFetch({ authUser: USER, perfil: { kind: "rol", rol: "superadmin" } })
  const result = await requireSuperadmin(fakeRequest())
  assertEquals(result.ok, true)
  if (result.ok) assertEquals(result.user.id, USER.id)
  restoreEnv(snap)
})

Deno.test("PERFIL: error consultando perfil = 500", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  mockFetch({ authUser: USER, perfil: { kind: "error" } })
  const result = await requireSuperadmin(fakeRequest())
  assertEquals(result.ok, false)
  if (!result.ok) assertEquals(result.response.status, 500)
  restoreEnv(snap)
})

// ── SEGURIDAD ────────────────────────────────────────────────────────────
Deno.test("SEGURIDAD: requireSuperadmin nunca usa SUPABASE_SERVICE_ROLE_KEY", async () => {
  const snap = snapshotEnv()
  const prevServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY") // si el helper la necesitara, fallaría aquí
  setBaseEnv()
  mockFetch({ authUser: USER, perfil: { kind: "rol", rol: "superadmin" } })
  const result = await requireSuperadmin(fakeRequest())
  assertEquals(result.ok, true)
  if (prevServiceRole === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY")
  else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevServiceRole)
  restoreEnv(snap)
})
