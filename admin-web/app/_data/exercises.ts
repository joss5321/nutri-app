// ── Listas de opciones ────────────────────────────────────────────────────

/** Grupos musculares usados en el formulario de crear/editar ejercicios manuales. */
export const MUSCLE_GROUPS = [
  "Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps",
  "Piernas", "Glúteos", "Abdomen", "Isquiotibiales",
];

// ── Tipos principales ─────────────────────────────────────────────────────

/**
 * Origen del ejercicio.
 * - 'manual'   → creado por un admin dentro de MyfitTrack
 * - 'workoutx' → importado desde la biblioteca WorkoutX (catálogo global, solo lectura para admins)
 */
export type ExerciseSource = "manual" | "workoutx";

/** Representa una fila completa de la tabla `ejercicios`. */
export type Exercise = {
  id: string;
  nombre: string;
  emoji: string;
  descripcion: string | null;
  /** Pasos de ejecución. TEXT[] en BD. Antes era TEXT (sin usar); ahora es array de instrucciones. */
  instrucciones: string[] | null;
  grupo_muscular: string | null;
  grupos_secundarios: string[];
  video_url: string | null;
  video_storage_path: string | null;

  // Identificación de origen
  source: ExerciseSource;
  external_id: string | null;

  // Multimedia
  gif_url: string | null;
  gif_storage_path: string | null;

  // Campos WorkoutX
  body_part: string | null;
  equipment: string | null;
  difficulty: string | null;
  category: string | null;
  mechanic: string | null;
  force: string | null;
  met: number | null;
  calories_per_minute: number | null;
  is_unilateral: boolean | null;
  popularity_rank: number | null;
  recommended_sets: string | null;
  recommended_reps: string | null;
  joint_focus: string | null;
  intensity_level: string | null;
  movement_tags: string[];
  language: string | null;

  created_by: string | null;
  created_at?: string;
};

/**
 * Payload para crear o actualizar un ejercicio manual.
 * Excluye los campos de solo-lectura y los gestionados por el servidor.
 */
export type ExerciseInput = {
  nombre: string;
  descripcion: string | null;
  grupo_muscular: string | null;
  grupos_secundarios: string[];
  video_url: string | null;
  video_storage_path: string | null;
  gif_url: string | null;
  gif_storage_path: string | null;
};

// ── Parámetros para el catálogo paginado ─────────────────────────────────

export type EjerciciosFiltros = {
  search?: string;
  grupo?: string;       // grupo_muscular (principal o secundario)
  bodyPart?: string;    // body_part (campo WorkoutX)
  equipment?: string;
  difficulty?: string;
  category?: string;
  source?: ExerciseSource | "todos";
  page?: number;
  pageSize?: number;
};

export type EjercicioPaginado = {
  data: Exercise[];
  total: number;
};
