import { supabase } from "@/lib/supabase";

export type Cita = {
  id: string;
  user_id: string;
  fecha: string;
  hora: string;
  tipo: string;
  profesional: string | null;
  modalidad: string | null;
  notas: string | null;
  estado: string;
  created_at?: string;
};

export type CitaInput = Omit<Cita, "id" | "user_id" | "created_at" | "estado">;

export async function fetchCitas(userId: string): Promise<Cita[]> {
  const { data, error } = await supabase
    .from("citas")
    .select("*")
    .eq("user_id", userId)
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true });
  if (error) throw error;
  return data as Cita[];
}

export async function createCita(userId: string, input: CitaInput): Promise<Cita> {
  const { data, error } = await supabase
    .from("citas")
    .insert({ ...input, user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Cita;
}

export async function deleteCita(id: string): Promise<void> {
  const { error } = await supabase.from("citas").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCitaEstado(id: string, estado: string): Promise<Cita> {
  const { data, error } = await supabase
    .from("citas")
    .update({ estado })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Cita;
}
