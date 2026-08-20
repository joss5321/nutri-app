import { supabase } from "@/lib/supabase";

export const MEAL_LABELS = ["Desayuno", "Colación 1", "Comida", "Colación 2", "Cena"] as const;
export const MEAL_KEYS = ["desayuno", "colacion_1", "comida", "colacion_2", "cena"] as const;

export const FOOD_GROUPS: { icono: string; grupo: string }[] = [
  { icono: "🥣", grupo: "Cereales sin grasa" },
  { icono: "🌽", grupo: "Cereales con grasa" },
  { icono: "🍎", grupo: "Frutas" },
  { icono: "🥦", grupo: "Verduras" },
  { icono: "🥛", grupo: "Leche descremada" },
  { icono: "🫘", grupo: "Leguminosas" },
  { icono: "🍗", grupo: "POA muy bajo aporte" },
  { icono: "🐟", grupo: "POA bajo aporte" },
  { icono: "🥩", grupo: "POA medio aporte" },
  { icono: "🥓", grupo: "POA alto aporte" },
  { icono: "🥑", grupo: "Aceites y grasas" },
  { icono: "🥜", grupo: "AC y G c/Proteína" },
  { icono: "🍯", grupo: "Azúcares sin grasa" },
  { icono: "🍮", grupo: "Azúcares con grasa" },
];

// Valores nutricionales por equivalente — SMAE
export const NUTRICION_POR_EQUIV: Record<string, { hco: number; prot: number; lip: number; kcal: number }> = {
  "Cereales sin grasa":  { hco: 15, prot: 2, lip: 0, kcal: 70 },
  "Cereales con grasa":  { hco: 15, prot: 2, lip: 5, kcal: 115 },
  "Frutas":              { hco: 15, prot: 0, lip: 0, kcal: 60 },
  "Verduras":            { hco: 4,  prot: 2, lip: 0, kcal: 25 },
  "Leche descremada":    { hco: 12, prot: 9, lip: 2, kcal: 95 },
  "Leguminosas":         { hco: 20, prot: 8, lip: 1, kcal: 120 },
  "POA muy bajo aporte": { hco: 0,  prot: 7, lip: 1, kcal: 40 },
  "POA bajo aporte":     { hco: 0,  prot: 7, lip: 3, kcal: 55 },
  "POA medio aporte":    { hco: 0,  prot: 7, lip: 5, kcal: 75 },
  "POA alto aporte":     { hco: 0,  prot: 7, lip: 8, kcal: 100 },
  "Aceites y grasas":    { hco: 0,  prot: 0, lip: 5, kcal: 45 },
  "AC y G c/Proteína":   { hco: 3,  prot: 3, lip: 5, kcal: 70 },
  "Azúcares sin grasa":  { hco: 10, prot: 0, lip: 0, kcal: 40 },
  "Azúcares con grasa":  { hco: 10, prot: 0, lip: 5, kcal: 85 },
};

export type Equivalente = {
  id: string;
  plan_id: string;
  grupo: string;
  icono: string | null;
  desayuno: number;
  colacion_1: number;
  comida: number;
  colacion_2: number;
  cena: number;
};

export type EquivalenteInput = Omit<Equivalente, "id" | "plan_id">;

export async function fetchEquivalentes(userId: string): Promise<{ planId: string; equivalentes: Equivalente[] }> {
  const { data: planRow, error: planError } = await supabase
    .from("planes_nutricionales")
    .select("id")
    .eq("user_id", userId)
    .eq("activo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planError) throw planError;

  let planId: string;
  if (planRow) {
    planId = planRow.id as string;
  } else {
    const { data: created, error: createError } = await supabase
      .from("planes_nutricionales")
      .insert({ user_id: userId, objetivo: "General", activo: true })
      .select("id")
      .single();
    if (createError) throw createError;
    planId = created.id as string;
  }

  const { data: equivalentes, error: eqError } = await supabase
    .from("plan_equivalentes")
    .select("*")
    .eq("plan_id", planId);
  if (eqError) throw eqError;

  return { planId, equivalentes: equivalentes as Equivalente[] };
}

export async function saveEquivalentes(planId: string, rows: EquivalenteInput[]): Promise<Equivalente[]> {
  const { error: deleteError } = await supabase.from("plan_equivalentes").delete().eq("plan_id", planId);
  if (deleteError) throw deleteError;

  const { data, error } = await supabase
    .from("plan_equivalentes")
    .insert(rows.map((r) => ({ ...r, plan_id: planId })))
    .select("*");
  if (error) throw error;
  return data as Equivalente[];
}
