import { supabase } from '@/lib/supabase'

export type SuplementoAsignado = {
  id: string
  suplemento_id: string
  dosis: string | null
  hora: string | null
  momento: string | null
  suplementos: {
    id: string
    nombre: string
    icono: string
    marca: string | null
    gramaje: string | null
    imagen_url: string | null
  }
}

export async function fetchMisSuplementos(userId: string): Promise<SuplementoAsignado[]> {
  const { data, error } = await supabase
    .from('plan_suplementacion')
    .select('*, suplementos(id, nombre, icono, marca, gramaje, imagen_url)')
    .eq('user_id', userId)
  if (error) throw error
  return data as SuplementoAsignado[]
}
