import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupportedStorage } from '@supabase/supabase-js'

const supabaseUrl = 'https://uvfdbvzydbogfkntfuix.supabase.co'
const supabaseAnonKey = 'sb_publishable_E-hr1YBueC-gkt_w2c_AAg_JOcDMAsl'

// `expo export --platform web` prerenderiza las rutas estaticas en Node, donde no
// existe `window`. AsyncStorage (variante web) asume que `window` siempre existe,
// asi que fuera de un navegador usamos un storage en memoria que no toca `window`.
const noopStorage: SupportedStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
}

const authStorage = typeof window === 'undefined' ? noopStorage : AsyncStorage

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
