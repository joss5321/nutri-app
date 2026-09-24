import { supabase } from '@/lib/supabase'
import { withCache, cacheInvalidate } from '@/lib/cache'
import { getRadarToday } from '@/lib/radar-date'

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

// ─── Radar (Blueprint v1.1, R3) — suplemento_logs ────────────────────────────

/** IDs de plan_suplementacion marcados como "tomado" HOY. */
export async function fetchSuplementoLogsHoy(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('suplemento_logs')
    .select('plan_suplemento_id, tomado')
    .eq('user_id', userId)
    .eq('fecha', getRadarToday())
  if (error) throw error
  return new Set(
    (data ?? []).filter((r) => r.tomado).map((r) => r.plan_suplemento_id as string)
  )
}

/** Marca (o desmarca) un suplemento como tomado hoy. Toggle bidireccional — upsert sobre el log del día. */
export async function registrarSuplementoTomado(
  userId: string,
  planSuplementoId: string,
  tomado: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('suplemento_logs')
    .upsert(
      { user_id: userId, plan_suplemento_id: planSuplementoId, fecha: getRadarToday(), tomado },
      { onConflict: 'user_id,plan_suplemento_id,fecha' },
    )
  if (error) throw error
}
