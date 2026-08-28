import { supabase } from '@/lib/supabase'

export type Nutricionista = {
  id: string
  nombre_completo: string | null
  email: string | null
  avatar_url: string | null
}

/** Fetches all nutritionists — publicly accessible (no auth required). */
export async function fetchNutricionistas(): Promise<Nutricionista[]> {
  const { data, error } = await supabase
    .from('nutricionistas_publicos')
    .select('id, nombre_completo, email, avatar_url')
    .order('nombre_completo', { ascending: true })
  if (error) throw error
  return data as Nutricionista[]
}
