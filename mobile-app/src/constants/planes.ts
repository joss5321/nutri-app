export type PlanKey = 'basico' | 'pro' | 'premium'

export const STRIPE_PRICE_IDS: Record<PlanKey, string> = {
  basico: 'price_1TqeAK420EpqkxR07XvpXJCo',   // price_id basico
  pro: 'price_1TrPcJ420EpqkxR0lOxubTrs',      // price_id pro
  premium: 'price_1Tqe9r420EpqkxR0KYROnlr4',  // price_id premium 
}

// Mapeo inverso: lo usa el webhook para saber qué plan activar según el price_id que pagó el usuario
export const PRICE_ID_TO_PLAN: Record<string, PlanKey> = {
  [STRIPE_PRICE_IDS.basico]: 'basico',
  [STRIPE_PRICE_IDS.pro]: 'pro',
  [STRIPE_PRICE_IDS.premium]: 'premium',
}

