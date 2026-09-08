import { supabase } from "@/lib/supabase";
import type {
  Exercise,
  ExerciseInput,
  EjerciciosFiltros,
  EjercicioPaginado,
} from "@/app/_data/exercises";

const VIDEOS_BUCKET = "videos-ejercicios";
const GIFS_BUCKET = "exercise-gifs";
const DEFAULT_PAGE_SIZE = 24;

// ── Lectura — compatible con RutinaBuilderModal y otros consumidores ──────

/**
 * Carga TODOS los ejercicios visibles para el usuario actual.
 * Mantiene compatibilidad con RutinaBuilderModal y cualquier otro consumidor.
 * Para el catálogo con filtros y paginación, usar fetchEjerciciosCatalogo().
 */
export async function fetchEjercicios(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from("ejercicios")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Exercise[];
}

/**
 * Catálogo paginado con filtros ejecutados en Supabase (no en cliente).
 * Usado por la página del catálogo web para soportar ~1327+ ejercicios.
 */
export async function fetchEjerciciosCatalogo(
  filtros: EjerciciosFiltros = {},
): Promise<EjercicioPaginado> {
  const {
    search    = "",
    grupo     = "",
    bodyPart  = "",
    equipment = "",
    difficulty = "",
    category  = "",
    source    = "todos",
    page      = 1,
    pageSize  = DEFAULT_PAGE_SIZE,
  } = filtros;

  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;

  let query = supabase
    .from("ejercicios")
    .select("*", { count: "exact" });

  // Búsqueda por nombre (ILIKE — aprovecha el índice gin_trgm)
  if (search.trim()) {
    query = query.ilike("nombre", `%${search.trim()}%`);
  }

  // Grupo muscular: principal o secundario
  if (grupo) {
    query = query.or(`grupo_muscular.eq.${grupo},grupos_secundarios.cs.{${grupo}}`);
  }

  // Filtros WorkoutX
  if (bodyPart)   query = query.eq("body_part",  bodyPart);
  if (equipment)  query = query.eq("equipment",  equipment);
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (category)   query = query.eq("category",   category);

  // Filtro por origen
  if (source && source !== "todos") {
    query = query.eq("source", source);
  }

  // Ordenar: WorkoutX por popularidad, manuales por fecha de creación
  query = query
    .order("source",         { ascending: true })  // 'manual' < 'workoutx' alfabéticamente → manuales primero
    .order("popularity_rank", { ascending: true,  nullsFirst: false })
    .order("created_at",     { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: (data as Exercise[]) ?? [], total: count ?? 0 };
}

/**
 * Obtiene los valores únicos de un campo de ejercicios para poblar filtros.
 * Solo devuelve ejercicios visibles para el usuario actual (RLS).
 */
export async function fetchEjercicioFilterValues(
  field: "body_part" | "equipment" | "difficulty" | "category",
): Promise<string[]> {
  const { data, error } = await supabase
    .from("ejercicios")
    .select(field)
    .not(field, "is", null)
    .order(field, { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as Record<string, string>[];
  const unique = [...new Set(rows.map((r) => r[field]).filter(Boolean))];
  return unique;
}

/**
 * Todos los músculos presentes en los ejercicios dados de alta (manuales +
 * WorkoutX), combinando el músculo principal (grupo_muscular) y los
 * secundarios (grupos_secundarios) de cada ejercicio — así el filtro
 * "Músculo" cubre cualquier músculo que aparezca en el catálogo, no solo
 * una lista fija predefinida.
 */
export async function fetchMuscleFilterOptions(): Promise<string[]> {
  const { data, error } = await supabase
    .from("ejercicios")
    .select("grupo_muscular, grupos_secundarios");
  if (error) throw error;

  const set = new Set<string>();
  for (const row of (data ?? []) as { grupo_muscular: string | null; grupos_secundarios: string[] | null }[]) {
    if (row.grupo_muscular) set.add(row.grupo_muscular);
    for (const g of row.grupos_secundarios ?? []) {
      if (g) set.add(g);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

// ── Escritura — solo para ejercicios manuales ────────────────────────────

export async function createEjercicio(input: ExerciseInput): Promise<Exercise> {
  const { data, error } = await supabase
    .from("ejercicios")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Exercise;
}

export async function updateEjercicio(id: string, input: ExerciseInput): Promise<Exercise> {
  const { data, error } = await supabase
    .from("ejercicios")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Exercise;
}

export async function deleteEjercicio(id: string): Promise<void> {
  const { error } = await supabase.from("ejercicios").delete().eq("id", id);
  if (error) throw error;
}

// ── Storage — videos propios ──────────────────────────────────────────────

/** Sube un video al bucket público "videos-ejercicios" y devuelve su URL pública y ruta de storage. */
export async function uploadEjercicioVideo(file: File): Promise<{ url: string; path: string }> {
  const ext  = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(VIDEOS_BUCKET).upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from(VIDEOS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Elimina un video previamente subido al bucket "videos-ejercicios". */
export async function deleteEjercicioVideo(path: string): Promise<void> {
  const { error } = await supabase.storage.from(VIDEOS_BUCKET).remove([path]);
  if (error) throw error;
}

// ── Storage — GIFs propios ────────────────────────────────────────────────

/** Sube un GIF al bucket público "exercise-gifs" y devuelve su URL pública y ruta de storage. */
export async function uploadEjercicioGif(file: File): Promise<{ url: string; path: string }> {
  const ext  = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(GIFS_BUCKET).upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from(GIFS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Elimina un GIF previamente subido al bucket "exercise-gifs". */
export async function deleteEjercicioGif(path: string): Promise<void> {
  const { error } = await supabase.storage.from(GIFS_BUCKET).remove([path]);
  if (error) throw error;
}
