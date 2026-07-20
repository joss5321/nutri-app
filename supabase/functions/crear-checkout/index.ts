import Stripe from "npm:stripe@17"
import { createClient } from "npm:@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const { priceId, userId } = await req.json()

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Buscar o crear el Stripe Customer
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("stripe_customer_id, email")
    .eq("id", userId)
    .single()

  let customerId = perfil?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: perfil?.email ?? undefined,
      metadata: { user_id: userId },
    })
    customerId = customer.id
    await supabase.from("perfiles").update({ stripe_customer_id: customerId }).eq("id", userId)
  }

  // Crear Checkout Session (se abre en el navegador del teléfono)
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: "mobileapp://perfil?payment=success",
    cancel_url:  "mobileapp://perfil?payment=cancel",
    metadata: { user_id: userId },
  })

  return new Response(
    JSON.stringify({ url: session.url }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
