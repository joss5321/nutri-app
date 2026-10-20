export type PlanKey = 'basico' | 'pro' | 'premium'

export const STRIPE_PRICE_IDS: Record<PlanKey, string> = {
  basico: 'price_1USJQj0xj7uyAsKdZOqxpQ0i',   // price_id basico
  pro: 'price_1USJRa0xj7uyAsKdi09cMZ6S',      // price_id pro
  premium: 'price_1USJS70xj7uyAsKdhZP6QRmc',  // price_id premium
}

// Mapeo inverso: lo usa el webhook para saber qué plan activar según el price_id que pagó el usuario
export const PRICE_ID_TO_PLAN: Record<string, PlanKey> = {
  [STRIPE_PRICE_IDS.basico]: 'basico',
  [STRIPE_PRICE_IDS.pro]: 'pro',
  [STRIPE_PRICE_IDS.premium]: 'premium',
}

