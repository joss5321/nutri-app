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
