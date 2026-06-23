import { supabase } from "@/lib/supabase";
import type { Suplemento } from "./suplementos";

export type PlanSuplemento = {
  id: string;
  user_id: string;
  suplemento_id: string;
  dosis: string | null;
  hora: string | null;
  momento: string | null;
  suplementos: Suplemento;
};

export type PlanSuplementoInput = {
  suplemento_id: string;
  dosis: string | null;
  hora: string | null;
  momento: string | null;
};

export async function fetchPlanSuplementacion(userId: string): Promise<PlanSuplemento[]> {
  const { data, error } = await supabase
    .from("plan_suplementacion")
    .select("*, suplementos(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return data as PlanSuplemento[];
}

export async function savePlanSuplementacion(userId: string, items: PlanSuplementoInput[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from("plan_suplementacion")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (items.length > 0) {
    const rows = items.map((item) => ({ ...item, user_id: userId }));
    const { error } = await supabase.from("plan_suplementacion").insert(rows);
    if (error) throw error;
  }
}
