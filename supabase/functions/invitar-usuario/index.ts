import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Identificar al nutricionista que hace el llamado
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user: caller } } = await supabaseUser.auth.getUser()
  if (!caller) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Solo un nutriólogo (admin/superadmin) puede dar de alta pacientes
  const { data: callerPerfil } = await supabaseUser
    .from("perfiles")
    .select("rol")
    .eq("id", caller.id)
    .single()

  if (!callerPerfil || !["admin", "superadmin"].includes(callerPerfil.rol)) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { email, nombre_completo, fecha_nacimiento, sexo, telefono } = await req.json()

  if (!email?.trim() || !nombre_completo?.trim()) {
    return new Response(JSON.stringify({ error: "Email y nombre son requeridos" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Enviar invitación — Supabase manda el correo automáticamente
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email.trim().toLowerCase(),
    { data: { full_name: nombre_completo.trim() } }
  )

  if (error) {
    const yaExiste = error.message?.toLowerCase().includes("already been registered")
      || error.message?.toLowerCase().includes("already registered")
    return new Response(JSON.stringify({
      error: yaExiste ? "Ya existe un paciente registrado con este correo." : error.message,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Completar el perfil, asignar al nutricionista y aprobarlo de inmediato:
  // este paciente puede recibir rutinas/planes/citas desde ya, aunque
  // todavía no haya usado la app móvil (movil_vinculado = false).
  const { error: updateError } = await supabaseAdmin.from("perfiles").update({
    nombre_completo: nombre_completo.trim(),
    email: email.trim().toLowerCase(),
    fecha_nacimiento: fecha_nacimiento || null,
    sexo: sexo || null,
    telefono: telefono?.trim() || null,
    nutricionista_id: caller.id,
    estatus: "aprobado",
    is_active: true,
    movil_vinculado: false,
  }).eq("id", data.user.id)

  if (updateError) {
    console.error("invitar-usuario: error UPDATE perfiles", data.user.id, updateError)
    return new Response(JSON.stringify({ error: "No se pudo completar el perfil del paciente invitado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ success: true, id: data.user.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
