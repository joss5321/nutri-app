import { supabase } from '@/lib/supabase'

export type Perfil = {
  id: string
  nombre_completo: string | null
  sexo: string | null
  fecha_nacimiento: string | null
  altura_cm: number | null
  avatar_url: string | null
  plan_membresia: string
  created_at?: string
}

export async function fetchMiPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data as Perfil | null
}

export async function updateMiPerfil(
  userId: string,
  input: Partial<Pick<Perfil, 'sexo' | 'fecha_nacimiento' | 'altura_cm'>>
): Promise<void> {
  const { error } = await supabase.from('perfiles').update(input).eq('id', userId)
  if (error) throw error
}
