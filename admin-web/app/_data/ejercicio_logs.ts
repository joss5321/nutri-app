import { supabase } from "@/lib/supabase";

export type EjercicioLog = {
  id: string;
  user_id: string;
  ejercicio_id: string;
  peso_kg: number;
  numero_serie: number;
  sesion_id: string;
  fecha: string;
  created_at?: string;
  ejercicios: {
    nombre: string;
    emoji: string | null;
  };
};

export async function fetchEjercicioLogsByUser(userId: string): Promise<EjercicioLog[]> {
  const { data, error } = await supabase
    .from("ejercicio_logs")
    .select("*, ejercicios(nombre, emoji)")
    .eq("user_id", userId)
    .order("fecha",        { ascending: true })
    .order("sesion_id",    { ascending: true })
    .order("numero_serie", { ascending: true });
  if (error) throw error;
  return data as EjercicioLog[];
}
