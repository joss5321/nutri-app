import { supabase } from '@/lib/supabase'

export type Medida = {
  id: string
  user_id: string
  fecha: string
  peso_kg: number | null
  cintura_cm: number | null
  cadera_cm: number | null
  masa_muscular_pct: number | null
  grasa_pct: number | null
  brazo_cm: number | null
  pantorrilla_cm: number | null
  imc: number | null
  created_at?: string
}

export type MedidaInput = Omit<Medida, 'id' | 'user_id' | 'created_at'>

export async function fetchUltimaMedida(userId: string): Promise<Medida | null> {
  const { data, error } = await supabase
    .from('medidas')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as Medida | null
}

export async function fetchMedidasHistorial(userId: string): Promise<Medida[]> {
  const { data, error } = await supabase
    .from('medidas')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: true })
  if (error) throw error
  return data as Medida[]
}

export async function createMedida(userId: string, input: MedidaInput): Promise<void> {
  const { error } = await supabase
    .from('medidas')
    .insert({ ...input, user_id: userId })
  if (error) throw error
}
