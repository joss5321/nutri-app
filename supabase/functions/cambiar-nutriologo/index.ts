import { createClient } from "npm:@supabase/supabase-js@2"

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

// nutricionista_id está protegido por el trigger
// proteger_columnas_sensibles_perfiles (supabase_schema.sql) — ni el propio
// paciente puede escribirlo por una policy normal, por diseño. Esta función
// es el único camino legítimo para que un paciente cambie de nutriólogo
// por su cuenta: valida identidad real (JWT), valida que el destino sea un
// nutriólogo real y activo, y escribe con service_role (el mismo patrón ya
// usado en crear-checkout/crear-portal-sesion).
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

    let body: { nutricionistaId?: string }
    try {
      body = await req.json()
    } catch (err) {
      console.error("cambiar-nutriologo: body JSON inválido", err)
      return jsonResponse({ error: "Solicitud inválida" }, 400)
    }
    const { nutricionistaId } = body
    if (!nutricionistaId) {
      return jsonResponse({ error: "Falta el nutriólogo a seleccionar" }, 400)
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // El cliente nunca decide "es un nutriólogo válido" por sí mismo — se
    // verifica server-side contra la tabla real antes de escribir nada.
    const { data: nutriologo, error: nutriologoError } = await supabase
      .from("perfiles")
      .select("id, rol, is_active")
      .eq("id", nutricionistaId)
      .maybeSingle()

    if (nutriologoError) {
      console.error("cambiar-nutriologo: error verificando nutriólogo", nutricionistaId, nutriologoError)
      return jsonResponse({ error: "No se pudo verificar el nutriólogo" }, 500)
    }
    if (!nutriologo || !["admin", "superadmin"].includes(nutriologo.rol) || !nutriologo.is_active) {
      return jsonResponse({ error: "Nutriólogo inválido" }, 400)
    }

    const { error: updateError } = await supabase
      .from("perfiles")
      .update({ nutricionista_id: nutricionistaId })
      .eq("id", user.id)

    if (updateError) {
      console.error("cambiar-nutriologo: error actualizando perfil", user.id, updateError)
      return jsonResponse({ error: "No se pudo actualizar tu nutriólogo" }, 500)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    console.error("cambiar-nutriologo: error inesperado", err)
    return jsonResponse({ error: "No se pudo completar el cambio" }, 502)
  }
}

Deno.serve(handler)
