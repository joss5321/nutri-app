import { supabase } from '@/lib/supabase'

export type RecetaIngrediente = {
  id: string
  receta_id: string
  orden: number
  descripcion: string
}

export type RecetaPaso = {
  id: string
  receta_id: string
  numero: number
  descripcion: string
}

export type RecetaCompleta = {
  id: string
  nombre: string
  emoji: string | null
  tipo: string | null
  categoria_nutricional: string | null
  tags: string | null
  tiempo_prep_min: number | null
  tiempo_coccion_min: number | null
  tiempo_min: number | null
  nivel: string | null
  calorias: number | null
  porciones: string | null
  proteinas_g: number | null
  carbohidratos_g: number | null
  grasas_g: number | null
  ingredientes: RecetaIngrediente[]
  pasos: RecetaPaso[]
}

type GuardadaRow = {
  receta_id: string
  recetas: Omit<RecetaCompleta, 'ingredientes' | 'pasos'> & {
    receta_ingredientes: RecetaIngrediente[] | null
    receta_pasos: RecetaPaso[] | null
  }
}

export async function fetchMisRecetas(userId: string): Promise<RecetaCompleta[]> {
  const { data, error } = await supabase
    .from('recetas_guardadas')
    .select('receta_id, recetas(*, receta_ingredientes(*), receta_pasos(*))')
    .eq('user_id', userId)
  if (error) throw error

  return (data as unknown as GuardadaRow[]).map((row) => {
    const { receta_ingredientes, receta_pasos, ...rest } = row.recetas
    return {
      ...rest,
      ingredientes: [...(receta_ingredientes ?? [])].sort((a, b) => a.orden - b.orden),
      pasos: [...(receta_pasos ?? [])].sort((a, b) => a.numero - b.numero),
    }
  })
}
