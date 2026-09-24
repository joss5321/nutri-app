// Zona horaria oficial de MyFitTrack Radar para calcular "día calendario"
// (check de nutrición, día de rutina completado, y las futuras ventanas de
// alertas/intervenciones). Decisión explícita del Blueprint v1.1 — fija en
// una sola constante para poder migrar a timezone por paciente/profesional
// más adelante sin tocar cada punto de la app que calcula "hoy". El mismo
// valor está documentado en supabase_schema.sql (Secciones 68/69), donde la
// base de datos deriva "hoy" de la misma forma para las policies de RLS que
// dependen de la fecha (ej. nutricion_checks_update).
export const RADAR_TIMEZONE = 'America/Mexico_City'

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: RADAR_TIMEZONE })

/** "Hoy" en la zona horaria oficial de Radar, como 'YYYY-MM-DD' (formato date de Postgres). */
export function getRadarToday(): string {
  return dayFormatter.format(new Date())
}

/** Lunes de la semana actual (Radar), como 'YYYY-MM-DD' — semana Lunes-Domingo. */
export function getRadarWeekStart(): string {
  const [y, m, d] = getRadarToday().split('-').map(Number)
  // Mediodía UTC evita que la resta de días cruce un borde de DST/fecha.
  const anchor = new Date(Date.UTC(y, m - 1, d, 12))
  const dow = anchor.getUTCDay() // 0=Dom..6=Sab
  const diff = dow === 0 ? -6 : 1 - dow
  anchor.setUTCDate(anchor.getUTCDate() + diff)
  return anchor.toISOString().slice(0, 10)
}

/** Domingo de la semana actual (Radar), como 'YYYY-MM-DD'. */
export function getRadarWeekEnd(): string {
  const [y, m, d] = getRadarWeekStart().split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d, 12))
  anchor.setUTCDate(anchor.getUTCDate() + 6)
  return anchor.toISOString().slice(0, 10)
}
