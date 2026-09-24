// Capa de datos de MyFitTrack Radar (R5) — SOLO lectura. El motor en BD
// (calcular_radar_paciente / ejecutar_radar_diario, Secciones 72-78) sigue
// siendo la única fuente de verdad: este archivo únicamente lee
// score_snapshots (vía la vista radar_ultimo_snapshot, Sección 79),
// radar_alertas y perfiles — nunca recalcula un score ni reinterpreta una
// regla. El orden de prioridad se calcula aquí porque es presentación
// (cómo se acomodan filas ya calculadas), no cálculo de negocio.
import { supabase } from "@/lib/supabase";

export type RadarEstado = "rojo" | "naranja" | "amarillo" | "verde" | "blanco";
export type AdherenceCalidad = "completo" | "parcial" | "incompleto" | null;
export type MotivoResolucion = "intervencion" | "auto_resuelta" | "sin_accion" | null;

export interface ReglaDisparada {
  id: string;
  activa: boolean;
  puntos?: number;
  dia?: number | null;
}

export interface RadarSnapshot {
  id: string;
  paciente_id: string;
  nutriologo_id: string | null;
  snapshot_date: string;
  rules_version: string;
  nutrition_adherence: number | null;
  nutrition_confidence: number;
  training_adherence: number | null;
  training_confidence: number | null;
  adherence_global: number | null;
  adherence_global_calidad: AdherenceCalidad;
  data_confidence_global: number;
  riesgo_confirmado_puntos: number;
  senal_insuficiente: boolean;
  estado: RadarEstado;
  reglas_disparadas: ReglaDisparada[];
  explicaciones: string[];
  accion_sugerida: string | null;
  created_at: string;
}

export interface RadarAlerta {
  id: string;
  paciente_id: string;
  nutriologo_id: string | null;
  regla_principal: string;
  tier: "alta" | "media" | "baja";
  estado_alerta: "abierta" | "resuelta";
  fecha_apertura: string;
  fecha_resolucion: string | null;
  motivo_resolucion: MotivoResolucion;
  dias_condicion_ausente: number;
  cooldown_until: string | null;
  recurrence_of: string | null;
  intervention_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── R6/R7: intervenciones ────────────────────────────────────────────────
// Igual disciplina que el resto de este archivo: el frontend solo registra
// (vía RPC atómica) y lee — nunca decide por sí mismo si una alerta debe
// resolverse, ni calcula cooldown, ni clasifica un resultado (eso lo hace
// exclusivamente evaluar_resultado_intervencion en la base de datos,
// Sección 81). Este archivo solo lee las columnas ya calculadas y arma el
// copy observacional de la UI — nunca re-decide mejoro/estable/empeoro.

export type TipoIntervencion =
  | "contacto"
  | "ajuste_alimentacion"
  | "ajuste_rutina"
  | "reagendar_cita"
  | "motivacion_seguimiento"
  | "sin_accion"
  | "otra";

export type MotivoSinAccion =
  | "hable_recientemente"
  | "no_relevante"
  | "comportamiento_habitual"
  | "esperare_consulta"
  | "otro";

export type ResultadoEstado = "pendiente" | "mejoro" | "estable" | "empeoro" | "inconcluso" | "confundido";

export interface Intervencion {
  id: string;
  paciente_id: string;
  nutriologo_id: string | null;
  alerta_id: string | null;
  tipo: TipoIntervencion;
  subtipo: string | null;
  nota: string | null;
  motivo_sin_accion: MotivoSinAccion | null;
  // "Antes" — congelado al momento de la intervención (R6), nunca recalculado.
  adherence_antes: number | null;
  risk_points_antes: number | null;
  confianza_antes: number | null;
  snapshot_id: string | null;
  rules_version: string | null;
  // "Después" — poblado por evaluar_resultado_intervencion al cerrar la
  // ventana de 14 días (R7). Todo queda NULL mientras resultado_estado
  // sigue en 'pendiente'.
  adherence_despues: number | null;
  risk_points_despues: number | null;
  confianza_despues: number | null;
  snapshot_id_despues: string | null;
  resultado_estado: ResultadoEstado;
  resultado_calculado_at: string | null;
  rules_version_resultado: string | null;
  confound_detalle: string | null;
  created_at: string;
}

// Catálogo único de tipos/subtipos — la RPC valida exactamente estas
// mismas combinaciones (Sección 80 de supabase_schema.sql), así que
// cualquier cambio aquí debe reflejarse también ahí. "Otra" de cada
// categoría se guarda con un sufijo distinto (otro_contacto/
// otro_alimentacion/otro_rutina) para que se pueda distinguir después sin
// releer la nota libre — no son categorías nuevas, es la misma opción
// "Otra" de cada paso.
export const CATALOGO_TIPOS: {
  value: TipoIntervencion;
  label: string;
  subtipos?: { value: string; label: string }[];
}[] = [
  {
    value: "contacto",
    label: "Contacté al paciente",
    subtipos: [
      { value: "whatsapp", label: "WhatsApp" },
      { value: "llamada", label: "Llamada" },
      { value: "consulta", label: "En consulta" },
      { value: "otro_contacto", label: "Otro" },
    ],
  },
  {
    value: "ajuste_alimentacion",
    label: "Ajusté alimentación",
    subtipos: [
      { value: "flexibilizacion_finde", label: "Flexibilicé fin de semana" },
      { value: "cambio_equivalentes", label: "Cambié equivalentes" },
      { value: "cambio_alimentos", label: "Cambié alimentos" },
      { value: "ajuste_horarios", label: "Ajusté horarios" },
      { value: "otro_alimentacion", label: "Otro" },
    ],
  },
  {
    value: "ajuste_rutina",
    label: "Ajusté rutina",
    subtipos: [
      { value: "cambio_ejercicios", label: "Cambié ejercicios" },
      { value: "cambio_volumen", label: "Cambié volumen" },
      { value: "cambio_frecuencia", label: "Cambié frecuencia" },
      { value: "ajuste_cargas", label: "Ajusté cargas" },
      { value: "otro_rutina", label: "Otro" },
    ],
  },
  { value: "reagendar_cita", label: "Reagendé cita" },
  { value: "motivacion_seguimiento", label: "Motivación / seguimiento" },
  { value: "sin_accion", label: "Sin acción" },
  { value: "otra", label: "Otra" },
];

export const CATALOGO_MOTIVOS_SIN_ACCION: { value: MotivoSinAccion; label: string }[] = [
  { value: "hable_recientemente", label: "Ya hablé recientemente" },
  { value: "no_relevante", label: "No me parece relevante" },
  { value: "comportamiento_habitual", label: "Es su comportamiento habitual" },
  { value: "esperare_consulta", label: "Esperaré a la consulta" },
  { value: "otro", label: "Otro" },
];

const ETIQUETAS_TIPO: Record<string, string> = Object.fromEntries(
  CATALOGO_TIPOS.map((t) => [t.value, t.label])
);
const ETIQUETAS_SUBTIPO: Record<string, string> = Object.fromEntries(
  CATALOGO_TIPOS.flatMap((t) => t.subtipos ?? []).map((s) => [s.value, s.label])
);
const ETIQUETAS_MOTIVO_SIN_ACCION: Record<string, string> = Object.fromEntries(
  CATALOGO_MOTIVOS_SIN_ACCION.map((m) => [m.value, m.label])
);

export function etiquetaTipoIntervencion(tipo: string): string {
  return ETIQUETAS_TIPO[tipo] ?? tipo;
}
export function etiquetaSubtipo(subtipo: string | null): string | null {
  if (!subtipo) return null;
  return ETIQUETAS_SUBTIPO[subtipo] ?? subtipo;
}
export function etiquetaMotivoSinAccion(motivo: string | null): string | null {
  if (!motivo) return null;
  return ETIQUETAS_MOTIVO_SIN_ACCION[motivo] ?? motivo;
}

/**
 * Única puerta de escritura de R6 — llama a la RPC atómica
 * registrar_intervencion_radar (Sección 80): inserta la intervención y, si
 * hay alerta_id, resuelve esa alerta en la misma transacción. El frontend
 * nunca hace dos escrituras separadas ni decide el motivo de resolución.
 */
export async function registrarIntervencion(input: {
  pacienteId: string;
  alertaId?: string | null;
  tipo: TipoIntervencion;
  subtipo?: string | null;
  nota?: string | null;
  motivoSinAccion?: MotivoSinAccion | null;
}): Promise<Intervencion> {
  const { data, error } = await supabase.rpc("registrar_intervencion_radar", {
    p_paciente_id: input.pacienteId,
    p_alerta_id: input.alertaId ?? null,
    p_tipo: input.tipo,
    p_subtipo: input.subtipo ?? null,
    p_nota: input.nota ?? null,
    p_motivo_sin_accion: input.motivoSinAccion ?? null,
  });
  if (error) throw error;
  return data as Intervencion;
}

/** Historial de intervenciones de un paciente (para el tab Radar). */
export async function fetchHistorialIntervenciones(pacienteId: string): Promise<Intervencion[]> {
  const { data, error } = await supabase
    .from("intervenciones")
    .select("*")
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Intervencion[];
}

export interface PacienteEnSeguimiento {
  pacienteId: string;
  nombreCompleto: string | null;
  intervencion: Intervencion;
  // null cuando la intervención no estaba ligada a una alerta puntual
  // (registrada desde RadarTab, o "Ninguna en particular" en el modal).
  alerta: RadarAlerta | null;
}

/**
 * "En seguimiento" (R7): intervenciones cuyo resultado_estado sigue en
 * 'pendiente' — el criterio ES la intervención, no la alerta (a
 * diferencia de R6): esto cubre también intervenciones sin alerta_id, que
 * antes nunca aparecían aquí. En cuanto evaluar_resultado_intervencion
 * cierra el resultado (Sección 81), la fila deja de calificar para esta
 * lista y pasa a vivir solo en el historial de RadarTab — sin acumular
 * una lista infinita de intervenciones ya resueltas en el dashboard.
 */
export async function fetchEnSeguimiento(): Promise<PacienteEnSeguimiento[]> {
  const { data: intervencionesData, error: errIntervenciones } = await supabase
    .from("intervenciones")
    .select("*")
    .eq("resultado_estado", "pendiente")
    .order("created_at", { ascending: false });
  if (errIntervenciones) throw errIntervenciones;

  const intervenciones = (intervencionesData ?? []) as Intervencion[];
  if (intervenciones.length === 0) return [];

  const pacienteIds = Array.from(new Set(intervenciones.map((i) => i.paciente_id)));
  const alertaIds = Array.from(
    new Set(intervenciones.map((i) => i.alerta_id).filter((id): id is string => !!id))
  );

  const [perfilesRes, alertasRes] = await Promise.all([
    supabase.from("perfiles").select("id, nombre_completo, avatar_url").in("id", pacienteIds),
    alertaIds.length > 0
      ? supabase.from("radar_alertas").select("*").in("id", alertaIds)
      : Promise.resolve({ data: [] as RadarAlerta[], error: null }),
  ]);
  if (perfilesRes.error) throw perfilesRes.error;
  if (alertasRes.error) throw alertasRes.error;

  const perfilPorId = new Map((perfilesRes.data ?? []).map((p) => [p.id as string, p]));
  const alertaPorId = new Map(((alertasRes.data ?? []) as RadarAlerta[]).map((a) => [a.id, a]));

  return intervenciones.map((i) => ({
    pacienteId: i.paciente_id,
    nombreCompleto: perfilPorId.get(i.paciente_id)?.nombre_completo ?? null,
    intervencion: i,
    alerta: i.alerta_id ? alertaPorId.get(i.alerta_id) ?? null : null,
  }));
}

/** Fecha (America/Mexico_City, YYYY-MM-DD) en que cierra la ventana de 14
 * días de una intervención — mismo cálculo que el backend (Sección 81),
 * usado aquí solo para mostrar "se evaluará a partir de…", nunca para
 * decidir el resultado. Extrae primero el día calendario en
 * America/Mexico_City (igual que "created_at at time zone
 * 'America/Mexico_City'" en SQL) antes de sumar los 14 días — sumar sobre
 * el timestamptz crudo podía desfasarse un día cerca de medianoche UTC. */
export function fechaCierreVentana(intervencion: Intervencion): string {
  const fechaMx = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(intervencion.created_at));
  const [y, m, d] = fechaMx.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() + 14);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Copy observacional del resultado de una intervención (R7, punto 15 del
 * alcance) — SIEMPRE describe qué se observó, nunca lo que la intervención
 * "logró" o "causó". Todo el texto se arma aquí a partir de columnas ya
 * calculadas en la base de datos (deltas triviales incluidos, Sección 81
 * decisión 9) — nunca se re-decide mejoro/estable/empeoro en el frontend.
 */
export function etiquetaResultado(intervencion: Intervencion): { titulo: string; detalle: string } {
  const { resultado_estado, adherence_antes, adherence_despues, confianza_antes, confianza_despues, confound_detalle } = intervencion;

  if (resultado_estado === "pendiente") {
    return { titulo: "Resultado pendiente", detalle: `Se evaluará a partir del ${formatFechaLarga(fechaCierreVentana(intervencion))}.` };
  }

  if (resultado_estado === "mejoro") {
    const delta = adherence_despues !== null && adherence_antes !== null ? Math.round(adherence_despues - adherence_antes) : null;
    return {
      titulo: "Mejoró",
      detalle: delta !== null
        ? `Después de esta intervención se observó una mejora de +${delta} puntos en adherencia.`
        : "Después de esta intervención se observó una mejora en adherencia.",
    };
  }

  if (resultado_estado === "estable") {
    return { titulo: "Estable", detalle: "No se observó un cambio significativo durante los siguientes 14 días." };
  }

  if (resultado_estado === "empeoro") {
    const delta = adherence_despues !== null && adherence_antes !== null ? Math.round(Math.abs(adherence_despues - adherence_antes)) : null;
    return {
      titulo: "Empeoró",
      detalle: delta !== null
        ? `Durante los siguientes 14 días la adherencia disminuyó ${delta} puntos.`
        : "Durante los siguientes 14 días la adherencia disminuyó.",
    };
  }

  if (resultado_estado === "confundido") {
    return {
      titulo: "Confundido",
      detalle: confound_detalle
        ? `Se observaron cambios, pero hubo otro evento durante el periodo: ${confound_detalle}`
        : "Se observaron cambios, pero hubo otra intervención o consulta durante el periodo.",
    };
  }

  // inconcluso — caso especial (alcance, punto 8): si la confianza subió
  // notablemente pero seguía siendo insuficiente ANTES, vale la pena
  // decirlo distinto de "no hubo información" a secas.
  const confianzaSubioMucho =
    confianza_antes !== null && confianza_despues !== null && confianza_despues - confianza_antes >= 20;
  return {
    titulo: "Inconcluso",
    detalle: confianzaSubioMucho
      ? "Después de la intervención aumentó la información disponible, pero todavía no podemos comparar adherencia con confianza."
      : "No hubo suficiente información para comparar antes y después con confianza.",
  };
}

function formatFechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${d} de ${meses[m - 1]} de ${y}`;
}

export interface PacienteRadar {
  pacienteId: string;
  nombreCompleto: string | null;
  avatarUrl: string | null;
  snapshot: RadarSnapshot | null;
  alertasAbiertas: RadarAlerta[];
}

// Traducción de IDs internos de regla a texto para el nutriólogo — nunca
// se muestra "RADAR_R3_CAIDA_ADHERENCIA" tal cual. Es una etiqueta fija
// por ID, no una reconstrucción de la explicación (esa sigue viniendo
// literal de `explicaciones`/`accion_sugerida`).
const ETIQUETAS_REGLA: Record<string, string> = {
  RADAR_R1_SILENCIO_TRAS_HISTORIAL: "Silencio tras actividad regular",
  RADAR_R2_CITA_SIN_CONFIRMAR: "Cita sin confirmar",
  RADAR_R3_CAIDA_ADHERENCIA: "Caída de adherencia",
  RADAR_R4_ENTRENAMIENTOS_OMITIDOS: "Entrenamientos omitidos",
  RADAR_R5_MEDIDAS_DESACTUALIZADAS: "Medidas desactualizadas",
  RADAR_R6_PATRON_DIA_SEMANA: "Patrón por día de la semana",
  RADAR_R7_CONFIANZA_GLOBAL_BAJA: "Confianza baja sostenida",
  RADAR_R8_PACIENTE_NUEVO: "Paciente nuevo",
  RADAR_R9_ESTABLE: "Paciente estable",
};

export function etiquetaRegla(regla: string): string {
  return ETIQUETAS_REGLA[regla] ?? regla;
}

const ETIQUETAS_MOTIVO: Record<string, string> = {
  intervencion: "Resuelta por intervención",
  auto_resuelta: "Resuelta automáticamente",
  sin_accion: "Revisada, sin acción",
};

export function etiquetaMotivoResolucion(motivo: MotivoResolucion): string | null {
  if (!motivo) return null;
  return ETIQUETAS_MOTIVO[motivo] ?? motivo;
}

/**
 * Trae, en 3 consultas fijas (no N+1: nunca una por paciente), todo lo
 * necesario para la lista priorizada del dashboard:
 * 1) el último snapshot de cada paciente visible (vía la vista, RLS ya
 *    aplicada — un nutriólogo solo ve los suyos, superadmin ve todos);
 * 2) las alertas abiertas de esos pacientes;
 * 3) los datos de perfil (nombre/foto) de esos mismos pacientes.
 */
export async function fetchRadarResumen(): Promise<PacienteRadar[]> {
  const [snapshotsRes, alertasRes] = await Promise.all([
    supabase.from("radar_ultimo_snapshot").select("*"),
    supabase.from("radar_alertas").select("*").eq("estado_alerta", "abierta"),
  ]);
  if (snapshotsRes.error) throw snapshotsRes.error;
  if (alertasRes.error) throw alertasRes.error;

  const snapshots = (snapshotsRes.data ?? []) as RadarSnapshot[];
  const alertas = (alertasRes.data ?? []) as RadarAlerta[];

  const pacienteIds = Array.from(
    new Set([...snapshots.map((s) => s.paciente_id), ...alertas.map((a) => a.paciente_id)])
  );
  if (pacienteIds.length === 0) return [];

  const { data: perfiles, error: errPerfiles } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, avatar_url")
    .in("id", pacienteIds);
  if (errPerfiles) throw errPerfiles;

  const perfilPorId = new Map((perfiles ?? []).map((p) => [p.id as string, p]));
  const snapshotPorPaciente = new Map(snapshots.map((s) => [s.paciente_id, s]));
  const alertasPorPaciente = new Map<string, RadarAlerta[]>();
  for (const a of alertas) {
    const lista = alertasPorPaciente.get(a.paciente_id) ?? [];
    lista.push(a);
    alertasPorPaciente.set(a.paciente_id, lista);
  }

  return pacienteIds.map((id) => {
    const perfil = perfilPorId.get(id);
    return {
      pacienteId: id,
      nombreCompleto: perfil?.nombre_completo ?? null,
      avatarUrl: perfil?.avatar_url ?? null,
      snapshot: snapshotPorPaciente.get(id) ?? null,
      alertasAbiertas: alertasPorPaciente.get(id) ?? [],
    };
  });
}

/** Historial de snapshots de un paciente (para la tendencia en el tab Radar). */
export async function fetchHistorialSnapshots(pacienteId: string, dias = 14): Promise<RadarSnapshot[]> {
  const { data, error } = await supabase
    .from("score_snapshots")
    .select("*")
    .eq("paciente_id", pacienteId)
    .order("snapshot_date", { ascending: false })
    .limit(dias);
  if (error) throw error;
  return ((data ?? []) as RadarSnapshot[]).slice().reverse();
}

/** Historial completo de alertas (abiertas y resueltas) de un paciente. */
export async function fetchHistorialAlertas(pacienteId: string): Promise<RadarAlerta[]> {
  const { data, error } = await supabase
    .from("radar_alertas")
    .select("*")
    .eq("paciente_id", pacienteId)
    .order("fecha_apertura", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RadarAlerta[];
}

const ESTADO_PRIORIDAD: Record<RadarEstado, number> = {
  rojo: 0,
  naranja: 1,
  amarillo: 2,
  verde: 3,
  blanco: 4,
};

/**
 * Orden de prioridad: tier del engine (estado) primero, luego riesgo
 * confirmado, luego si tiene una alerta recurrente, luego antigüedad de
 * la alerta más vieja (quien lleva más tiempo esperando, primero). Nunca
 * alfabético — así lo pidió el producto.
 */
export function ordenarPorPrioridad(pacientes: PacienteRadar[]): PacienteRadar[] {
  return [...pacientes].sort((a, b) => {
    const pa = ESTADO_PRIORIDAD[a.snapshot?.estado ?? "blanco"];
    const pb = ESTADO_PRIORIDAD[b.snapshot?.estado ?? "blanco"];
    if (pa !== pb) return pa - pb;

    const riesgoA = a.snapshot?.riesgo_confirmado_puntos ?? 0;
    const riesgoB = b.snapshot?.riesgo_confirmado_puntos ?? 0;
    if (riesgoA !== riesgoB) return riesgoB - riesgoA;

    const recurrenteA = a.alertasAbiertas.some((al) => al.recurrence_of !== null) ? 1 : 0;
    const recurrenteB = b.alertasAbiertas.some((al) => al.recurrence_of !== null) ? 1 : 0;
    if (recurrenteA !== recurrenteB) return recurrenteB - recurrenteA;

    const antiguedad = (p: PacienteRadar) =>
      p.alertasAbiertas.length === 0
        ? Infinity
        : Math.min(...p.alertasAbiertas.map((al) => new Date(al.fecha_apertura).getTime()));
    return antiguedad(a) - antiguedad(b);
  });
}

// R5.1: 5 grupos, uno por cada estado real del motor — rojo (deterioro
// confirmado) y naranja (acción operativa pendiente, ej. cita sin
// confirmar) ya NO se agrupan juntos. Son conceptos distintos y no deben
// verse igual.
export type GrupoResumen = RadarEstado;

export function agruparPorResumen(pacientes: PacienteRadar[]): Record<GrupoResumen, PacienteRadar[]> {
  const grupos: Record<GrupoResumen, PacienteRadar[]> = {
    rojo: [],
    naranja: [],
    amarillo: [],
    verde: [],
    blanco: [],
  };
  for (const p of pacientes) {
    const estado = p.snapshot?.estado ?? "blanco";
    grupos[estado].push(p);
  }
  return grupos;
}
