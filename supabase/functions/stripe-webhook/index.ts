import Stripe from "npm:stripe@17"
import { createClient } from "npm:@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

// Misma fuente que crear-checkout (Sección P0) — evita que los 3 price IDs
// vivan duplicados en dos archivos. Si falta algún secret, ese price
// simplemente no aparece en el mapa y cualquier evento con ese priceId cae
// en la rama "desconocido" de manejarActualizacionSuscripcion (mismo
// tratamiento que un priceId genuinamente no reconocido: error explícito,
// nunca fallback silencioso a "basico").
const STRIPE_PRICE_BASICO = Deno.env.get("STRIPE_PRICE_BASICO")
const STRIPE_PRICE_PRO = Deno.env.get("STRIPE_PRICE_PRO")
const STRIPE_PRICE_PREMIUM = Deno.env.get("STRIPE_PRICE_PREMIUM")

const PRICE_ID_TO_PLAN: Record<string, string> = {}
if (STRIPE_PRICE_BASICO) PRICE_ID_TO_PLAN[STRIPE_PRICE_BASICO] = "basico"
if (STRIPE_PRICE_PRO) PRICE_ID_TO_PLAN[STRIPE_PRICE_PRO] = "pro"
if (STRIPE_PRICE_PREMIUM) PRICE_ID_TO_PLAN[STRIPE_PRICE_PREMIUM] = "premium"

const RANGO_PLAN: Record<string, number> = { basico: 0, pro: 1, premium: 2 }

// Un perfil debería tener una sola suscripción a la vez, pero no lo
// asumimos ciegamente (ver Sección Stripe — doble suscripción detectada en
// pruebas): el plan vigente de un perfil siempre se recalcula a partir de
// TODAS sus suscripciones en estado active/trialing guardadas en nuestra
// tabla (incluida la que se acaba de upsertear/cancelar, ya reflejada ahí
// antes de llamar esto), tomando la de mayor jerarquía. Si no queda
// ninguna activa, "basico".
async function resolverPlanVigente(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("suscripciones")
    .select("stripe_price_id")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])

  if (error) {
    console.error("stripe-webhook: error resolviendo plan vigente", userId, error)
    throw new Error(`No se pudo resolver el plan vigente para perfil ${userId}`)
  }

  let planFinal = "basico"
  for (const row of data ?? []) {
    const plan = PRICE_ID_TO_PLAN[row.stripe_price_id]
    if (plan && RANGO_PLAN[plan] > RANGO_PLAN[planFinal]) planFinal = plan
  }
  return planFinal
}

export async function handler(req: Request): Promise<Response> {
  const signature = req.headers.get("Stripe-Signature")
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret)
  } catch (err) {
    console.error("stripe-webhook: firma inválida", err)
    return new Response("Webhook signature verification failed", { status: 400 })
  }

  // Idempotencia: Stripe puede reenviar el mismo evento más de una vez
  // (timeout, reintento manual). Reclamamos el event.id ANTES de procesar;
  // si ya existía, es un reenvío de un evento ya procesado — respondemos
  // 200 sin volver a ejecutar el switch de negocio.
  const { error: eventInsertError } = await supabase
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type })

  if (eventInsertError) {
    if (eventInsertError.code === "23505") {
      console.log(`stripe-webhook: evento ${event.id} (${event.type}) ya procesado — ignorando reenvío`)
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
      })
    }
    // Error real de BD (no de duplicado): no sabemos si ya se procesó,
    // mejor dejar que Stripe reintente en vez de arriesgar un evento perdido.
    console.error(`stripe-webhook: error registrando idempotencia para ${event.id}`, eventInsertError)
    return new Response(JSON.stringify({ error: "Error interno procesando el evento" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await manejarActualizacionSuscripcion(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await manejarCancelacion(subscription)
        break
      }

      default:
        console.log(`stripe-webhook: evento no manejado: ${event.type}`)
    }
  } catch (err) {
    // Cualquier fallo de BD, o un priceId que no reconocemos, llega aquí.
    // Devolvemos 500 a propósito — Stripe reintenta automáticamente los
    // webhooks que fallan, y NO queremos responder 200 si el evento en
    // realidad no se procesó.
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`stripe-webhook: error procesando evento ${event.id} (${event.type}): ${msg}`)
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

async function manejarActualizacionSuscripcion(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0].price.id

  // maybeSingle() (no single()): con 0 filas devuelve {data:null,error:null}
  // en vez de un error — así distinguimos "no hay perfil para este
  // customer" (caso esperado, no es un fallo) de un error real de consulta.
  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()

  if (perfilError) {
    console.error("stripe-webhook: error SELECT perfiles para customer", customerId, perfilError)
    throw new Error(`No se pudo leer el perfil para customer ${customerId}`)
  }
  if (!perfil) {
    // No es un error de BD — puede ser un customer de prueba, o un evento
    // que no corresponde a esta app. Reintentar esto para siempre no lo
    // resuelve, así que no relanzamos.
    console.log("stripe-webhook: sin perfil para customer (evento ignorado)", customerId)
    return
  }

  const plan = PRICE_ID_TO_PLAN[priceId]
  if (!plan) {
    // priceId desconocido: NUNCA hacemos fallback silencioso a "basico".
    // Puede ser un price real que falta en STRIPE_PRICE_BASICO/PRO/PREMIUM
    // (error de configuración) o un price ajeno a esta app — en cualquier
    // caso, tratarlo como "basico" sin más sería mentirle a los datos.
    // Cortamos ANTES de escribir nada, y dejamos que Stripe reintente
    // mientras se corrige la configuración.
    console.error(
      `stripe-webhook: priceId desconocido "${priceId}" para customer ${customerId} — ` +
      `no coincide con STRIPE_PRICE_BASICO/PRO/PREMIUM. No se modifica plan_membresia.`
    )
    throw new Error(`priceId desconocido: ${priceId}`)
  }

  // Desde la API 2025-06-30.basil, Stripe movió current_period_end del
  // objeto subscription al nivel de cada item (soporte de múltiples
  // precios con ciclos de facturación distintos por suscripción). Leemos
  // primero del item (lugar nuevo) y caemos al campo viejo si existiera,
  // en vez de asumir un solo lugar y tronar con un valor undefined.
  // deno-lint-ignore no-explicit-any
  const itemConPeriodo = subscription.items.data[0] as any
  const currentPeriodEndRaw: number | null | undefined =
    itemConPeriodo?.current_period_end ?? (subscription as unknown as { current_period_end?: number }).current_period_end

  const { error: upsertError } = await supabase.from("suscripciones").upsert({
    user_id: perfil.id,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: subscription.status,
    current_period_end: currentPeriodEndRaw != null ? new Date(currentPeriodEndRaw * 1000).toISOString() : null,
  }, { onConflict: "stripe_subscription_id" })

  if (upsertError) {
    console.error("stripe-webhook: error UPSERT suscripciones", subscription.id, upsertError)
    throw new Error(`No se pudo guardar la suscripción ${subscription.id}`)
  }

  // El estado de esta suscripción ya quedó reflejado en suscripciones.status
  // arriba (upsert); resolverPlanVigente relee de ahí considerando TODAS
  // las suscripciones del perfil, no solo esta.
  const planFinal = await resolverPlanVigente(perfil.id)

  const { error: updateError } = await supabase
    .from("perfiles")
    .update({ plan_membresia: planFinal })
    .eq("id", perfil.id)

  if (updateError) {
    console.error("stripe-webhook: error UPDATE perfiles.plan_membresia", perfil.id, updateError)
    throw new Error(`No se pudo actualizar plan_membresia para perfil ${perfil.id}`)
  }
}

// Restaurada a partir de la implementación funcional del commit 929ac16
// (perdida en 77307cf), con el mismo manejo de errores que el resto del
// archivo.
async function manejarCancelacion(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()

  if (perfilError) {
    console.error("stripe-webhook: error SELECT perfiles (cancelación) para customer", customerId, perfilError)
    throw new Error(`No se pudo leer el perfil para customer ${customerId}`)
  }
  if (!perfil) {
    console.log("stripe-webhook: sin perfil para customer (cancelación ignorada)", customerId)
    return
  }

  const { error: cancelError } = await supabase
    .from("suscripciones")
    .update({ status: "canceled" })
    .eq("stripe_subscription_id", subscription.id)

  if (cancelError) {
    console.error("stripe-webhook: error UPDATE suscripciones (cancelación)", subscription.id, cancelError)
    throw new Error(`No se pudo marcar como cancelada la suscripción ${subscription.id}`)
  }

  // No asumir "basico" a ciegas: en teoría un perfil solo debería tener una
  // suscripción a la vez, pero si llegara a tener más de una activa en
  // paralelo (ej. datos de prueba, o un caso no previsto), cancelar UNA no
  // debe degradar a alguien que todavía tiene otra vigente. La fila de
  // ESTA suscripción ya quedó en status='canceled' arriba, así que
  // resolverPlanVigente (que solo cuenta active/trialing) la excluye sola.
  const planFinal = await resolverPlanVigente(perfil.id)

  const { error: updateError } = await supabase
    .from("perfiles")
    .update({ plan_membresia: planFinal })
    .eq("id", perfil.id)

  if (updateError) {
    console.error("stripe-webhook: error UPDATE perfiles.plan_membresia (cancelación)", perfil.id, updateError)
    throw new Error(`No se pudo actualizar plan_membresia (cancelación) para perfil ${perfil.id}`)
  }
}
