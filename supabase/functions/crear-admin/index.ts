// Issue #7: administradores/page.tsx creaba admins con supabase.auth.signUp()
// client-side — eso inicia sesión como el usuario nuevo en el navegador,
// y el código tenía que "restaurar" la sesión del superadmin después con
// setSession(), un flujo frágil y no atómico (dos llamadas de red con un
// swap de sesión real en medio). Esta función hace lo mismo que
// invitar-usuario/index.ts: todo con service_role, en el servidor — la
// sesión del superadmin en el navegador nunca se toca.

import { createClient } from "npm:@supabase/supabase-js@2"
import { requireSuperadmin } from "../_shared/auth.ts"

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

  const auth = await requireSuperadmin(req)
  if (!auth.ok) return auth.response

  let body: { email?: string; password?: string; nombre_completo?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON inválido" }, 400)
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  const nombreCompleto = body.nombre_completo?.trim()

  if (!email || !nombreCompleto) {
    return jsonResponse({ error: "Email y nombre son requeridos" }, 400)
  }
  if (!password || password.length < 8) {
    return jsonResponse({ error: "La contraseña debe tener al menos 8 caracteres" }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: nombreCompleto },
  })

  if (createError) {
    const yaExiste = createError.message?.toLowerCase().includes("already been registered")
      || createError.message?.toLowerCase().includes("already registered")
    return jsonResponse({
      error: yaExiste ? "Ya existe un usuario registrado con este correo." : createError.message,
    }, 400)
  }

  // El trigger crear_perfil_nuevo_usuario() ya crea la fila en perfiles con
  // rol='usuario' por defecto al insertar en auth.users — esto la sube a
  // admin. service_role: pasa proteger_columnas_sensibles_perfiles() sin
  // necesitar ninguna sesión de superadmin en el navegador.
  const { error: rolError } = await supabaseAdmin
    .from("perfiles")
    .update({ rol: "admin", is_active: true, estatus: "aprobado" })
    .eq("id", createData.user.id)

  if (rolError) {
    console.error("crear-admin: error UPDATE perfiles.rol", createData.user.id, rolError)
    return jsonResponse({ error: "El usuario se creó pero no se pudo asignar el rol de administrador." }, 500)
  }

  return jsonResponse({ success: true, id: createData.user.id })
}

Deno.serve(handler)
