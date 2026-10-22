import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import type { WebSocketLike } from '@supabase/realtime-js'

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

const isPrerendering = typeof window === 'undefined'

const authStorage = isPrerendering ? noopStorage : AsyncStorage

// En el mismo prerenderizado, `createClient` crea un `RealtimeClient` que busca un
// WebSocket nativo apenas se instancia (no al conectar). Node 20, la version que usa
// el workflow de CI, no expone un WebSocket global (eso llego recien en Node 22), asi
// que sin esto el export falla con "Node.js detected but native WebSocket not found"
// aunque el realtime nunca se use durante el prerenderizado estatico.
class NoopWebSocket implements WebSocketLike {
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3
  readonly readyState = 3
  readonly url = ''
  readonly protocol = ''
  onopen = null
  onmessage = null
  onclose = null
  onerror = null
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  ...(isPrerendering ? { realtime: { transport: NoopWebSocket } } : {}),
})
