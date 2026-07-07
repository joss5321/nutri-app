import Stripe from "npm:stripe@17"
import { createClient } from "npm:@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)

Deno.serve(async (req) => {
  const { priceId, userId } = await req.json()

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single()

  let customerId = perfil?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { user_id: userId } })
    customerId = customer.id
    await supabase.from("perfiles").update({ stripe_customer_id: customerId }).eq("id", userId)
  }

  // Para móvil, usamos un PaymentSheet (Payment Intent + Ephemeral Key)
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: "2024-06-20" }
  )

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice.payment_intent"],
  })

  const paymentIntent = subscription.latest_invoice.payment_intent

  return new Response(JSON.stringify({
    paymentIntent: paymentIntent.client_secret,
    ephemeralKey: ephemeralKey.secret,
    customerId,
  }), { headers: { "Content-Type": "application/json" } })
})