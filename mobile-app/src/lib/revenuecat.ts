import { Platform } from 'react-native'
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases'
import { type PlanKey, REVENUECAT_ENTITLEMENT_IDS } from '@/constants/planes'

// Claves públicas del SDK de RevenueCat — mismo nivel de confianza que una
// clave publishable de Stripe, por eso van en variables EXPO_PUBLIC_* (lo
// único que Expo expone al bundle del cliente). Se configuran en el
// dashboard de RevenueCat (Project Settings → API Keys) una vez creado el
// proyecto (ver plan de migración, Fase 0).
const REVENUECAT_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
})

let configurado = false

/**
 * Debe llamarse en cuanto se conoce el usuario autenticado (auth.uid()),
 * para que RevenueCat use ESE id como appUserID — así el webhook puede
 * mapear event.app_user_id directo a perfiles.id, sin indirección como
 * stripe_customer_id. Es seguro llamarla varias veces (login/logout
 * repetidos): la primera vez configura el SDK, las siguientes solo
 * cambian de identidad con logIn().
 */
export async function configureRevenueCat(userId: string): Promise<void> {
  if (!REVENUECAT_API_KEY) {
    console.error('[RevenueCat] Falta EXPO_PUBLIC_REVENUECAT_IOS_KEY/ANDROID_KEY — compras nativas deshabilitadas.')
    return
  }
  if (!configurado) {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId })
    configurado = true
    return
  }
  await Purchases.logIn(userId)
}

/** Llamar al cerrar sesión — vuelve a un usuario anónimo de RevenueCat. */
export async function cerrarSesionRevenueCat(): Promise<void> {
  if (!configurado) return
  await Purchases.logOut()
}

/**
 * Paquete de compra para un plan, o null si el Offering actual no lo
 * incluye (p. ej. falta terminar la configuración en RevenueCat — ver
 * Fase 0 del plan). "basico" nunca tiene paquete: es el default gratis.
 */
export async function getPaqueteParaPlan(planKey: Exclude<PlanKey, 'basico'>): Promise<PurchasesPackage | null> {
  // Depende de que, al crear el Offering en el dashboard de RevenueCat
  // (Fase 0 del plan de migración), los Packages se nombren exactamente
  // "pro"/"premium" — mismo principio que nombrar los entitlements igual
  // que los PlanKey, para no necesitar una tabla de equivalencias más.
  const offerings = await Purchases.getOfferings()
  const paquetes = offerings.current?.availablePackages ?? []
  return paquetes.find((p) => p.identifier === planKey) ?? null
}

export async function comprarPaquete(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg)
  return customerInfo
}

/** El plan activo según las entitlements vigentes de RevenueCat. */
export function planDesdeCustomerInfo(customerInfo: CustomerInfo): PlanKey {
  const activas = customerInfo.entitlements.active
  if (REVENUECAT_ENTITLEMENT_IDS.premium in activas) return 'premium'
  if (REVENUECAT_ENTITLEMENT_IDS.pro in activas) return 'pro'
  return 'basico'
}

/**
 * Deep link nativo a la pantalla de gestión de suscripción del sistema
 * (App Store / Play Store) — RevenueCat ya lo resuelve, no hay que
 * construir URLs itms-apps://.../Play Store a mano.
 */
export async function getUrlGestionSuscripcion(): Promise<string | null> {
  const customerInfo = await Purchases.getCustomerInfo()
  return customerInfo.managementURL ?? null
}
