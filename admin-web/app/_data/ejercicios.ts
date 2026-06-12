import { supabase } from "@/lib/supabase";
import type { Exercise, ExerciseInput } from "@/app/_data/exercises";

const VIDEOS_BUCKET = "videos-ejercicios";

export async function fetchEjercicios(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from("ejercicios")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Exercise[];
}

export async function createEjercicio(input: ExerciseInput): Promise<Exercise> {
  const { data, error } = await supabase
    .from("ejercicios")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Exercise;
}

export async function updateEjercicio(id: string, input: ExerciseInput): Promise<Exercise> {
  const { data, error } = await supabase
    .from("ejercicios")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Exercise;
}

export async function deleteEjercicio(id: string): Promise<void> {
  const { error } = await supabase.from("ejercicios").delete().eq("id", id);
  if (error) throw error;
}

/** Sube un video al bucket público "videos-ejercicios" y devuelve su URL pública y ruta de storage. */
export async function uploadEjercicioVideo(file: File): Promise<{ url: string; path: string }> {
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(VIDEOS_BUCKET).upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from(VIDEOS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Elimina un video previamente subido al bucket "videos-ejercicios". */
export async function deleteEjercicioVideo(path: string): Promise<void> {
  const { error } = await supabase.storage.from(VIDEOS_BUCKET).remove([path]);
  if (error) throw error;
}
