import { supabase } from "@/lib/supabase";
import { saveRecetaPersonalizada, type Receta, type RecetaInput } from "./recetas";

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
