export type PlanKey = 'basico' | 'pro' | 'premium'

// Entitlements de RevenueCat para la compra nativa dentro de la app
// (StoreKit/Play Billing) — nombrados igual que los PlanKey a propósito,
// así mapear "estado de RevenueCat → nuestro plan" es una comparación de
// string directa. "basico" no tiene entitlement: es el default gratis.
export const REVENUECAT_ENTITLEMENT_IDS: Record<Exclude<PlanKey, 'basico'>, string> = {
  pro: 'pro',
  premium: 'premium',
}

