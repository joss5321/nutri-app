import { supabase } from '@/lib/supabase'

/** Fila de public.nutriologos_directorio_publico (Sección 83) — perfiles con perfil_visible=true. */
export type NutriologoDirectorio = {
  id: string
  nombre_completo: string | null
  avatar_url: string | null
  titulo_profesional: string | null
  foto_portada_url: string | null
  cedula_profesional: string | null
  universidad: string | null
  anos_experiencia: number | null
  descripcion_corta: string | null
  biografia: string | null
  idiomas: string[] | null
  modalidad: 'presencial' | 'online' | 'ambas' | null
  aceptando_pacientes: boolean
  verificado: boolean
  destacado: boolean
  orden_directorio: number | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  sitio_web_url: string | null
  especialidades: string[] | null
  precio_desde: number | null
}

export type NutriologoServicioPublico = {
  id: string
  nutriologo_id: string
  nombre: string
  descripcion: string | null
  precio: number
  moneda: string
  duracion_min: number | null
  modalidad: 'online' | 'presencial' | 'ambas'
  incluye: string[]
  orden: number
}

export type NutriologoExperienciaPublico = {
  id: string
  nutriologo_id: string
  puesto: string
  institucion: string
  fecha_inicio: string | null
  fecha_fin: string | null
  actualidad: boolean
  descripcion: string | null
  orden: number
}

export type NutriologoCertificacionPublico = {
  id: string
  nutriologo_id: string
  nombre: string
  institucion: string
  anio: number | null
  descripcion: string | null
  orden: number
}

export type NutriologoConsultorioPublico = {
  id: string
  nutriologo_id: string
  nombre: string | null
  direccion: string | null
  colonia: string | null
  alcaldia_municipio: string | null
  ciudad: string | null
  estado: string | null
  codigo_postal: string | null
  latitud: number | null
  longitud: number | null
  instrucciones_adicionales: string | null
  orden: number
}

export type NutriologoDetalle = {
  servicios: NutriologoServicioPublico[]
  experiencia: NutriologoExperienciaPublico[]
  certificaciones: NutriologoCertificacionPublico[]
  consultorios: NutriologoConsultorioPublico[]
}

/**
 * Perfiles profesionales publicados (perfil_visible=true), en UNA sola
 * consulta sin filtro — se cruza en memoria contra la lista base de
 * fetchNutricionistas() (nutricionistas_publicos) para no cambiar quién
 * aparece en el registro, solo para enriquecer la tarjeta de quien ya
 * publicó su perfil.
 */
export async function fetchNutriologosDirectorio(): Promise<NutriologoDirectorio[]> {
  const { data, error } = await supabase.from('nutriologos_directorio_publico').select('*')
  if (error) throw error
  return data as NutriologoDirectorio[]
}

/**
 * Detalle completo de UN nutriólogo, solo al abrir "Ver perfil" (nunca por
 * cada tarjeta de la lista).
 */
export async function fetchNutriologoDetalle(nutriologoId: string): Promise<NutriologoDetalle> {
  const [servicios, experiencia, certificaciones, consultorios] = await Promise.all([
    supabase.from('nutriologo_servicios_publico').select('*').eq('nutriologo_id', nutriologoId).order('orden'),
    supabase.from('nutriologo_experiencia_publico').select('*').eq('nutriologo_id', nutriologoId).order('orden'),
    supabase.from('nutriologo_certificaciones_publico').select('*').eq('nutriologo_id', nutriologoId).order('orden'),
    supabase.from('nutriologo_consultorios_publico').select('*').eq('nutriologo_id', nutriologoId).order('orden'),
  ])
  if (servicios.error) throw servicios.error
  if (experiencia.error) throw experiencia.error
  if (certificaciones.error) throw certificaciones.error
  if (consultorios.error) throw consultorios.error
  return {
    servicios: servicios.data as NutriologoServicioPublico[],
    experiencia: experiencia.data as NutriologoExperienciaPublico[],
    certificaciones: certificaciones.data as NutriologoCertificacionPublico[],
    consultorios: consultorios.data as NutriologoConsultorioPublico[],
  }
}
