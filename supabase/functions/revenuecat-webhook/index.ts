import { createClient } from "npm:@supabase/supabase-js@2"

const webhookAuthHeader = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER")!

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

// Mismo mapa que stripe-webhook/index.ts (duplicado ahí también desde
// planes.ts) — se necesita para que resolverPlanVigenteUnificado pueda
// seguir viendo las suscripciones Stripe de legado al calcular el plan
// vigente, sin importar ese archivo (no se toca, por diseño).
const STRIPE_PRICE_BASICO = Deno.env.get("STRIPE_PRICE_BASICO")
const STRIPE_PRICE_PRO = Deno.env.get("STRIPE_PRICE_PRO")
const STRIPE_PRICE_PREMIUM = Deno.env.get("STRIPE_PRICE_PREMIUM")

const STRIPE_PRICE_ID_TO_PLAN: Record<string, string> = {}
if (STRIPE_PRICE_BASICO) STRIPE_PRICE_ID_TO_PLAN[STRIPE_PRICE_BASICO] = "basico"
if (STRIPE_PRICE_PRO) STRIPE_PRICE_ID_TO_PLAN[STRIPE_PRICE_PRO] = "pro"
if (STRIPE_PRICE_PREMIUM) STRIPE_PRICE_ID_TO_PLAN[STRIPE_PRICE_PREMIUM] = "premium"

const RANGO_PLAN: Record<string, number> = { basico: 0, pro: 1, premium: 2 }

type FilaSuscripcion = {
  provider: string
  plan_key: string | null
  stripe_price_id: string | null
}

// Lee TODAS las suscripciones activas/trialing del perfil, de ambos
// proveedores, y toma la de mayor jerarquía — mismo principio que
// resolverPlanVigente en stripe-webhook, extendido a multi-proveedor.
// Vive aquí (no compartida con ese archivo) para no tocarlo.
async function resolverPlanVigenteUnificado(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("suscripciones")
    .select("provider, plan_key, stripe_price_id")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])

  if (error) {
    console.error("revenuecat-webhook: error resolviendo plan vigente", userId, error)
    throw new Error(`No se pudo resolver el plan vigente para perfil ${userId}`)
  }

  let planFinal = "basico"
  for (const row of (data ?? []) as FilaSuscripcion[]) {
    const plan = row.provider === "revenuecat"
      ? row.plan_key
      : (row.stripe_price_id ? STRIPE_PRICE_ID_TO_PLAN[row.stripe_price_id] : null)
    if (plan && RANGO_PLAN[plan] > RANGO_PLAN[planFinal]) planFinal = plan
  }
  return planFinal
}

export async function handler(req: Request): Promise<Response> {
  // RevenueCat no firma el payload criptográficamente — envía de vuelta,
  // tal cual, el valor estático que se configura en su dashboard
  // (Project Settings → Integrations → Webhooks). Se compara contra ese
  // mismo valor guardado como secret.
  const authHeader = req.headers.get("Authorization")
  if (!authHeader || authHeader !== webhookAuthHeader) {
    console.error("revenuecat-webhook: Authorization header ausente o incorrecto")
    return new Response("Unauthorized", { status: 401 })
  }

  let body: {
    event: {
      id: string
      type: string
      app_user_id: string
      entitlement_ids?: string[]
      expiration_at_ms?: number | null
      original_transaction_id: string
    }
  }
  try {
    body = await req.json()
  } catch (err) {
    console.error("revenuecat-webhook: body JSON inválido", err)
    return new Response("Invalid JSON body", { status: 400 })
  }

  const event = body.event
  if (!event?.id || !event?.type) {
    console.error("revenuecat-webhook: evento sin id/type", body)
    return new Response("Invalid event payload", { status: 400 })
  }

  // Idempotencia: RevenueCat puede reenviar el mismo evento más de una
  // vez. Reclamamos el event.id ANTES de procesar — mismo patrón que
  // stripe_webhook_events.
  const { error: eventInsertError } = await supabase
    .from("revenuecat_webhook_events")
    .insert({ event_id: event.id, event_type: event.type })

  if (eventInsertError) {
    if (eventInsertError.code === "23505") {
      console.log(`revenuecat-webhook: evento ${event.id} (${event.type}) ya procesado — ignorando reenvío`)
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
      })
    }
    console.error(`revenuecat-webhook: error registrando idempotencia para ${event.id}`, eventInsertError)
    return new Response(JSON.stringify({ error: "Error interno procesando el evento" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    await procesarEvento(event)
  } catch (err) {
    // Mismo criterio que stripe-webhook: 500 a propósito para que
    // RevenueCat reintente — nunca responder 200 si en realidad no se
    // proceso.
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`revenuecat-webhook: error procesando evento ${event.id} (${event.type}): ${msg}`)
    return new Response(JSON.stringify({ error: "Error interno procesando el evento" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  })
}

Deno.serve(handler)

// Un solo camino para todos los tipos de evento (no un switch por tipo
// como en stripe-webhook): INITIAL_PURCHASE/RENEWAL/PRODUCT_CHANGE y
// CANCELLATION/EXPIRATION se resuelven igual a partir de expiration_at_ms
// real — no hace falta distinguir el tipo para decidir el status.
async function procesarEvento(event: {
  app_user_id: string
  entitlement_ids?: string[]
  expiration_at_ms?: number | null
  original_transaction_id: string
}) {
  // app_user_id YA es perfiles.id/auth.uid() porque el cliente configura
  // Purchases.configure({ appUserID: auth.uid() }) — sin indirección como
  // stripe_customer_id.
  const userId = event.app_user_id

  const entitlements = event.entitlement_ids ?? []
  const planKey = entitlements.includes("premium")
    ? "premium"
    : entitlements.includes("pro")
      ? "pro"
      : null

  if (!planKey) {
    // Nunca adivinar: un entitlement fuera de pro/premium (o un evento de
    // prueba sin entitlements) no debe escribir nada.
    console.log(`revenuecat-webhook: sin entitlement pro/premium reconocible para ${userId} — evento ignorado`, entitlements)
    return
  }

  // app_user_id debería ser siempre un auth.uid() real porque el cliente
  // llama Purchases.configure({ appUserID: auth.uid() }) antes de poder
  // comprar — pero RevenueCat genera un id anónimo propio
  // ("$RCAnonymousID:...") para cualquier actividad anterior a esa
  // llamada. maybeSingle() (no single()) distingue "no hay perfil para
  // este id" (caso esperado, no es un fallo) de un error real de consulta.
  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle()

  if (perfilError) {
    console.error("revenuecat-webhook: error SELECT perfiles", userId, perfilError)
    throw new Error(`No se pudo leer el perfil ${userId}`)
  }
  if (!perfil) {
    console.log("revenuecat-webhook: sin perfil para app_user_id (evento ignorado)", userId)
    return
  }

  const expirationMs = event.expiration_at_ms ?? null
  const status = expirationMs === null || expirationMs > Date.now() ? "active" : "canceled"

  const { error: upsertError } = await supabase.from("suscripciones").upsert({
    user_id: userId,
    provider: "revenuecat",
    revenuecat_subscription_id: event.original_transaction_id,
    plan_key: planKey,
    status,
    current_period_end: expirationMs != null ? new Date(expirationMs).toISOString() : null,
  }, { onConflict: "revenuecat_subscription_id" })

  if (upsertError) {
    console.error("revenuecat-webhook: error UPSERT suscripciones", event.original_transaction_id, upsertError)
    throw new Error(`No se pudo guardar la suscripción ${event.original_transaction_id}`)
  }

  const planFinal = await resolverPlanVigenteUnificado(userId)

  const { error: updateError } = await supabase
    .from("perfiles")
    .update({ plan_membresia: planFinal })
    .eq("id", userId)

  if (updateError) {
    console.error("revenuecat-webhook: error UPDATE perfiles.plan_membresia", userId, updateError)
    throw new Error(`No se pudo actualizar plan_membresia para perfil ${userId}`)
  }
}
