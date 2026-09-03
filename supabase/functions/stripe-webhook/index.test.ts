// Tests del hotfix P0 de stripe-webhook. No llaman a Stripe ni a Supabase
// reales.
//
// La firma Stripe-Signature se genera con el esquema HMAC-SHA256 público y
// documentado de Stripe (t=<timestamp>,v1=<hex(HMAC-SHA256(secret,
// `${timestamp}.${payload}`))>), implementado aquí con Web Crypto nativo de
// Deno — no depende de ningún helper de la SDK cuya firma exacta no se
// pudiera verificar de antemano. constructEventAsync() no hace ninguna
// llamada de red (es criptografía local), así que esto prueba la
// verificación real, sin mockear.
//
// Las llamadas a Postgres (perfiles/suscripciones) sí se mockean vía
// globalThis.fetch, con el mismo formato de respuesta de PostgREST ya
// verificado en rondas anteriores (array vacío = 0 filas para
// maybeSingle(), array con un elemento = fila encontrada, status no-2xx =
// error real).
//
// Correr con: deno test --config supabase/functions/deno.json --allow-env --allow-net supabase/functions/stripe-webhook/index.test.ts

import { assertEquals } from "jsr:@std/assert@1"

const WEBHOOK_SECRET = "whsec_test_dummy_secret"

Deno.env.set("SUPABASE_URL", "http://localhost:54321")
Deno.env.set("SUPABASE_ANON_KEY", "anon-key-test")
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-test")
Deno.env.set("STRIPE_SECRET_KEY", "sk_test_dummy")
Deno.env.set("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET)
Deno.env.set("STRIPE_PRICE_BASICO", "price_basico_test")
Deno.env.set("STRIPE_PRICE_PRO", "price_pro_test")
Deno.env.set("STRIPE_PRICE_PREMIUM", "price_premium_test")

const { handler } = await import("./index.ts")

// ── Firma Stripe real (HMAC-SHA256), sin mocks ──────────────────────────
async function signStripePayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload))
  const sigHex = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("")
  return `t=${timestamp},v1=${sigHex}`
}

function stripeEvent(id: string, type: string, dataObject: Record<string, unknown>) {
  return JSON.stringify({ id, object: "event", type, data: { object: dataObject } })
}

const CUSTOMER_ID = "cus_test_123"
const PERFIL_ID = "11111111-1111-4111-8111-111111111111"

function subscriptionObject(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_test_123",
    customer: CUSTOMER_ID,
    status: "active",
    items: { data: [{ price: { id: "price_basico_test" } }] },
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    ...overrides,
  }
}

type PerfilMock = { kind: "none" } | { kind: "found" } | { kind: "error" }

function mockFetch(opts: {
  perfil?: PerfilMock
  upsertError?: boolean
  updatePerfilError?: boolean
  updateSuscripcionError?: boolean
}) {
  const capturedBodies: { url: string; method: string; body: unknown }[] = []

  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
    if (init?.body) {
      try { capturedBodies.push({ url, method, body: JSON.parse(init.body as string) }) } catch { /* noop */ }
    }

    if (url.includes("/rest/v1/perfiles") && method === "GET") {
      const p = opts.perfil ?? { kind: "found" }
      if (p.kind === "error") {
        return Promise.resolve(new Response(JSON.stringify({ message: "db error" }), { status: 500 }))
      }
      if (p.kind === "none") {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify([{ id: PERFIL_ID }]), { status: 200 }))
    }

    if (url.includes("/rest/v1/suscripciones") && method === "POST") {
      // upsert
      if (opts.upsertError) {
        return Promise.resolve(new Response(JSON.stringify({ message: "upsert failed" }), { status: 500 }))
      }
      return Promise.resolve(new Response(JSON.stringify([{ id: "row-1" }]), { status: 201 }))
    }

    if (url.includes("/rest/v1/suscripciones") && method === "PATCH") {
      // update (cancelación)
      if (opts.updateSuscripcionError) {
        return Promise.resolve(new Response(JSON.stringify({ message: "update failed" }), { status: 500 }))
      }
      return Promise.resolve(new Response(JSON.stringify([{ id: "row-1" }]), { status: 200 }))
    }

    if (url.includes("/rest/v1/perfiles") && method === "PATCH") {
      if (opts.updatePerfilError) {
        return Promise.resolve(new Response(JSON.stringify({ message: "update failed" }), { status: 500 }))
      }
      return Promise.resolve(new Response(JSON.stringify([{ id: PERFIL_ID }]), { status: 200 }))
    }

    throw new Error(`fetch no mockeado para esta prueba: ${method} ${url}`)
  }) as typeof fetch

  return { capturedBodies }
}

async function postEvent(payload: string, signature?: string): Promise<Response> {
  return await handler(new Request("http://x/stripe-webhook", {
    method: "POST",
    headers: signature ? { "Stripe-Signature": signature } : {},
    body: payload,
  }))
}

// ── FIRMA ────────────────────────────────────────────────────────────────
Deno.test("FIRMA: sin Stripe-Signature = 400", async () => {
  mockFetch({})
  const payload = stripeEvent("evt_1", "customer.subscription.created", subscriptionObject())
  const res = await postEvent(payload)
  assertEquals(res.status, 400)
})

Deno.test("FIRMA: Stripe-Signature inválida = 400", async () => {
  mockFetch({})
  const payload = stripeEvent("evt_1", "customer.subscription.created", subscriptionObject())
  const res = await postEvent(payload, "t=1,v1=firmaInventada")
  assertEquals(res.status, 400)
})

// ── EVENTOS VÁLIDOS ──────────────────────────────────────────────────────
Deno.test("EVENTO: customer.subscription.created válido — escribe suscripción + perfil", async () => {
  mockFetch({ perfil: { kind: "found" } })
  const payload = stripeEvent("evt_2", "customer.subscription.created", subscriptionObject())
  const signature = await signStripePayload(payload, WEBHOOK_SECRET)
  const res = await postEvent(payload, signature)
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.received, true)
})

Deno.test("EVENTO: customer.subscription.updated válido — actualiza correctamente", async () => {
  mockFetch({ perfil: { kind: "found" } })
  const payload = stripeEvent("evt_3", "customer.subscription.updated", subscriptionObject({ status: "past_due" }))
  const signature = await signStripePayload(payload, WEBHOOK_SECRET)
  const res = await postEvent(payload, signature)
  assertEquals(res.status, 200)
})

Deno.test("EVENTO: customer.subscription.deleted — status canceled + perfil basico (valores reales verificados)", async () => {
  const { capturedBodies } = mockFetch({ perfil: { kind: "found" } })
  const payload = stripeEvent("evt_4", "customer.subscription.deleted", subscriptionObject({ status: "canceled" }))
  const signature = await signStripePayload(payload, WEBHOOK_SECRET)
  const res = await postEvent(payload, signature)
  assertEquals(res.status, 200)

  const suscripcionUpdate = capturedBodies.find((b) => b.url.includes("/suscripciones") && b.method === "PATCH")
  assertEquals((suscripcionUpdate?.body as { status?: string })?.status, "canceled")

  const perfilUpdate = capturedBodies.find((b) => b.url.includes("/perfiles") && b.method === "PATCH")
  assertEquals((perfilUpdate?.body as { plan_membresia?: string })?.plan_membresia, "basico")
})

Deno.test("ERROR: fallo en UPDATE suscripciones (cancelación) = 500", async () => {
  mockFetch({ perfil: { kind: "found" }, updateSuscripcionError: true })
  const payload = stripeEvent("evt_4b", "customer.subscription.deleted", subscriptionObject({ status: "canceled" }))
  const signature = await signStripePayload(payload, WEBHOOK_SECRET)
  const res = await postEvent(payload, signature)
  assertEquals(res.status, 500)
})

Deno.test("EVENTO: perfil no encontrado — 200, ignorado explícitamente (no es un error)", async () => {
  mockFetch({ perfil: { kind: "none" } })
  const payload = stripeEvent("evt_5", "customer.subscription.created", subscriptionObject())
  const signature = await signStripePayload(payload, WEBHOOK_SECRET)
  const res = await postEvent(payload, signature)
  assertEquals(res.status, 200)
})

Deno.test("EVENTO: no manejado (ej. invoice.paid) — 200 sin escrituras", async () => {
  globalThis.fetch = (() => {
    throw new Error("no debería llamar a fetch para un evento no manejado")
  }) as typeof fetch
  const payload = stripeEvent("evt_6", "invoice.paid", { id: "in_test" })
  const signature = await signStripePayload(payload, WEBHOOK_SECRET)
  const res = await postEvent(payload, signature)
  assertEquals(res.status, 200)
})

// ── ERRORES DE BD ────────────────────────────────────────────────────────
Deno.test("ERROR: fallo en SELECT perfiles = 500", async () => {
  mockFetch({ perfil: { kind: "error" } })
  const payload = stripeEvent("evt_7", "customer.subscription.created", subscriptionObject())
  const signature = await signStripePayload(payload, WEBHOOK_SECRET)
  const res = await postEvent(payload, signature)
  assertEquals(res.status, 500)
})

Deno.test("ERROR: fallo en UPSERT suscripciones = 500", async () => {
  mockFetch({ perfil: { kind: "found" }, upsertError: true })
  const payload = stripeEvent("evt_8", "customer.subscription.created", subscriptionObject())
  const signature = await signStripePayload(payload, WEBHOOK_SECRET)
  const res = await postEvent(payload, signature)
  assertEquals(res.status, 500)
})

Deno.test("ERROR: fallo en UPDATE perfiles.plan_membresia = 500", async () => {
  mockFetch({ perfil: { kind: "found" }, updatePerfilError: true })
  const payload = stripeEvent("evt_9", "customer.subscription.created", subscriptionObject())
  const signature = await signStripePayload(payload, WEBHOOK_SECRET)
  const res = await postEvent(payload, signature)
  assertEquals(res.status, 500)
})

Deno.test("ERROR: priceId desconocido — nunca fallback silencioso, siempre error", async () => {
  mockFetch({ perfil: { kind: "found" } })
  const payload = stripeEvent(
    "evt_10",
    "customer.subscription.created",
    subscriptionObject({ items: { data: [{ price: { id: "price_NO_EXISTE" } }] } }),
  )
  const signature = await signStripePayload(payload, WEBHOOK_SECRET)
  const res = await postEvent(payload, signature)
  assertEquals(res.status, 500)
})
