import { supabase } from "@/lib/supabase";

export type Dietocalculo = {
  id: string;
  user_id: string;
  formula: string;
  actividad: string;
  objetivo: string;
  nivel_pct: number;
  geb: number | null;
  eta: number | null;
  factor_af: number | null;
  get_total: number | null;
  get_ajustado: number | null;
  carbs_gr_kg: number;
  prote_gr_kg: number;
  lipidos_gr_kg: number;
  carbs_kcal: number;
  prote_kcal: number;
  lipidos_kcal: number;
  carbs_pct: number;
  prote_pct: number;
  lipidos_pct: number;
  created_at?: string;
  updated_at?: string;
};

export type DietocalculoInput = Omit<Dietocalculo, "id" | "user_id" | "created_at" | "updated_at">;

export async function fetchDietocalculo(userId: string): Promise<Dietocalculo | null> {
  const { data, error } = await supabase
    .from("dietocalculo")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Dietocalculo | null;
}

export async function saveDietocalculo(userId: string, input: DietocalculoInput, existingId?: string): Promise<Dietocalculo> {
  if (existingId) {
    const { data, error } = await supabase
      .from("dietocalculo")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return data as Dietocalculo;
  }
  const { data, error } = await supabase
    .from("dietocalculo")
    .insert({ ...input, user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Dietocalculo;
}
