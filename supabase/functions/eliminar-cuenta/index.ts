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

// Elimina la cuenta del propio caller (nunca de un tercero — el id nunca
// viene del body, siempre de auth.getUser() sobre el JWT). Cumple la
// Guideline 5.1.1(v) de Apple: cualquier app que permite crear cuenta debe
// permitir eliminarla desde dentro de la app.
//
// perfiles.id -> auth.users(id) on delete cascade: borrar auth.users ya
// cascada solo prácticamente todo el grafo de datos del usuario (medidas,
// rutinas, citas, logs, planes, etc. — ver supabase_schema.sql). Esta
// función solo necesita ocuparse de lo que esa cascada haría mal:
//   1) suscripciones.user_id también cascada, pero eso destruiría el
//      historial de pagos que admin-web/app/privacidad/page.tsx ya
//      promete conservar — se anonimiza (user_id=null) en vez de dejarlo
//      cascar.
//   2) perfiles.nutricionista_id es "set null" (huérfanos silenciosos),
//      pero pacientes_manuales.nutricionista_id es "cascade" — si el
//      caller es nutriólogo con pacientes (reales o pre-registrados), se
//      bloquea en vez de borrar/huerfanar sin aviso.
export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405)
  }

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

    // 1) Guardia de dependientes — corre siempre, sin mirar antes el rol:
    // el conteo da 0 para cualquiera que genuinamente no sea nutriólogo.
    const { count: pacientesAsignados, error: pacientesError } = await supabase
      .from("perfiles")
      .select("id", { count: "exact", head: true })
      .eq("nutricionista_id", user.id)

    if (pacientesError) {
      console.error("eliminar-cuenta: error contando pacientes asignados", user.id, pacientesError)
      return jsonResponse({ error: "No se pudo verificar tu cuenta" }, 500)
    }

    const { count: pacientesManuales, error: pacientesManualesError } = await supabase
      .from("pacientes_manuales")
      .select("id", { count: "exact", head: true })
      .eq("nutricionista_id", user.id)

    if (pacientesManualesError) {
      console.error("eliminar-cuenta: error contando pacientes manuales", user.id, pacientesManualesError)
      return jsonResponse({ error: "No se pudo verificar tu cuenta" }, 500)
    }

    const totalPacientes = (pacientesAsignados ?? 0) + (pacientesManuales ?? 0)
    if (totalPacientes > 0) {
      return jsonResponse({
        error: `Tienes ${totalPacientes} paciente${totalPacientes === 1 ? "" : "s"} asignado${totalPacientes === 1 ? "" : "s"}. Reasígnalos antes de eliminar tu cuenta.`,
        pacientesAsignados: totalPacientes,
      }, 409)
    }

    // 2) Suscripciones activas: cancelar las de Stripe de verdad (somos
    // el merchant), las de RevenueCat no se pueden cancelar por API — el
    // cliente ya avisó al usuario de eso antes de llegar aquí.
    const { data: suscripcionesActivas, error: suscripcionesError } = await supabase
      .from("suscripciones")
      .select("id, provider, stripe_subscription_id")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])

    if (suscripcionesError) {
      console.error("eliminar-cuenta: error leyendo suscripciones", user.id, suscripcionesError)
      return jsonResponse({ error: "No se pudo verificar tu cuenta" }, 500)
    }

    for (const sub of suscripcionesActivas ?? []) {
      if (sub.provider === "stripe" && sub.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id)
        } catch (err) {
          console.error("eliminar-cuenta: error cancelando suscripción Stripe", sub.stripe_subscription_id, err)
          return jsonResponse({ error: "No se pudo cancelar tu suscripción activa. Intenta de nuevo." }, 500)
        }

        // No se deja esto al webhook async de Stripe: para cuando llegue,
        // el perfil ya pudo haberse borrado (cascada más abajo), y
        // stripe-webhook busca por perfiles.stripe_customer_id — sin
        // perfil, el evento se ignora y el registro de auditoría se
        // queda diciendo "activo" para siempre.
        const { error: cancelError } = await supabase
          .from("suscripciones")
          .update({ status: "canceled" })
          .eq("id", sub.id)

        if (cancelError) {
          console.error("eliminar-cuenta: error marcando suscripción cancelada", sub.id, cancelError)
          return jsonResponse({ error: "No se pudo completar la cancelación de tu suscripción." }, 500)
        }
      }
    }

    // 3) Anonimizar suscripciones (conservar el historial de pagos, cortar
    // el vínculo con la persona) — ANTES de borrar auth.users, porque
    // después ya no habría forma de ubicar estas filas por user_id.
    const { error: anonimizarError } = await supabase
      .from("suscripciones")
      .update({ user_id: null })
      .eq("user_id", user.id)

    if (anonimizarError) {
      console.error("eliminar-cuenta: error anonimizando suscripciones", user.id, anonimizarError)
      return jsonResponse({ error: "No se pudo completar la eliminación de tu cuenta." }, 500)
    }

    // 4) Borrar auth.users — cascada el resto (perfiles y prácticamente
    // todo lo demás, ver comentario de cabecera).
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error("eliminar-cuenta: error eliminando auth.users", user.id, deleteError)
      return jsonResponse({ error: "No se pudo completar la eliminación de tu cuenta." }, 500)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    console.error("eliminar-cuenta: error inesperado", err)
    return jsonResponse({ error: "No se pudo eliminar tu cuenta" }, 502)
  }
}

Deno.serve(handler)
