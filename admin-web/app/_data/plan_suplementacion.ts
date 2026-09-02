import { supabase } from "@/lib/supabase";
import type { Suplemento } from "./suplementos";

export type PlanSuplemento = {
  id: string;
  user_id: string;
  suplemento_id: string;
  dosis: string | null;
  hora: string | null;
  momento: string | null;
  notas: string | null;
  suplementos: Suplemento;
};

export type PlanSuplementoInput = {
  suplemento_id: string;
  dosis: string | null;
  hora: string | null;
  momento: string | null;
  notas: string | null;
};

export async function fetchPlanSuplementacion(userId: string): Promise<PlanSuplemento[]> {
  const { data, error } = await supabase
    .from("plan_suplementacion")
    .select("*, suplementos(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return data as PlanSuplemento[];
}

// Delega en la RPC atómica guardar_plan_suplementacion (supabase_schema.sql,
// Sección 61): reemplaza TODO el plan de suplementación del paciente en una
// sola transacción de servidor, en vez de DELETE + INSERT como llamadas
// independientes que dejaban al paciente sin plan si el INSERT fallaba
// (ej. porque el paciente destino no está activo+aprobado).
export async function savePlanSuplementacion(userId: string, items: PlanSuplementoInput[]): Promise<void> {
  const { error } = await supabase.rpc("guardar_plan_suplementacion", {
    p_user_id: userId,
    p_items: items,
  });
  if (error) throw error;
}
