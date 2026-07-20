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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Completar el perfil y asignar al nutricionista
  await supabaseAdmin.from("perfiles").update({
    nombre_completo: nombre_completo.trim(),
    email: email.trim().toLowerCase(),
    fecha_nacimiento: fecha_nacimiento || null,
    sexo: sexo || null,
    telefono: telefono?.trim() || null,
    nutricionista_id: caller.id,
  }).eq("id", data.user.id)

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
