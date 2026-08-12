import { supabase } from '@/lib/supabase'

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
  const today = new Date().toISOString().slice(0, 10)
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
      fecha: new Date().toISOString().slice(0, 10),
    })
  if (error) throw error
}
