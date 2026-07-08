import { supabase } from "@/lib/supabase";

export const TIPOS_RECETA = ["Desayuno", "Almuerzo", "Cena", "Colación"] as const;
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
  created_at?: string;
  ingredientes: RecetaIngrediente[];
  pasos: RecetaPaso[];
};

export type RecetaInput = Omit<Receta, "id" | "created_at" | "ingredientes" | "pasos"> & {
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

export async function fetchRecetas(): Promise<Receta[]> {
  const { data, error } = await supabase
    .from("recetas")
    .select(RECETA_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RecetaRow[]).map(normalizeReceta);
}

async function fetchRecetaById(id: string): Promise<Receta> {
  const { data, error } = await supabase
    .from("recetas")
    .select(RECETA_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return normalizeReceta(data as RecetaRow);
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
  const { id, created_at, ingredientes, pasos, ...rest } = receta;
  void id;
  void created_at;

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
