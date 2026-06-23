import { supabase } from "@/lib/supabase";

export type Suplemento = {
  id: string;
  nombre: string;
  icono: string;
  descripcion: string | null;
  marca: string | null;
  gramaje: string | null;
  imagen_url: string | null;
  created_at?: string;
};

export type SuplementoInput = Omit<Suplemento, "id" | "created_at">;

export async function fetchSuplementos(): Promise<Suplemento[]> {
  const { data, error } = await supabase
    .from("suplementos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Suplemento[];
}

export async function createSuplemento(input: SuplementoInput): Promise<Suplemento> {
  const { data, error } = await supabase
    .from("suplementos")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Suplemento;
}

export async function updateSuplemento(id: string, input: SuplementoInput): Promise<Suplemento> {
  const { data, error } = await supabase
    .from("suplementos")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Suplemento;
}

export async function deleteSuplemento(id: string): Promise<void> {
  const { error } = await supabase.from("suplementos").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadSuplementoImagen(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(`suplementos/${path}`, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(`suplementos/${path}`);
  return publicUrl;
}
