import { supabase } from '@/lib/supabase'

export type EjercicioLog = {
  id: string
  user_id: string
  ejercicio_id: string
  peso_kg: number
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
    .limit(10)
  if (error) throw error
  return data as EjercicioLog[]
}

export async function fetchAllEjercicioLogs(userId: string): Promise<EjercicioLog[]> {
  const { data, error } = await supabase
    .from('ejercicio_logs')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: true })
  if (error) throw error
  return data as EjercicioLog[]
}

export async function createEjercicioLog(userId: string, ejercicioId: string, pesoKg: number): Promise<void> {
  const { error } = await supabase
    .from('ejercicio_logs')
    .insert({
      user_id: userId,
      ejercicio_id: ejercicioId,
      peso_kg: pesoKg,
      fecha: new Date().toISOString().slice(0, 10),
    })
  if (error) throw error
}
