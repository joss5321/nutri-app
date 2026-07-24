import { supabase } from "@/lib/supabase";

export const UNIDADES_ALIMENTO = [
  "gramos",
  "cucharada",
  "pieza",
  "taza",
  "paquete",
  "sobre",
  "barra",
] as const;

export type UnidadAlimento = (typeof UNIDADES_ALIMENTO)[number];

export type Alimento = {
  id: string;
  nombre: string;
  categoria: string | null;
  cantidad: number | null;
  unidad: string | null;
  peso_bruto_g: number | null;
  peso_neto_g: number | null;
  kcal: number | null;
  proteinas_g: number | null;
  lipidos_g: number | null;
  hco_g: number | null;
  fibra_g: number | null;
  created_by: string | null;
  created_at?: string;
};

export type AlimentoInput = Omit<Alimento, "id" | "created_by" | "created_at">;

export async function fetchAlimentos(): Promise<Alimento[]> {
  const PAGE = 1000;
  let all: Alimento[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("alimentos")
      .select("*")
      .order("nombre", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = [...all, ...(data as Alimento[])];
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function createAlimento(input: AlimentoInput): Promise<Alimento> {
  const { data, error } = await supabase
    .from("alimentos")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Alimento;
}

export async function updateAlimento(id: string, input: AlimentoInput): Promise<Alimento> {
  const { data, error } = await supabase
    .from("alimentos")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Alimento;
}

export async function deleteAlimento(id: string): Promise<void> {
  const { error } = await supabase.from("alimentos").delete().eq("id", id);
  if (error) throw error;
}
