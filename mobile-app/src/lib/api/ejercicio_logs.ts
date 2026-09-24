import { supabase } from '@/lib/supabase'
import { getRadarToday } from '@/lib/radar-date'

export type EjercicioLog = {
  id: string
  user_id: string
  ejercicio_id: string
  peso_kg: number
  numero_serie: number
  sesion_id: string
  fecha: string
  created_at?: string
}

export async function fetchEjercicioLogs(userId: string, ejercicioId: string): Promise<EjercicioLog[]> {
  const { data, error } = await supabase
    .from('ejercicio_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('ejercicio_id', ejercicioId)
    .order('fecha', { ascending: true })
    .order('sesion_id', { ascending: true })
    .order('numero_serie', { ascending: true })
  if (error) throw error
  return data as EjercicioLog[]
}

export async function fetchAllEjercicioLogs(userId: string): Promise<EjercicioLog[]> {
  const { data, error } = await supabase
    .from('ejercicio_logs')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: true })
    .order('sesion_id', { ascending: true })
    .order('numero_serie', { ascending: true })
  if (error) throw error
  return data as EjercicioLog[]
}

export async function deleteEjercicioLogsForToday(
  userId: string,
  ejercicioId: string,
): Promise<void> {
  // R2.5 (Blueprint v1.1): "hoy" se calcula con la zona horaria oficial de
  // Radar (America/Mexico_City) — antes usaba toISOString(), que es UTC y
  // podía registrar/borrar bajo la fecha equivocada entre medianoche y
  // ~6am hora de México. ejercicio_logs es una señal que Radar usará
  // directamente para calcular adherencia de entrenamiento.
  const today = getRadarToday()
  const { error } = await supabase
    .from('ejercicio_logs')
    .delete()
    .eq('user_id', userId)
    .eq('ejercicio_id', ejercicioId)
    .eq('fecha', today)
  if (error) throw error
}

export async function createEjercicioLog(
  userId: string,
  ejercicioId: string,
  pesoKg: number,
  numeroSerie: number,
  sesionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('ejercicio_logs')
    .insert({
      user_id: userId,
      ejercicio_id: ejercicioId,
      peso_kg: pesoKg,
      numero_serie: numeroSerie,
      sesion_id: sesionId,
      fecha: getRadarToday(),
    })
  if (error) throw error
}
