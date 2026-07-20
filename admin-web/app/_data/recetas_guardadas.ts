import { supabase } from "@/lib/supabase";
import { saveRecetaPersonalizada, type Receta, type RecetaInput } from "./recetas";

export type MealKey = "desayuno" | "colacion_1" | "comida" | "colacion_2" | "cena";

type RecetaGuardadaRow = {
  user_id: string;
  receta_id: string;
  tiempo_comida: MealKey;
  recetas: Receta & {
    receta_ingredientes: Receta["ingredientes"] | null;
    receta_pasos: Receta["pasos"] | null;
  };
};

export type RecetaAsignada = Receta & { tiempo_comida: MealKey };

export async function fetchRecetasAsignadas(userId: string): Promise<RecetaAsignada[]> {
  const { data, error } = await supabase
    .from("recetas_guardadas")
    .select("receta_id, tiempo_comida, recetas(*, receta_ingredientes(*), receta_pasos(*))")
    .eq("user_id", userId);
  if (error) throw error;

  return (data as unknown as RecetaGuardadaRow[]).map((row) => {
    const { receta_ingredientes, receta_pasos, ...rest } = row.recetas;
    return {
      ...rest,
      ingredientes: [...(receta_ingredientes ?? [])].sort((a, b) => a.orden - b.orden),
      pasos: [...(receta_pasos ?? [])].sort((a, b) => a.numero - b.numero),
      tiempo_comida: row.tiempo_comida ?? "desayuno",
    };
  });
}

export async function saveRecetasAsignadas(
  userId: string,
  asignadas: { receta_id: string; tiempo_comida: MealKey }[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("recetas_guardadas")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (asignadas.length > 0) {
    const rows = asignadas.map(({ receta_id, tiempo_comida }) => ({
      user_id: userId,
      receta_id,
      tiempo_comida,
    }));
    const { error } = await supabase.from("recetas_guardadas").insert(rows);
    if (error) throw error;
  }
}

/**
 * Personalizes an assigned recipe for a user:
 * - Resolves the base recipe ID (follows receta_base_id if already a personal copy).
 * - If user already has a personal copy → updates it in place.
 * - If not → clones the base recipe with user_id set, and redirects recetas_guardadas to the clone.
 */
export async function personalizeReceta(
  userId: string,
  currentRecetaId: string,
  input: RecetaInput
): Promise<Receta> {
  const { data: current } = await supabase
    .from("recetas")
    .select("receta_base_id")
    .eq("id", currentRecetaId)
    .single();

  const baseId: string = (current?.receta_base_id as string | null) ?? currentRecetaId;

  const { receta, newId } = await saveRecetaPersonalizada(userId, baseId, input);

  if (newId) {
    const { error } = await supabase
      .from("recetas_guardadas")
      .update({ receta_id: newId })
      .eq("user_id", userId)
      .eq("receta_id", currentRecetaId);
    if (error) throw error;
  }

  return receta;
}
