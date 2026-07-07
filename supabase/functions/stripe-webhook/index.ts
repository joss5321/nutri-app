import Stripe from "npm:stripe@17"
import { createClient } from "npm:@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature")
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret)
  } catch (err) {
    console.error("Firma inválida:", err)
    return new Response("Webhook signature verification failed", { status: 400 })
  }

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
      console.log(`Evento no manejado: ${event.type}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  })
})

async function manejarActualizacionSuscripcion(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single()

  if (!perfil) {
    console.error("No se encontró perfil para customer:", customerId)
    return
  }

  const esActiva = subscription.status === "active" || subscription.status === "trialing"

  // Guarda/actualiza el registro de la suscripción
  await supabase.from("suscripciones").upsert({
    user_id: perfil.id,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0].price.id,
    status: subscription.status,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  }, { onConflict: "stripe_subscription_id" })

  // Actualiza el plan en el perfil
  await supabase
    .from("perfiles")
    .update({ plan_membresia: esActiva ? "premium" : "basico" })
    .eq("id", perfil.id)
}

async function manejarCancelacion(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single()

  if (!perfil) return

  await supabase
    .from("suscripciones")
    .update({ status: "canceled" })
    .eq("stripe_subscription_id", subscription.id)

  await supabase
    .from("perfiles")
    .update({ plan_membresia: "basico" })
    .eq("id", perfil.id)
}