import { supabase } from "@/lib/supabase";

export type CitaPendiente = {
  id: string;
  user_id: string;
  fecha: string;
  hora: string;
  tipo: string;
  profesional: string | null;
  modalidad: string | null;
  notas: string | null;
  estado: string;
  perfiles: { nombre_completo: string | null; email: string | null } | null;
};

export async function fetchTodasCitasPendientes(): Promise<CitaPendiente[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data: citas, error } = await supabase
    .from("citas")
    .select("id, user_id, fecha, hora, tipo, profesional, modalidad, notas, estado")
    .eq("estado", "pendiente")
    .gte("fecha", today)
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true });
  if (error) throw error;
  if (!citas || citas.length === 0) return [];

  const userIds = [...new Set(citas.map((c) => c.user_id))];
  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, email")
    .in("id", userIds);

  const perfilMap = new Map((perfiles ?? []).map((p) => [p.id, p]));

  return citas.map((c) => ({
    ...c,
    perfiles: perfilMap.get(c.user_id) ?? null,
  })) as CitaPendiente[];
}

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
