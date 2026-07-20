import { supabase } from '@/lib/supabase'

export type CheckoutResponse = {
  url: string
}

export async function crearCheckout(priceId: string, userId: string): Promise<CheckoutResponse> {
  const { data, error } = await supabase.functions.invoke('crear-checkout', {
    body: { priceId, userId },
  })
  if (error) throw error
  return data as CheckoutResponse
}
