import { supabase } from "@/lib/supabase";

// Datos de "Perfil profesional de nutriólogos" (Sección 83/84 de
// supabase_schema.sql, Fase B admin-web). El email/nombre/avatar/teléfono
// de cuenta siguen viviendo en `perfiles` (ver app/_data/perfiles.ts) — este
// archivo NUNCA los duplica.

const PORTADA_BUCKET = "avatars";
const CERTIFICACIONES_BUCKET = "certificaciones-nutriologos";
/** Expiración corta para signed URLs de certificados — nunca se persisten. */
const SIGNED_URL_TTL_SECONDS = 300;

// ── Tipos ────────────────────────────────────────────────────────────

export type Modalidad = "presencial" | "online" | "ambas";

export type NutriologoPerfil = {
  perfil_id: string;
  titulo_profesional: string | null;
  foto_portada_url: string | null;
  foto_portada_storage_path: string | null;
  telefono_profesional: string | null;
  correo_profesional: string | null;
  cedula_profesional: string | null;
  universidad: string | null;
  anio_egreso: number | null;
  anos_experiencia: number | null;
  descripcion_corta: string | null;
  biografia: string | null;
  idiomas: string[];
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  sitio_web_url: string | null;
  modalidad: Modalidad | null;
  perfil_visible: boolean;
  aceptando_pacientes: boolean;
  verificado: boolean;
  destacado: boolean;
  orden_directorio: number | null;
  created_at: string;
  updated_at: string;
};

/** Campos editables por cualquier dueño del perfil (o superadmin). */
export type NutriologoPerfilInput = Omit<
  NutriologoPerfil,
  "perfil_id" | "created_at" | "updated_at" | "verificado" | "destacado" | "orden_directorio"
>;

/** Campos reservados a superadmin — protegidos también por trigger en BD. */
export type NutriologoPerfilAdminInput = {
  verificado: boolean;
  destacado: boolean;
  orden_directorio: number | null;
};

export type Especialidad = { id: string; nombre: string };

export type NutriologoServicio = {
  id: string;
  nutriologo_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  moneda: string;
  duracion_min: number | null;
  modalidad: Modalidad;
  incluye: string[];
  activo: boolean;
  orden: number;
  created_at: string;
};
export type NutriologoServicioInput = Omit<NutriologoServicio, "id" | "nutriologo_id" | "created_at">;

export type NutriologoCertificacion = {
  id: string;
  nutriologo_id: string;
  nombre: string;
  institucion: string;
  anio: number | null;
  descripcion: string | null;
  documento_url: string | null;
  documento_storage_path: string | null;
  orden: number;
  created_at: string;
};
export type NutriologoCertificacionInput = Omit<
  NutriologoCertificacion,
  "id" | "nutriologo_id" | "created_at" | "documento_url" | "documento_storage_path"
>;

export type NutriologoExperiencia = {
  id: string;
  nutriologo_id: string;
  puesto: string;
  institucion: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  actualidad: boolean;
  descripcion: string | null;
  orden: number;
  created_at: string;
};
export type NutriologoExperienciaInput = Omit<NutriologoExperiencia, "id" | "nutriologo_id" | "created_at">;

export type NutriologoConsultorio = {
  id: string;
  nutriologo_id: string;
  nombre: string | null;
  direccion: string | null;
  colonia: string | null;
  alcaldia_municipio: string | null;
  ciudad: string | null;
  estado: string | null;
  codigo_postal: string | null;
  latitud: number | null;
  longitud: number | null;
  instrucciones_adicionales: string | null;
  orden: number;
  created_at: string;
};
export type NutriologoConsultorioInput = Omit<NutriologoConsultorio, "id" | "nutriologo_id" | "created_at">;

export type NutriologoDisponibilidad = {
  id: string;
  nutriologo_id: string;
  dia_semana: number; // ISO: 1=lunes .. 7=domingo
  disponible: boolean;
  hora_inicio: string | null;
  hora_fin: string | null;
};

// ── especialidades (catálogo) ───────────────────────────────────────

export async function fetchEspecialidadesCatalogo(): Promise<Especialidad[]> {
  const { data, error } = await supabase.from("especialidades").select("id, nombre").order("nombre");
  if (error) throw error;
  return data as Especialidad[];
}

export async function fetchNutriologoEspecialidades(nutriologoId: string): Promise<Especialidad[]> {
  const { data, error } = await supabase
    .from("nutriologo_especialidades")
    .select("especialidad_id, especialidades(id, nombre)")
    .eq("nutriologo_id", nutriologoId);
  if (error) throw error;
  return (data as unknown as { especialidades: Especialidad }[])
    .map((r) => r.especialidades)
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function addNutriologoEspecialidad(nutriologoId: string, especialidadId: string): Promise<void> {
  const { error } = await supabase
    .from("nutriologo_especialidades")
    .insert({ nutriologo_id: nutriologoId, especialidad_id: especialidadId });
  if (error) throw error;
}

export async function removeNutriologoEspecialidad(nutriologoId: string, especialidadId: string): Promise<void> {
  const { error } = await supabase
    .from("nutriologo_especialidades")
    .delete()
    .eq("nutriologo_id", nutriologoId)
    .eq("especialidad_id", especialidadId);
  if (error) throw error;
}

// ── nutriologo_perfiles ──────────────────────────────────────────────

export async function fetchNutriologoPerfil(perfilId: string): Promise<NutriologoPerfil | null> {
  const { data, error } = await supabase
    .from("nutriologo_perfiles")
    .select("*")
    .eq("perfil_id", perfilId)
    .maybeSingle();
  if (error) throw error;
  return data as NutriologoPerfil | null;
}

/** Crea el perfil profesional con defaults seguros — nunca lo publica automáticamente. */
export async function createNutriologoPerfil(perfilId: string): Promise<NutriologoPerfil> {
  const { data, error } = await supabase
    .from("nutriologo_perfiles")
    .insert({
      perfil_id: perfilId,
      idiomas: [],
      perfil_visible: false,
      aceptando_pacientes: true,
      verificado: false,
      destacado: false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as NutriologoPerfil;
}

export async function updateNutriologoPerfil(
  perfilId: string,
  input: Partial<NutriologoPerfilInput>
): Promise<NutriologoPerfil> {
  const { data, error } = await supabase
    .from("nutriologo_perfiles")
    .update(input)
    .eq("perfil_id", perfilId)
    .select("*")
    .single();
  if (error) throw error;
  return data as NutriologoPerfil;
}

/** Solo superadmin — verificado/destacado/orden_directorio. El trigger en BD es la autoridad real. */
export async function updateNutriologoPerfilAdmin(
  perfilId: string,
  input: Partial<NutriologoPerfilAdminInput>
): Promise<NutriologoPerfil> {
  const { data, error } = await supabase
    .from("nutriologo_perfiles")
    .update(input)
    .eq("perfil_id", perfilId)
    .select("*")
    .single();
  if (error) throw error;
  return data as NutriologoPerfil;
}

// ── Portada (bucket avatars, subcarpeta portadas/) ──────────────────

export async function uploadPortada(perfilId: string, file: File): Promise<{ url: string; path: string }> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `portadas/${perfilId}.${ext}`;
  const { error } = await supabase.storage.from(PORTADA_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(PORTADA_BUCKET).getPublicUrl(path);
  return { url: `${data.publicUrl}?t=${Date.now()}`, path };
}

export async function deletePortada(path: string): Promise<void> {
  const { error } = await supabase.storage.from(PORTADA_BUCKET).remove([path]);
  if (error) throw error;
}

// ── nutriologo_servicios ────────────────────────────────────────────

export async function fetchServicios(nutriologoId: string): Promise<NutriologoServicio[]> {
  const { data, error } = await supabase
    .from("nutriologo_servicios")
    .select("*")
    .eq("nutriologo_id", nutriologoId)
    .order("orden");
  if (error) throw error;
  return data as NutriologoServicio[];
}

export async function createServicio(
  nutriologoId: string,
  input: NutriologoServicioInput
): Promise<NutriologoServicio> {
  const { data, error } = await supabase
    .from("nutriologo_servicios")
    .insert({ ...input, nutriologo_id: nutriologoId })
    .select("*")
    .single();
  if (error) throw error;
  return data as NutriologoServicio;
}

export async function updateServicio(id: string, input: Partial<NutriologoServicioInput>): Promise<NutriologoServicio> {
  const { data, error } = await supabase.from("nutriologo_servicios").update(input).eq("id", id).select("*").single();
  if (error) throw error;
  return data as NutriologoServicio;
}

export async function deleteServicio(id: string): Promise<void> {
  const { error } = await supabase.from("nutriologo_servicios").delete().eq("id", id);
  if (error) throw error;
}

// ── nutriologo_certificaciones (documento en bucket PRIVADO) ────────

export async function fetchCertificaciones(nutriologoId: string): Promise<NutriologoCertificacion[]> {
  const { data, error } = await supabase
    .from("nutriologo_certificaciones")
    .select("*")
    .eq("nutriologo_id", nutriologoId)
    .order("orden");
  if (error) throw error;
  return data as NutriologoCertificacion[];
}

/**
 * URL firmada de corta duración para visualizar/descargar un certificado
 * dentro de admin-web. NUNCA se persiste — se genera solo cuando se
 * necesita (decisión explícita: bucket privado, sin getPublicUrl).
 */
export async function getCertificacionSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CERTIFICACIONES_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

async function uploadCertificacionDocumento(
  nutriologoId: string,
  file: File
): Promise<{ path: string }> {
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${nutriologoId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(CERTIFICACIONES_BUCKET).upload(path, file);
  if (error) throw error;
  return { path };
}

async function deleteCertificacionDocumento(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(CERTIFICACIONES_BUCKET).remove([storagePath]);
  if (error) throw error;
}

/**
 * Crea una certificación. Si se adjunta archivo: 1) sube el nuevo,
 * 2) recién entonces inserta la fila con el path ya confirmado — nunca al
 * revés, para no dejar una fila apuntando a un archivo que falló.
 */
export async function createCertificacion(
  nutriologoId: string,
  input: NutriologoCertificacionInput,
  file: File | null
): Promise<NutriologoCertificacion> {
  let documento_storage_path: string | null = null;
  if (file) {
    const uploaded = await uploadCertificacionDocumento(nutriologoId, file);
    documento_storage_path = uploaded.path;
  }
  const { data, error } = await supabase
    .from("nutriologo_certificaciones")
    .insert({ ...input, nutriologo_id: nutriologoId, documento_storage_path, documento_url: null })
    .select("*")
    .single();
  if (error) throw error;
  return data as NutriologoCertificacion;
}

/**
 * Actualiza una certificación. Si se reemplaza el archivo: sube el nuevo,
 * confirma la subida, actualiza la fila en BD y SOLO ENTONCES intenta
 * borrar el archivo anterior — si ese borrado falla, se reporta pero no se
 * revierte el nuevo registro (evita huérfanos "buenos" por un error de
 * limpieza).
 */
export async function updateCertificacion(
  certificacion: NutriologoCertificacion,
  input: NutriologoCertificacionInput,
  newFile: File | null
): Promise<{ certificacion: NutriologoCertificacion; cleanupWarning: string | null }> {
  let documento_storage_path = certificacion.documento_storage_path;
  const previousPath = certificacion.documento_storage_path;

  if (newFile) {
    const uploaded = await uploadCertificacionDocumento(certificacion.nutriologo_id, newFile);
    documento_storage_path = uploaded.path;
  }

  const { data, error } = await supabase
    .from("nutriologo_certificaciones")
    .update({ ...input, documento_storage_path })
    .eq("id", certificacion.id)
    .select("*")
    .single();
  if (error) throw error;

  let cleanupWarning: string | null = null;
  if (newFile && previousPath && previousPath !== documento_storage_path) {
    try {
      await deleteCertificacionDocumento(previousPath);
    } catch (err) {
      cleanupWarning = err instanceof Error ? err.message : "No se pudo eliminar el documento anterior.";
    }
  }

  return { certificacion: data as NutriologoCertificacion, cleanupWarning };
}

export async function deleteCertificacion(certificacion: NutriologoCertificacion): Promise<void> {
  const { error } = await supabase.from("nutriologo_certificaciones").delete().eq("id", certificacion.id);
  if (error) throw error;
  if (certificacion.documento_storage_path) {
    await deleteCertificacionDocumento(certificacion.documento_storage_path).catch(() => {});
  }
}

// ── nutriologo_experiencia ──────────────────────────────────────────

export async function fetchExperiencia(nutriologoId: string): Promise<NutriologoExperiencia[]> {
  const { data, error } = await supabase
    .from("nutriologo_experiencia")
    .select("*")
    .eq("nutriologo_id", nutriologoId)
    .order("orden");
  if (error) throw error;
  return data as NutriologoExperiencia[];
}

export async function createExperiencia(
  nutriologoId: string,
  input: NutriologoExperienciaInput
): Promise<NutriologoExperiencia> {
  const { data, error } = await supabase
    .from("nutriologo_experiencia")
    .insert({ ...input, nutriologo_id: nutriologoId })
    .select("*")
    .single();
  if (error) throw error;
  return data as NutriologoExperiencia;
}

export async function updateExperiencia(
  id: string,
  input: Partial<NutriologoExperienciaInput>
): Promise<NutriologoExperiencia> {
  const { data, error } = await supabase.from("nutriologo_experiencia").update(input).eq("id", id).select("*").single();
  if (error) throw error;
  return data as NutriologoExperiencia;
}

export async function deleteExperiencia(id: string): Promise<void> {
  const { error } = await supabase.from("nutriologo_experiencia").delete().eq("id", id);
  if (error) throw error;
}

// ── nutriologo_consultorios ──────────────────────────────────────────

export async function fetchConsultorios(nutriologoId: string): Promise<NutriologoConsultorio[]> {
  const { data, error } = await supabase
    .from("nutriologo_consultorios")
    .select("*")
    .eq("nutriologo_id", nutriologoId)
    .order("orden");
  if (error) throw error;
  return data as NutriologoConsultorio[];
}

export async function createConsultorio(
  nutriologoId: string,
  input: NutriologoConsultorioInput
): Promise<NutriologoConsultorio> {
  const { data, error } = await supabase
    .from("nutriologo_consultorios")
    .insert({ ...input, nutriologo_id: nutriologoId })
    .select("*")
    .single();
  if (error) throw error;
  return data as NutriologoConsultorio;
}

export async function updateConsultorio(
  id: string,
  input: Partial<NutriologoConsultorioInput>
): Promise<NutriologoConsultorio> {
  const { data, error } = await supabase.from("nutriologo_consultorios").update(input).eq("id", id).select("*").single();
  if (error) throw error;
  return data as NutriologoConsultorio;
}

export async function deleteConsultorio(id: string): Promise<void> {
  const { error } = await supabase.from("nutriologo_consultorios").delete().eq("id", id);
  if (error) throw error;
}

// ── nutriologo_disponibilidad ────────────────────────────────────────

export async function fetchDisponibilidad(nutriologoId: string): Promise<NutriologoDisponibilidad[]> {
  const { data, error } = await supabase
    .from("nutriologo_disponibilidad")
    .select("*")
    .eq("nutriologo_id", nutriologoId)
    .order("dia_semana");
  if (error) throw error;
  return data as NutriologoDisponibilidad[];
}

/** Upsert por día — un solo guardado por fila, respeta el unique(nutriologo_id, dia_semana). */
export async function upsertDisponibilidadDia(
  nutriologoId: string,
  diaSemana: number,
  input: { disponible: boolean; hora_inicio: string | null; hora_fin: string | null }
): Promise<NutriologoDisponibilidad> {
  const { data, error } = await supabase
    .from("nutriologo_disponibilidad")
    .upsert(
      { nutriologo_id: nutriologoId, dia_semana: diaSemana, ...input },
      { onConflict: "nutriologo_id,dia_semana" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as NutriologoDisponibilidad;
}
