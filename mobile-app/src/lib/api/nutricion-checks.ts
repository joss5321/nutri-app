import { supabase } from '@/lib/supabase'
import { getRadarToday } from '@/lib/radar-date'

// Radar (Blueprint v1.1, R2) — check diario de nutrición. 3 estados en vez
// de boolean: un sí/no binario pierde la información intermedia y refuerza
// el patrón "todo o nada" que Radar busca dejar de reforzar.
export type NutricionCheckEstado = 'seguido' | 'parcial' | 'no_seguido'

export type NutricionCheck = {
  id: string
  user_id: string
  fecha: string
  estado: NutricionCheckEstado
  nota: string | null
  created_at?: string
}

/** El check de hoy, si el paciente ya respondió. null si todavía no. */
export async function fetchNutricionCheckHoy(userId: string): Promise<NutricionCheck | null> {
  const { data, error } = await supabase
    .from('nutricion_checks')
    .select('*')
    .eq('user_id', userId)
    .eq('fecha', getRadarToday())
    .maybeSingle()
  if (error) throw error
  return data as NutricionCheck | null
}

/**
 * Crea o corrige el check de HOY (upsert por user_id+fecha). La RLS
 * (nutricion_checks_update) solo permite corregir el check del día actual —
 * un intento de tocar un día pasado falla en el servidor, no solo aquí.
 */
export async function registrarNutricionCheck(
  userId: string,
  estado: NutricionCheckEstado,
  nota?: string,
): Promise<NutricionCheck> {
  const { data, error } = await supabase
    .from('nutricion_checks')
    .upsert(
      { user_id: userId, fecha: getRadarToday(), estado, nota: nota?.trim() || null },
      { onConflict: 'user_id,fecha' },
    )
    .select()
    .single()
  if (error) throw error
  return data as NutricionCheck
}
