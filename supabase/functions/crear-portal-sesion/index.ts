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

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405)
  }

  // Mismo patrón que crear-checkout: el gateway (verify_jwt=true) ya exige
  // un JWT válido; auth.getUser() resuelve la identidad real del caller.
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: perfil, error: perfilError } = await supabase
      .from("perfiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single()

    if (perfilError || !perfil) {
      console.error("crear-portal-sesion: error leyendo perfil", user.id, perfilError)
      return jsonResponse({ error: "No se pudo verificar tu cuenta" }, 500)
    }

    if (!perfil.stripe_customer_id) {
      return jsonResponse({ error: "No tienes una suscripción activa" }, 400)
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: perfil.stripe_customer_id,
      return_url: "mobileapp://perfil",
    })

    return jsonResponse({ url: session.url })
  } catch (err) {
    console.error("crear-portal-sesion: error inesperado", err)
    return jsonResponse({ error: "No se pudo abrir el portal de suscripción" }, 502)
  }
}

Deno.serve(handler)
