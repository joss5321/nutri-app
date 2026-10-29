import { supabase } from '@/lib/supabase'

export type Perfil = {
  id: string
  nombre_completo: string | null
  sexo: string | null
  fecha_nacimiento: string | null
  altura_cm: number | null
  avatar_url: string | null
  plan_membresia: string
  nutricionista_id: string | null
  stripe_customer_id: string | null
  telefono: string | null
  objetivo: string | null
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
  input: Partial<Pick<Perfil, 'sexo' | 'fecha_nacimiento' | 'altura_cm' | 'telefono' | 'objetivo'>>
): Promise<void> {
  const { error } = await supabase.from('perfiles').update(input).eq('id', userId)
  if (error) throw error
}

/**
 * Radar (Blueprint v1.1, R3) — marca "estuve activo hoy". El RPC usa
 * auth.uid() del lado del servidor (no recibe ningún id) y solo puede
 * tocar la fila del propio caller; ver registrar_actividad() en
 * supabase_schema.sql (Sección 70) para la protección a nivel de columna.
 */
export async function registrarActividad(): Promise<void> {
  const { error } = await supabase.rpc('registrar_actividad')
  if (error) throw error
}
