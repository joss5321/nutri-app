import { supabase } from '@/lib/supabase'

export type Cita = {
  id: string
  user_id: string
  fecha: string
  hora: string
  tipo: string
  profesional: string | null
  modalidad: string | null
  notas: string | null
  estado: string
  created_at?: string
}

export async function fetchMisCitas(userId: string): Promise<Cita[]> {
  const { data, error } = await supabase
    .from('citas')
    .select('*')
    .eq('user_id', userId)
    .gte('fecha', new Date().toISOString().slice(0, 10))
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true })
  if (error) throw error
  return data as Cita[]
}
