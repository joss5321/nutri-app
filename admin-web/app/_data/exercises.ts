export const MUSCLE_GROUPS = [
  "Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps",
  "Piernas", "Glúteos", "Abdomen", "Isquiotibiales",
];

export type Exercise = {
  id: string;
  nombre: string;
  emoji: string;
  descripcion: string | null;
  grupo_muscular: string | null;
  grupos_secundarios: string[];
  video_url: string | null;
  video_storage_path: string | null;
  created_by: string | null;
  created_at?: string;
};

export type ExerciseInput = Omit<Exercise, "id" | "emoji" | "created_by" | "created_at">;
