// Tests locales del fix P0 de crear-checkout — NO tocan Stripe ni Supabase
// reales. Mockean globalThis.fetch únicamente para la llamada a
// GET {SUPABASE_URL}/auth/v1/user que hace supabaseUser.auth.getUser().
//
// Cobertura real de este archivo: HTTP/método, AUTH, y CONFIG/PRICE (todos
// los casos que el handler resuelve ANTES de tocar Supabase REST (perfiles)
// o Stripe). Los casos de PERFIL (SELECT/UPDATE), CUSTOMER
// (reutilizar/crear) y concurrencia/idempotencia requieren mockear también
// la REST de Postgres y la API de Stripe de forma creíble — no se
// intentan aquí por el riesgo de que un mock incorrecto dé falsa
// confianza; esos casos se validan con smoke tests reales en modo test de
// Stripe después del deploy (ver reporte).
//
// Correr con: deno test --allow-env --allow-net supabase/functions/crear-checkout/index.test.ts
// (--allow-net es necesario porque los imports npm:/jsr: se resuelven por red
// la primera vez; el propio test mockea fetch para no llamar servicios reales)

import { assertEquals } from "jsr:@std/assert@1"

// index.ts instancia `new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)` a
// nivel de módulo (top-level) — un `import` estático se resuelve antes que
// cualquier código de este archivo, así que STRIPE_SECRET_KEY no existiría
// todavía al cargarlo. Se fija el env var primero y se usa import()
// dinámico, que sí se ejecuta en el punto donde aparece.
Deno.env.set("STRIPE_SECRET_KEY", "sk_test_dummy_for_tests")
const { handler, getAllowedPriceIds } = await import("./index.ts")

const ORIGINAL_FETCH = globalThis.fetch
const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_BASICO",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_PREMIUM",
] as const

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
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-test")
  Deno.env.set("STRIPE_SECRET_KEY", "sk_test_dummy")
}

function setPriceEnv() {
  Deno.env.set("STRIPE_PRICE_BASICO", "price_basico")
  Deno.env.set("STRIPE_PRICE_PRO", "price_pro")
  Deno.env.set("STRIPE_PRICE_PREMIUM", "price_premium")
}

function mockFetchAuthUser(user: { id: string } | null) {
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes("/auth/v1/user")) {
      if (!user) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "invalid token" }), { status: 401 })
        )
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ id: user.id, aud: "authenticated", role: "authenticated", email: "test@test.local" }),
          { status: 200 }
        )
      )
    }
    throw new Error(`fetch no mockeado para esta prueba: ${url}`)
  }) as typeof fetch
}

// ── getAllowedPriceIds() — pura, sin red ────────────────────────────────
Deno.test("CONFIG: getAllowedPriceIds() = null si falta cualquiera de los 3 secrets", () => {
  const snap = snapshotEnv()
  Deno.env.delete("STRIPE_PRICE_BASICO")
  Deno.env.set("STRIPE_PRICE_PRO", "price_pro")
  Deno.env.set("STRIPE_PRICE_PREMIUM", "price_premium")
  assertEquals(getAllowedPriceIds(), null)
  restoreEnv(snap)
})

Deno.test("CONFIG: getAllowedPriceIds() = Set con los 3 si están completos", () => {
  const snap = snapshotEnv()
  setPriceEnv()
  const ids = getAllowedPriceIds()
  assertEquals(ids?.has("price_basico"), true)
  assertEquals(ids?.has("price_pro"), true)
  assertEquals(ids?.has("price_premium"), true)
  assertEquals(ids?.size, 3)
  restoreEnv(snap)
})

// ── HTTP / método ────────────────────────────────────────────────────────
Deno.test("HTTP: OPTIONS responde 200 sin tocar auth/Stripe", async () => {
  const res = await handler(new Request("http://x/crear-checkout", { method: "OPTIONS" }))
  assertEquals(res.status, 200)
})

Deno.test("HTTP: GET responde 405", async () => {
  const res = await handler(new Request("http://x/crear-checkout", { method: "GET" }))
  assertEquals(res.status, 405)
})

// ── AUTH ─────────────────────────────────────────────────────────────────
Deno.test("AUTH: POST sin Authorization = 401", async () => {
  const res = await handler(new Request("http://x/crear-checkout", {
    method: "POST",
    body: JSON.stringify({ priceId: "price_basico" }),
  }))
  assertEquals(res.status, 401)
})

Deno.test("AUTH: POST con JWT inválido (auth.getUser falla) = 401", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  mockFetchAuthUser(null)
  const res = await handler(new Request("http://x/crear-checkout", {
    method: "POST",
    headers: { Authorization: "Bearer token-invalido" },
    body: JSON.stringify({ priceId: "price_basico" }),
  }))
  assertEquals(res.status, 401)
  restoreEnv(snap)
})

// ── CONFIG / PRICE (JWT válido, sin llegar a perfiles/Stripe) ───────────
Deno.test("CONFIG: JWT válido pero faltan secrets de precio = 500", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  // Deliberadamente NO se configuran STRIPE_PRICE_*
  mockFetchAuthUser({ id: "11111111-1111-4111-8111-111111111111" })
  const res = await handler(new Request("http://x/crear-checkout", {
    method: "POST",
    headers: { Authorization: "Bearer token-valido" },
    body: JSON.stringify({ priceId: "price_basico" }),
  }))
  assertEquals(res.status, 500)
  restoreEnv(snap)
})

Deno.test("PRICE: JWT y secrets válidos, priceId fuera de la allowlist = 400", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  setPriceEnv()
  mockFetchAuthUser({ id: "11111111-1111-4111-8111-111111111111" })
  const res = await handler(new Request("http://x/crear-checkout", {
    method: "POST",
    headers: { Authorization: "Bearer token-valido" },
    body: JSON.stringify({ priceId: "price_no_existe" }),
  }))
  assertEquals(res.status, 400)
  restoreEnv(snap)
})

Deno.test("IDENTIDAD: userId ajeno en el body no cambia el resultado (sigue evaluando solo priceId)", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  setPriceEnv()
  mockFetchAuthUser({ id: "11111111-1111-4111-8111-111111111111" })
  const res = await handler(new Request("http://x/crear-checkout", {
    method: "POST",
    headers: { Authorization: "Bearer token-valido" },
    body: JSON.stringify({ priceId: "price_no_existe", userId: "22222222-2222-4222-8222-222222222222" }),
  }))
  // Sigue siendo 400 por el priceId inválido — el userId ajeno del body no
  // desvía el flujo ni produce un resultado distinto.
  assertEquals(res.status, 400)
  restoreEnv(snap)
})

Deno.test("HTTP: JSON malformado (JWT y config válidos) = 400", async () => {
  const snap = snapshotEnv()
  setBaseEnv()
  setPriceEnv()
  mockFetchAuthUser({ id: "11111111-1111-4111-8111-111111111111" })
  const res = await handler(new Request("http://x/crear-checkout", {
    method: "POST",
    headers: { Authorization: "Bearer token-valido" },
    body: "{ esto no es json",
  }))
  assertEquals(res.status, 400)
  restoreEnv(snap)
})
