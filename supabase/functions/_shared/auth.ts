// Módulo compartido — NO es una Edge Function propia (prefijo `_`), solo
// importable desde otras funciones. Centraliza la autorización
// "superadmin-only" para herramientas manuales/internas que usan
// service_role (import-workoutx, match-exercise-gifs, migrate-gifs,
// translate-exercises) — nunca se usa service_role para decidir quién es
// el caller; solo un cliente anon+Authorization reenviado, que consulta
// exclusivamente su propio perfil (perfiles.id = user.id).

import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

export type AuthorizedUser = {
  id: string
  email?: string
}

export type RequireSuperadminResult =
  | { ok: true; user: AuthorizedUser }
  | { ok: false; response: Response }

/**
 * Verifica que el caller de un request tenga rol='superadmin' en perfiles.
 * Devuelve { ok: true, user } si está autorizado — recién en ese punto el
 * caller debe construir su propio cliente service_role para operar. Si
 * ok=false, devuelve la Response exacta que hay que responder (401/403/500)
 * sin exponer detalles internos.
 */
export async function requireSuperadmin(req: Request): Promise<RequireSuperadminResult> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return { ok: false, response: jsonResponse({ error: "No autorizado" }, 401) }
  }

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  )

  let user: AuthorizedUser
  try {
    const { data, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !data.user) {
      return { ok: false, response: jsonResponse({ error: "No autorizado" }, 401) }
    }
    user = { id: data.user.id, email: data.user.email }
  } catch (err) {
    console.error("requireSuperadmin: error inesperado validando el JWT", err)
    return { ok: false, response: jsonResponse({ error: "No autorizado" }, 401) }
  }

  try {
    // maybeSingle() (no single()): con 0 filas devuelve {data:null,error:null}
    // en vez de lanzar un error — así distinguimos "perfil ausente" (403)
    // de un error real de consulta (500).
    const { data: perfil, error: perfilError } = await supabaseUser
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle()

    if (perfilError) {
      console.error("requireSuperadmin: error leyendo perfil", user.id, perfilError)
      return { ok: false, response: jsonResponse({ error: "No se pudo verificar tu cuenta" }, 500) }
    }

    if (!perfil || perfil.rol !== "superadmin") {
      return { ok: false, response: jsonResponse({ error: "No autorizado" }, 403) }
    }
  } catch (err) {
    console.error("requireSuperadmin: error inesperado leyendo perfil", user.id, err)
    return { ok: false, response: jsonResponse({ error: "No se pudo verificar tu cuenta" }, 500) }
  }

  return { ok: true, user }
}
