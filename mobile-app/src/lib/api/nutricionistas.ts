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

/**
 * Reasigna el nutriólogo del paciente autenticado. nutricionista_id está
 * protegido por trigger (ver supabase_schema.sql) — ni el propio paciente
 * puede escribirlo con un update directo, por eso pasa por esta Edge
 * Function (valida identidad + que el destino sea un nutriólogo real).
 */
export async function cambiarNutriologo(nutricionistaId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('cambiar-nutriologo', {
    body: { nutricionistaId },
  })
  if (error) throw error
}
