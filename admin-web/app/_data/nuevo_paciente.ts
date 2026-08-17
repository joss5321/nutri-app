import { supabase } from "@/lib/supabase";

/**
 * Da de alta un paciente desde admin-web (Pacientes → "+ Nuevo paciente")
 * sin que el paciente tenga la app móvil instalada todavía. Invoca la
 * Edge Function invitar-usuario, que crea una cuenta real de Supabase Auth
 * (invitación por correo), asigna el perfil al nutriólogo que lo crea y lo
 * aprueba de inmediato para que pueda recibir rutinas, planes y citas sin
 * esperar a que el paciente instale la app.
 */
export async function crearPacienteWeb(input: {
  nombre: string;
  apellidos: string;
  fecha_nacimiento: string;
  sexo: string;
  telefono: string;
  email: string;
}): Promise<void> {
  const nombreCompleto = [input.nombre.trim(), input.apellidos.trim()].filter(Boolean).join(" ");

  const { data, error } = await supabase.functions.invoke("invitar-usuario", {
    body: {
      email: input.email.trim().toLowerCase(),
      nombre_completo: nombreCompleto,
      fecha_nacimiento: input.fecha_nacimiento || null,
      sexo: input.sexo || null,
      telefono: input.telefono.trim() || null,
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
