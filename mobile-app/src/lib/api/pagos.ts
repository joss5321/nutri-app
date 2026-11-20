import { supabase } from '@/lib/supabase'

export type CheckoutResponse = {
  url: string
}

/** Abre el Stripe Customer Portal para que el usuario gestione/cancele su suscripción. */
export async function crearPortalSesion(): Promise<CheckoutResponse> {
  const { data, error } = await supabase.functions.invoke('crear-portal-sesion', {
    body: {},
  })
  if (error) throw error
  return data as CheckoutResponse
}
