import { supabase } from "@/lib/supabase";
import type { Receta } from "./recetas";

type RecetaGuardadaRow = {
  user_id: string;
  receta_id: string;
  recetas: Receta & {
    receta_ingredientes: Receta["ingredientes"] | null;
    receta_pasos: Receta["pasos"] | null;
  };
};

export async function fetchRecetasAsignadas(userId: string): Promise<Receta[]> {
  const { data, error } = await supabase
    .from("recetas_guardadas")
    .select("receta_id, recetas(*, receta_ingredientes(*), receta_pasos(*))")
    .eq("user_id", userId);
  if (error) throw error;

  return (data as unknown as RecetaGuardadaRow[]).map((row) => {
    const { receta_ingredientes, receta_pasos, ...rest } = row.recetas;
    return {
      ...rest,
      ingredientes: [...(receta_ingredientes ?? [])].sort((a, b) => a.orden - b.orden),
      pasos: [...(receta_pasos ?? [])].sort((a, b) => a.numero - b.numero),
    };
  });
}

export async function saveRecetasAsignadas(userId: string, recetaIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from("recetas_guardadas")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (recetaIds.length > 0) {
    const rows = recetaIds.map((receta_id) => ({ user_id: userId, receta_id }));
    const { error } = await supabase.from("recetas_guardadas").insert(rows);
    if (error) throw error;
  }
}
