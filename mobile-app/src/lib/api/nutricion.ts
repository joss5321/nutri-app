import { supabase } from '@/lib/supabase'

export type Equivalente = {
  id: string
  plan_id: string
  grupo: string
  icono: string | null
  desayuno: number
  colacion_1: number
  comida: number
  colacion_2: number
  cena: number
}

export async function fetchMisEquivalentes(
  userId: string
): Promise<{ planId: string; equivalentes: Equivalente[] } | null> {
  const { data: plan, error: planError } = await supabase
    .from('planes_nutricionales')
    .select('id')
    .eq('user_id', userId)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (planError) throw planError
  if (!plan) return null

  const { data: equivalentes, error: eqError } = await supabase
    .from('plan_equivalentes')
    .select('*')
    .eq('plan_id', plan.id)
  if (eqError) throw eqError

  return { planId: plan.id as string, equivalentes: equivalentes as Equivalente[] }
}
