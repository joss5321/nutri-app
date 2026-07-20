import { supabase } from "@/lib/supabase";

export type Perfil = {
  id: string;
  nombre_completo: string | null;
  email: string | null;
  sexo: string | null;
  fecha_nacimiento: string | null;
  altura_cm: number | null;
  avatar_url: string | null;
  telefono: string | null;
  plan_membresia: string;
  rol: string;
  nutricionista_id: string | null;
  created_at?: string;
};

export async function fetchAdmins(): Promise<Perfil[]> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("rol", "admin")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Perfil[];
}

/**
 * Returns only the patients that belong to the currently logged-in nutritionist.
 * The RLS policy "perfiles: lectura multi-tenant" enforces this at the DB level;
 * the explicit eq filter is defense-in-depth.
 */
export async function fetchPerfiles(): Promise<Perfil[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("No autenticado");

  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("rol", "usuario")
    .eq("nutricionista_id", session.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Perfil[];
}

export async function fetchPerfil(id: string): Promise<Perfil> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Perfil;
}

export async function updatePerfil(
  id: string,
  input: Partial<Pick<Perfil, "nombre_completo" | "sexo" | "fecha_nacimiento" | "altura_cm" | "plan_membresia">>
): Promise<Perfil> {
  const { data, error } = await supabase
    .from("perfiles")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Perfil;
}
