import { supabase } from '@/lib/supabase'
import { withCache } from '@/lib/cache'
import { getRadarToday } from '@/lib/radar-date'

export type EjercicioInfo = {
  id: string
  nombre: string
  emoji: string | null
  grupo_muscular: string | null
  grupos_secundarios: string[] | null
  descripcion: string | null
  video_url: string | null
  gif_url: string | null
}

export type SerieDetalle = {
  reps: string | null
  peso: number | null
}

export type RutinaEjercicio = {
  id: string
  dia_id: string
  ejercicio_id: string
  orden: number
  series: number | null
  repeticiones: string | null
  peso_sugerido_kg: number | null
  descanso_seg: number | null
  rir: number | null
  rpe: number | null
  series_detalle: SerieDetalle[] | null
  ejercicios: EjercicioInfo
}

export type RutinaDia = {
  id: string
  rutina_id: string
  numero_dia: number
  nombre_dia: string
  es_descanso: boolean
  rutina_ejercicios: RutinaEjercicio[]
}

export type RutinaCompleta = {
  id: string
  user_id: string
  nombre: string
  activa: boolean
  created_at?: string
  rutina_dias: RutinaDia[]
}

const SELECT = '*, rutina_dias(*, rutina_ejercicios(*, ejercicios(id, nombre, emoji, grupo_muscular, grupos_secundarios, descripcion, video_url, gif_url)))'

export async function fetchMiRutina(userId: string): Promise<RutinaCompleta | null> {
  return withCache(`rutina_${userId}`, async () => {
    const { data, error } = await supabase
      .from('rutinas')
      .select(SELECT)
      .eq('user_id', userId)
      .eq('activa', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return null

    const rutina = data as RutinaCompleta
    rutina.rutina_dias = [...(rutina.rutina_dias ?? [])]
      .sort((a, b) => a.numero_dia - b.numero_dia)
      .map((dia) => ({
        ...dia,
        rutina_ejercicios: [...(dia.rutina_ejercicios ?? [])].sort((a, b) => a.orden - b.orden),
      }))
    return rutina
  })
}

// ─── Radar (Blueprint v1.1, R1) — días de rutina completados ────────────────

/** IDs de rutina_dias marcados como completados dentro del rango [weekStart, weekEnd] (fechas 'YYYY-MM-DD'). */
export async function fetchDiasCompletadosSemana(
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('dias_completados')
    .select('dia_id')
    .eq('user_id', userId)
    .gte('fecha', weekStart)
    .lte('fecha', weekEnd)
  if (error) throw error
  return (data ?? []).map((r) => r.dia_id as string)
}

/** Marca un día de rutina como completado hoy. Idempotente: repetir la misma marca el mismo día no falla ni duplica. */
export async function marcarDiaCompletado(userId: string, diaId: string): Promise<void> {
  const { error } = await supabase
    .from('dias_completados')
    .upsert(
      { user_id: userId, dia_id: diaId, fecha: getRadarToday() },
      { onConflict: 'user_id,dia_id,fecha', ignoreDuplicates: true },
    )
  if (error) throw error
}
