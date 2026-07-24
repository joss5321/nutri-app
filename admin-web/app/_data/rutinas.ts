import { supabase } from "@/lib/supabase";

export const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export type SerieDetalle = {
  reps: string | null;
  peso: number | null;
};

export type RutinaEjercicio = {
  id: string;
  dia_id: string;
  ejercicio_id: string;
  orden: number;
  series: number | null;
  repeticiones: string | null;
  peso_sugerido_kg: number | null;
  descanso_seg: number | null;
  rir: number | null;
  rpe: number | null;
  tipo_esfuerzo: "reps" | "tiempo";
  series_detalle: SerieDetalle[] | null;
  unidad_peso: "kg" | "lbs" | null;
};

export type RutinaDia = {
  id: string;
  rutina_id: string;
  numero_dia: number;
  nombre_dia: string;
  es_descanso: boolean;
  rutina_ejercicios: RutinaEjercicio[];
};

export type Rutina = {
  id: string;
  user_id: string;
  nombre: string;
  unidad_peso: "kg" | "lbs";
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activa: boolean;
  created_at?: string;
  rutina_dias: RutinaDia[];
};

export type EjercicioInput = Omit<RutinaEjercicio, "id" | "dia_id">;

export type DiaInput = {
  numero_dia: number;
  nombre_dia: string;
  es_descanso: boolean;
  ejercicios: EjercicioInput[];
};

export type RutinaInput = {
  nombre: string;
  unidad_peso: "kg" | "lbs";
  dias: DiaInput[];
};

const RUTINA_SELECT = "*, rutina_dias(*, rutina_ejercicios(*))";

function normalizeRutina(rutina: Rutina): Rutina {
  return {
    ...rutina,
    rutina_dias: [...(rutina.rutina_dias ?? [])]
      .sort((a, b) => a.numero_dia - b.numero_dia)
      .map((dia) => ({
        ...dia,
        rutina_ejercicios: [...(dia.rutina_ejercicios ?? [])].sort((a, b) => a.orden - b.orden),
      })),
  };
}

export async function fetchRutinaActiva(userId: string): Promise<Rutina | null> {
  const { data, error } = await supabase
    .from("rutinas")
    .select(RUTINA_SELECT)
    .eq("user_id", userId)
    .eq("activa", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeRutina(data as Rutina) : null;
}

async function replaceDias(rutinaId: string, dias: DiaInput[]): Promise<void> {
  const { error: deleteError } = await supabase.from("rutina_dias").delete().eq("rutina_id", rutinaId);
  if (deleteError) throw deleteError;

  for (const dia of dias) {
    const { data: diaRow, error: diaError } = await supabase
      .from("rutina_dias")
      .insert({
        rutina_id: rutinaId,
        numero_dia: dia.numero_dia,
        nombre_dia: dia.nombre_dia,
        es_descanso: dia.es_descanso,
      })
      .select()
      .single();
    if (diaError) throw diaError;

    if (dia.ejercicios.length > 0) {
      const rows = dia.ejercicios.map((ej) => ({ ...ej, dia_id: diaRow.id }));
      const { error: ejError } = await supabase.from("rutina_ejercicios").insert(rows);
      if (ejError) throw ejError;
    }
  }
}

export async function saveRutina(userId: string, input: RutinaInput, rutinaId?: string): Promise<Rutina> {
  let id = rutinaId;

  if (id) {
    const { error } = await supabase
      .from("rutinas")
      .update({ nombre: input.nombre, unidad_peso: input.unidad_peso })
      .eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("rutinas")
      .insert({ user_id: userId, nombre: input.nombre, unidad_peso: input.unidad_peso })
      .select()
      .single();
    if (error) throw error;
    id = data.id;
  }

  await replaceDias(id!, input.dias);

  const { data: full, error: fetchError } = await supabase
    .from("rutinas")
    .select(RUTINA_SELECT)
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  return normalizeRutina(full as Rutina);
}

export async function deleteRutina(id: string): Promise<void> {
  const { error } = await supabase.from("rutinas").delete().eq("id", id);
  if (error) throw error;
}
