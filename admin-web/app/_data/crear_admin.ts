import { supabase } from "@/lib/supabase";

/**
 * Crea un nuevo administrador (issue #7). Invoca la Edge Function
 * crear-admin en vez de supabase.auth.signUp() client-side: signUp()
 * inicia sesión como el usuario nuevo en el navegador, obligando a
 * restaurar después la sesión del superadmin con setSession() — un flujo
 * frágil y no atómico. La Edge Function hace todo con service_role, sin
 * tocar la sesión del superadmin en ningún momento.
 */
export async function crearAdmin(input: {
  nombre_completo: string;
  email: string;
  password: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("crear-admin", {
    body: {
      email: input.email.trim().toLowerCase(),
      password: input.password,
      nombre_completo: input.nombre_completo.trim(),
    },
  });

  if (error) {
    let msg = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) msg = body.error;
      } catch {
        // respuesta sin JSON — se usa error.message
      }
    }
    throw new Error(msg);
  }
  if (data?.error) {
    throw new Error(data.error);
  }
}
