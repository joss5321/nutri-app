import { supabase } from "@/lib/supabase";

export type Perfil = {
  id: string;
  nombre_completo: string | null;
  sexo: string | null;
  fecha_nacimiento: string | null;
  altura_cm: number | null;
  avatar_url: string | null;
  plan_membresia: string;
  created_at?: string;
};

export async function fetchPerfiles(): Promise<Perfil[]> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
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
