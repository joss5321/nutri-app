import { supabase } from "@/lib/supabase";
import type { Alimento } from "./alimentos";

export const TIPOS_RECETA = ["Desayuno", "Almuerzo", "Cena", "Colación", "Comida"] as const;
export const NIVELES_RECETA = ["Fácil", "Medio", "Difícil"] as const;
export const CATEGORIAS_NUTRICIONALES = [
  "Alta en proteína",
  "Alta en fibra",
  "Baja en carbohidratos",
];

export type RecetaIngrediente = {
  id: string;
  receta_id: string;
  orden: number;
  descripcion: string;
  alimento_id: string | null;
  cantidad: number | null;
  unidad: string | null;
};

export type RecetaIngredienteInput = {
  descripcion: string;
  alimento_id?: string | null;
  cantidad?: number | null;
  unidad?: string | null;
};

export type RecetaPaso = {
  id: string;
  receta_id: string;
  numero: number;
  descripcion: string;
};

export type Receta = {
  id: string;
  nombre: string;
  emoji: string | null;
  tipo: string | null;
  categoria_nutricional: string | null;
  tags: string | null;
  tiempo_prep_min: number | null;
  tiempo_coccion_min: number | null;
  tiempo_min: number | null;
  nivel: string | null;
  calorias: number | null;
  porciones: string | null;
  proteinas_g: number | null;
  carbohidratos_g: number | null;
  grasas_g: number | null;
  user_id: string | null;
  receta_base_id: string | null;
  created_by: string | null;
  created_at?: string;
  ingredientes: RecetaIngrediente[];
  pasos: RecetaPaso[];
};

export type RecetaInput = Omit<Receta, "id" | "created_at" | "user_id" | "receta_base_id" | "created_by" | "ingredientes" | "pasos"> & {
  ingredientes: RecetaIngredienteInput[];
  pasos: string[];
};

type RecetaRow = Omit<Receta, "ingredientes" | "pasos"> & {
  receta_ingredientes: RecetaIngrediente[] | null;
  receta_pasos: RecetaPaso[] | null;
};

const RECETA_SELECT = "*, receta_ingredientes(*), receta_pasos(*)";

function normalizeReceta(row: RecetaRow): Receta {
  const { receta_ingredientes, receta_pasos, ...rest } = row;
  return {
    ...rest,
    ingredientes: [...(receta_ingredientes ?? [])].sort((a, b) => a.orden - b.orden),
    pasos: [...(receta_pasos ?? [])].sort((a, b) => a.numero - b.numero),
  };
}

export async function fetchRecetaById(id: string): Promise<Receta> {
  const { data, error } = await supabase
    .from("recetas")
    .select(RECETA_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return normalizeReceta(data as RecetaRow);
}

// Only returns base catalog recipes (user_id IS NULL)
export async function fetchRecetas(): Promise<Receta[]> {
  const { data, error } = await supabase
    .from("recetas")
    .select(RECETA_SELECT)
    .is("user_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RecetaRow[]).map(normalizeReceta);
}

export type FetchRecetasParams = {
  page: number;     // 1-based
  pageSize: number;
  search?: string;
  tipo?: string;
};

export async function fetchRecetasPaginated(
  params: FetchRecetasParams
): Promise<{ data: Receta[]; count: number }> {
  const { page, pageSize, search = "", tipo = "" } = params;
  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;

  let query = supabase
    .from("recetas")
    .select(RECETA_SELECT, { count: "exact" })
    .is("user_id", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search.trim()) {
    query = query.ilike("nombre", `%${search.trim()}%`);
  }
  if (tipo && tipo !== "Todas") {
    query = query.eq("tipo", tipo);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    data: (data as RecetaRow[]).map(normalizeReceta),
    count: count ?? 0,
  };
}

export type MacrosCalculados = {
  calorias: number;
  proteinas_g: number;
  carbohidratos_g: number;
  grasas_g: number;
};

/**
 * Suma kcal/macros de los ingredientes de una receta que están ligados al
 * catálogo de alimentos (alimento_id), escalando la cantidad usada en la
 * receta contra la cantidad de referencia del alimento. Fuente única usada
 * tanto por el formulario de recetas (cálculo en vivo) como por el
 * recálculo masivo del catálogo. Devuelve null si no hay ningún ingrediente
 * ligado (nada que calcular).
 */
export function calcularMacrosDesdeIngredientes(
  ingredientes: { alimento_id: string | null; cantidad: number | null }[],
  alimentosById: Record<string, Alimento>
): MacrosCalculados | null {
  const ligados = ingredientes.filter((i) => !!i.alimento_id);
  if (ligados.length === 0) return null;

  let k = 0, p = 0, l = 0, h = 0;
  for (const ing of ligados) {
    const al = alimentosById[ing.alimento_id!];
    if (!al || !al.cantidad) continue;
    const scale = (ing.cantidad ?? 0) / al.cantidad;
    k += (al.kcal ?? 0) * scale;
    p += (al.proteinas_g ?? 0) * scale;
    l += (al.lipidos_g ?? 0) * scale;
    h += (al.hco_g ?? 0) * scale;
  }
  return {
    calorias: Math.round(k),
    proteinas_g: Number(p.toFixed(1)),
    carbohidratos_g: Number(h.toFixed(1)),
    grasas_g: Number(l.toFixed(1)),
  };
}

/** Todas las recetas del catálogo base (sin paginar) — usado para el recálculo masivo. */
export async function fetchTodasRecetasCatalogo(): Promise<Receta[]> {
  const PAGE = 500;
  let all: Receta[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("recetas")
      .select(RECETA_SELECT)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = [...all, ...(data as RecetaRow[]).map(normalizeReceta)];
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/** Liga (o desliga, si alimentoId es null) un ingrediente de receta a una fila del catálogo de alimentos. */
export async function vincularIngrediente(ingredienteId: string, alimentoId: string | null): Promise<void> {
  const { error } = await supabase
    .from("receta_ingredientes")
    .update({ alimento_id: alimentoId })
    .eq("id", ingredienteId);
  if (error) throw error;
}

/** Actualiza solo calorías/macros de una receta, sin tocar ingredientes ni pasos. */
export async function updateRecetaMacros(id: string, macros: MacrosCalculados): Promise<void> {
  const { error } = await supabase
    .from("recetas")
    .update({
      calorias: macros.calorias,
      proteinas_g: macros.proteinas_g,
      carbohidratos_g: macros.carbohidratos_g,
      grasas_g: macros.grasas_g,
    })
    .eq("id", id);
  if (error) throw error;
}

async function replaceIngredientes(recetaId: string, ingredientes: RecetaIngredienteInput[]): Promise<void> {
  const { error: deleteError } = await supabase.from("receta_ingredientes").delete().eq("receta_id", recetaId);
  if (deleteError) throw deleteError;

  const rows = ingredientes
    .map((ing) => ({ ...ing, descripcion: ing.descripcion.trim() }))
    .filter((ing) => ing.descripcion.length > 0)
    .map((ing, i) => ({
      receta_id: recetaId,
      orden: i + 1,
      descripcion: ing.descripcion,
      alimento_id: ing.alimento_id ?? null,
      cantidad: ing.cantidad ?? null,
      unidad: ing.unidad ?? null,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("receta_ingredientes").insert(rows);
    if (error) throw error;
  }
}

async function replacePasos(recetaId: string, descripciones: string[]): Promise<void> {
  const { error: deleteError } = await supabase.from("receta_pasos").delete().eq("receta_id", recetaId);
  if (deleteError) throw deleteError;

  const rows = descripciones
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
    .map((descripcion, i) => ({ receta_id: recetaId, numero: i + 1, descripcion }));

  if (rows.length > 0) {
    const { error } = await supabase.from("receta_pasos").insert(rows);
    if (error) throw error;
  }
}

export async function createReceta(input: RecetaInput): Promise<Receta> {
  const { ingredientes, pasos, ...recetaData } = input;

  const { data: receta, error } = await supabase
    .from("recetas")
    .insert(recetaData)
    .select()
    .single();
  if (error) throw error;

  await Promise.all([
    replaceIngredientes(receta.id, ingredientes),
    replacePasos(receta.id, pasos),
  ]);

  return fetchRecetaById(receta.id);
}

export async function updateReceta(id: string, input: RecetaInput): Promise<Receta> {
  const { ingredientes, pasos, ...recetaData } = input;

  const { error } = await supabase.from("recetas").update(recetaData).eq("id", id);
  if (error) throw error;

  await Promise.all([
    replaceIngredientes(id, ingredientes),
    replacePasos(id, pasos),
  ]);

  return fetchRecetaById(id);
}

export async function deleteReceta(id: string): Promise<void> {
  const { error } = await supabase.from("recetas").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateReceta(receta: Receta): Promise<Receta> {
  const { id, created_at, user_id, receta_base_id, created_by, ingredientes, pasos, ...rest } = receta;
  void id; void created_at; void user_id; void receta_base_id; void created_by;

  return createReceta({
    ...rest,
    nombre: `${rest.nombre} (copia)`,
    ingredientes: ingredientes.map((i) => ({
      descripcion: i.descripcion,
      alimento_id: i.alimento_id ?? null,
      cantidad: i.cantidad ?? null,
      unidad: i.unidad ?? null,
    })),
    pasos: pasos.map((p) => p.descripcion),
  });
}

/**
 * Creates or updates a personal copy of a base recipe for a specific user.
 * If the user already has a personalized version, it updates it.
 * Otherwise, it clones the base recipe with user_id and receta_base_id set.
 * Returns the recipe and the new ID if a clone was created (null if updated).
 */
export async function saveRecetaPersonalizada(
  userId: string,
  baseRecetaId: string,
  input: RecetaInput
): Promise<{ receta: Receta; newId: string | null }> {
  // Check if user already has a personal copy of this base recipe
  const { data: existing } = await supabase
    .from("recetas")
    .select("id")
    .eq("user_id", userId)
    .eq("receta_base_id", baseRecetaId)
    .maybeSingle();

  if (existing) {
    const receta = await updateReceta(existing.id as string, input);
    return { receta, newId: null };
  }

  // Create a brand-new personal copy — omit created_by so DB uses DEFAULT auth.uid()
  const { ingredientes, pasos, ...recetaData } = input;
  const { data: clone, error } = await supabase
    .from("recetas")
    .insert({ ...recetaData, user_id: userId, receta_base_id: baseRecetaId })
    .select()
    .single();
  if (error) throw error;

  await Promise.all([
    replaceIngredientes(clone.id, ingredientes),
    replacePasos(clone.id, pasos),
  ]);

  const receta = await fetchRecetaById(clone.id);
  return { receta, newId: clone.id as string };
}
