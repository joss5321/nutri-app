import Stripe from "npm:stripe@17"
import { createClient } from "npm:@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

// Allowlist server-side de precios reales. No existía ninguna convención
// previa de secrets para esto (stripe-webhook mantiene su propia copia
// hardcodeada de los mismos 3 price IDs); se introducen estos 3 secrets
// nuevos. Si falta alguno, es un error de configuración del servidor, NO
// un priceId inválido — se distinguen con status codes distintos (500 vs
// 400) para no confundir un secret faltante con un plan mal formado.
export function getAllowedPriceIds(): Set<string> | null {
  const basico = Deno.env.get("STRIPE_PRICE_BASICO")
  const pro = Deno.env.get("STRIPE_PRICE_PRO")
  const premium = Deno.env.get("STRIPE_PRICE_PREMIUM")
  if (!basico || !pro || !premium) return null
  return new Set([basico, pro, premium])
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405)
  }

  // El gateway (verify_jwt=true) ya exige un Authorization: Bearer <JWT>
  // válido para llegar hasta aquí. auth.getUser() es lo que obtiene y
  // verifica la identidad REAL del caller a partir de ese JWT — un userId
  // en el body (si un cliente viejo todavía lo manda) nunca se lee ni se
  // compara.
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return jsonResponse({ error: "No autorizado" }, 401)
  }

  try {
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: "No autorizado" }, 401)
    }

    const allowedPriceIds = getAllowedPriceIds()
    if (!allowedPriceIds) {
      console.error("crear-checkout: faltan uno o más de STRIPE_PRICE_BASICO/PRO/PREMIUM")
      return jsonResponse({ error: "Configuración de pagos no disponible" }, 500)
    }

    let body: { priceId?: string }
    try {
      body = await req.json()
    } catch (err) {
      console.error("crear-checkout: body JSON inválido", err)
      return jsonResponse({ error: "Solicitud inválida" }, 400)
    }
    const { priceId } = body

    if (!priceId || !allowedPriceIds.has(priceId)) {
      return jsonResponse({ error: "Plan inválido" }, 400)
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: perfil, error: perfilError } = await supabase
      .from("perfiles")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .single()

    if (perfilError || !perfil) {
      console.error("crear-checkout: error leyendo perfil", user.id, perfilError)
      return jsonResponse({ error: "No se pudo verificar tu cuenta" }, 500)
    }

    let customerId = perfil.stripe_customer_id
    const userId = user.id
    const userEmail = perfil.email

    async function crearYGuardarCustomer(): Promise<string> {
      // idempotencyKey estable por usuario: si dos requests casi simultáneas
      // (doble tap, retry de red) llegan antes de que el UPDATE de abajo
      // complete, Stripe devuelve el MISMO customer para ambas en vez de
      // crear dos. Válido solo durante la ventana de idempotencia de Stripe
      // (24h) — pasado ese lapso un reintento genuino crearía un customer
      // nuevo; límite conocido de Stripe, no deduplicación permanente.
      const customer = await stripe.customers.create(
        { email: userEmail ?? undefined, metadata: { user_id: userId } },
        { idempotencyKey: `checkout-customer-${userId}-${Date.now()}` }
      )

      const { data: updated, error: updateError } = await supabase
        .from("perfiles")
        .update({ stripe_customer_id: customer.id })
        .eq("id", userId)
        .select("id")

      if (updateError || !updated || updated.length === 0) {
        console.error("crear-checkout: no se pudo persistir stripe_customer_id", userId, updateError)
        throw new Error("No se pudo completar el registro de pago")
      }
      return customer.id
    }

    if (!customerId) {
      customerId = await crearYGuardarCustomer()
    }

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: "mobileapp://perfil?payment=success",
        cancel_url:  "mobileapp://perfil?payment=cancel",
        metadata: { user_id: user.id },
      })
    } catch (err) {
      // Autorreparación: si el stripe_customer_id guardado ya no existe en
      // Stripe (ej. la cuenta/clave de Stripe cambió, o se borró en el
      // dashboard), Stripe responde "No such customer" — en vez de fallar,
      // creamos un customer nuevo y reintentamos una sola vez.
      const esCustomerInexistente =
        err instanceof Stripe.errors.StripeInvalidRequestError &&
        err.param === "customer"
      if (!esCustomerInexistente) throw err

      console.log("crear-checkout: stripe_customer_id obsoleto, recreando customer", user.id, customerId)
      customerId = await crearYGuardarCustomer()
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: "mobileapp://perfil?payment=success",
        cancel_url:  "mobileapp://perfil?payment=cancel",
        metadata: { user_id: user.id },
      })
    }

    return jsonResponse({ url: session.url })
  } catch (err) {
    console.error("crear-checkout: error inesperado", err)
    return jsonResponse({ error: "No se pudo procesar el pago" }, 502)
  }
}

Deno.serve(handler)
