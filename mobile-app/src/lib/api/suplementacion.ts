import { supabase } from '@/lib/supabase'
import { withCache, cacheInvalidate } from '@/lib/cache'

export type SuplementoAsignado = {
  id: string
  suplemento_id: string
  dosis: string | null
  hora: string | null
  momento: string | null
  notas: string | null
  suplementos: {
    id: string
    nombre: string
    icono: string
    marca: string | null
    gramaje: string | null
    imagen_url: string | null
  }
}

export const MOMENTOS_CONSUMO = [
  'Ayuno',
  'Después del desayuno',
  'Preentreno',
  'Después de la comida',
] as const

export async function fetchMisSuplementos(userId: string): Promise<SuplementoAsignado[]> {
  return withCache(`suplementos_${userId}`, async () => {
    const { data, error } = await supabase
      .from('plan_suplementacion')
      .select('*, suplementos(id, nombre, icono, marca, gramaje, imagen_url)')
      .eq('user_id', userId)
    if (error) throw error
    return data as SuplementoAsignado[]
  })
}

export async function updateSuplementoHora(id: string, hora: string): Promise<void> {
  const { error } = await supabase
    .from('plan_suplementacion')
    .update({ hora })
    .eq('id', id)
  if (error) throw error
}

export async function updateSuplementoMomento(id: string, momento: string): Promise<void> {
  const { error } = await supabase
    .from('plan_suplementacion')
    .update({ momento })
    .eq('id', id)
  if (error) throw error
}

export async function updateSuplementoNotas(id: string, notas: string | null): Promise<void> {
  const { error } = await supabase
    .from('plan_suplementacion')
    .update({ notas })
    .eq('id', id)
  if (error) throw error
}

export async function invalidateSuplementosCache(userId: string): Promise<void> {
  await cacheInvalidate(`suplementos_${userId}`)
}
