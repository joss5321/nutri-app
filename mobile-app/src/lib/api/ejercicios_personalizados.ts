import { supabase } from '@/lib/supabase'

export type EjercicioPersonalizado = {
  id: string
  user_id: string
  nombre: string
  grupo_muscular: string | null
  series: number | null
  repeticiones: string | null
  peso_sugerido_kg: number | null
  unidad_peso: string
  descanso_seg: number | null
  notas: string | null
  ultima_vez_usado: string | null
  created_at?: string
  updated_at?: string
}

export type EjercicioPersonalizadoInput = Omit<
  EjercicioPersonalizado,
  'id' | 'user_id' | 'ultima_vez_usado' | 'created_at' | 'updated_at'
>

export async function fetchMisEjerciciosPersonalizados(userId: string): Promise<EjercicioPersonalizado[]> {
  const { data, error } = await supabase
    .from('ejercicios_personalizados')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as EjercicioPersonalizado[]
}

export async function createEjercicioPersonalizado(
  userId: string,
  input: EjercicioPersonalizadoInput
): Promise<void> {
  const { error } = await supabase.from('ejercicios_personalizados').insert({ ...input, user_id: userId })
  if (error) throw error
}

export async function updateEjercicioPersonalizado(
  id: string,
  input: Partial<EjercicioPersonalizadoInput>
): Promise<void> {
  const { error } = await supabase.from('ejercicios_personalizados').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteEjercicioPersonalizado(id: string): Promise<void> {
  const { error } = await supabase.from('ejercicios_personalizados').delete().eq('id', id)
  if (error) throw error
}

export async function marcarEjercicioPersonalizadoUsado(id: string): Promise<void> {
  const { error } = await supabase
    .from('ejercicios_personalizados')
    .update({ ultima_vez_usado: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
