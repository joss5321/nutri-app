import { Component, useEffect, type ReactNode } from 'react'
import { Alert, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import * as SplashScreen from 'expo-splash-screen'
import { useColorScheme } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import '../global.css'

console.log('[APP] _layout module loaded')

SplashScreen.preventAutoHideAsync()

// ── Global JS error handler ──────────────────────────────────────────────────
if (typeof ErrorUtils !== 'undefined') {
  const prev = ErrorUtils.getGlobalHandler()
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('[CRASH]', isFatal ? 'FATAL' : 'non-fatal', error?.message, error?.stack)
    prev?.(error, isFatal)
  })
}

// ── Error Boundary ───────────────────────────────────────────────────────────
interface EBState { error: Error | null }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null }
  static getDerivedStateFromError(error: Error): EBState {
    console.error('[ErrorBoundary] caught:', error?.message)
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
            Error al iniciar la app
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
            {this.state.error.message}
          </Text>
        </View>
      )
    }
    return this.props.children
  }
}

export default function RootLayout() {
  console.log('[APP] RootLayout render')
  const colorScheme = useColorScheme()
  const { setSession, setInitialized, initialized } = useAuthStore()

  // Inicializa sesión y escucha cambios de auth
  useEffect(() => {
    console.log('[APP] Loading Supabase session...')
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        console.log('[APP] Supabase session loaded, user:', session?.user?.id ?? 'none')
        if (session) {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('is_active, estatus')
            .eq('id', session.user.id)
            .single()

          if (perfil) {
            if (perfil.estatus === 'pendiente') {
              console.log('[APP] User is pending — signing out')
              await supabase.auth.signOut()
              Alert.alert(
                'Cuenta pendiente',
                'Tu cuenta está pendiente de aprobación por tu nutriólogo.',
              )
              setSession(null)
              setInitialized(true)
              return
            }
            if (perfil.estatus === 'rechazado') {
              console.log('[APP] User is rejected — signing out')
              await supabase.auth.signOut()
              Alert.alert(
                'Solicitud rechazada',
                'Tu solicitud de registro fue rechazada. Contacta a tu nutriólogo para más información.',
              )
              setSession(null)
              setInitialized(true)
              return
            }
            if (perfil.is_active === false) {
              console.log('[APP] User is disabled — signing out')
              await supabase.auth.signOut()
              Alert.alert(
                'Cuenta deshabilitada',
                'Tu cuenta se encuentra deshabilitada. Comunícate con tu administrador o nutriólogo para obtener más información.',
              )
              setSession(null)
              setInitialized(true)
              return
            }
          }
        }
        setSession(session)
        setInitialized(true)
      })
      .catch((err) => {
        console.error('[APP] Supabase getSession error:', err?.message)
        // Inicializar sin sesión para que la app arranque de todas formas
        setSession(null)
        setInitialized(true)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('[APP] Auth state changed:', _event)
        setSession(session)
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (initialized) {
      console.log('[APP] Initialized — hiding SplashScreen')
      SplashScreen.hideAsync()
    }
  }, [initialized])

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </ErrorBoundary>
  )
}
