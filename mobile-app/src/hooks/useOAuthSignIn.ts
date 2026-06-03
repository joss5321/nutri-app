import { useState } from 'react'
import { Alert } from 'react-native'
import * as Linking from 'expo-linking'
import type { Provider } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// En Expo Go → exp://IP:PORT
// En standalone → mobileapp://
export const oauthRedirectUrl = Linking.createURL('')

export function useOAuthSignIn() {
  const [loading, setLoading] = useState<Provider | null>(null)

  const signInWithProvider = async (provider: Provider) => {
    try {
      setLoading(provider)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: oauthRedirectUrl,
          skipBrowserRedirect: true,
        },
      })

      if (error || !data.url) {
        Alert.alert('Error', error?.message ?? 'No se pudo conectar con el proveedor')
        return
      }

      console.log('[OAuth] redirectUrl enviado a Supabase:', oauthRedirectUrl)
      console.log('[OAuth] URL completa de OAuth:', data.url)

      // Abre Safari completo — iOS sabe cómo redirigir exp:// de vuelta a Expo Go
      await Linking.openURL(data.url)
    } catch {
      Alert.alert('Error', 'Ocurrió un error inesperado')
    } finally {
      setLoading(null)
    }
  }

  return { signInWithProvider, loading }
}
