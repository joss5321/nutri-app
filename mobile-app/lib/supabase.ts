import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uvfdbvzydbogfkntfuix.supabase.co'
const supabasePublishableKey =
  'sb_publishable_E-hr1YBueC-gkt_w2c_AAg_JOcDMAsl'

if (!supabaseUrl.startsWith('https://')) {
  throw new Error('La URL de Supabase no es válida')
}

if (!supabasePublishableKey) {
  throw new Error('Falta la clave pública de Supabase')
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)