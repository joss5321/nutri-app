import type { Perfil } from '@/lib/api/perfiles'

/** Único lugar que decide si un paciente tiene nutriólogo asignado. */
export function hasNutritionist(perfil: Pick<Perfil, 'nutricionista_id'> | null | undefined): boolean {
  return !!perfil && perfil.nutricionista_id !== null
}

export function isIndependentPatient(perfil: Pick<Perfil, 'nutricionista_id'> | null | undefined): boolean {
  return !!perfil && perfil.nutricionista_id === null
}

/** Único lugar que decide si el paciente tiene una suscripción de pago activa (vía Stripe). */
export function hasActiveSubscription(perfil: Pick<Perfil, 'plan_membresia'> | null | undefined): boolean {
  return !!perfil && perfil.plan_membresia !== 'basico'
}

/**
 * Permiso efectivo para módulos premium (Progreso / Plan Nutricional):
 * tener nutriólogo asignado O tener una suscripción activa — nunca solo
 * "no tiene nutriólogo" (eso solo decide el flujo de registro/rutinas).
 */
export function canAccessPremiumFeatures(perfil: (Pick<Perfil, 'nutricionista_id'> & Pick<Perfil, 'plan_membresia'>) | null | undefined): boolean {
  return hasNutritionist(perfil) || hasActiveSubscription(perfil)
}
