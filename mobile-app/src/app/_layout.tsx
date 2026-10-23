import { Component, useEffect, useState, type ReactNode } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import * as SplashScreen from 'expo-splash-screen'
import { useColorScheme } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { COLORS } from '@/constants/colors'
import { RetryError } from '@/components/ui/RetryError'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: COLORS.background }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8, color: COLORS.ink }}>
            Error al iniciar la app
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center' }}>
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
  const { setSession, setInitialized, initialized, setPasswordRecovery } = useAuthStore()
  const [sessionError, setSessionError] = useState(false)

  // Valida estatus/is_active de un perfil recién autenticado y cierra la
  // sesión si no corresponde dejarlo entrar. Devuelve true si la sesión
  // sigue siendo válida (hay que llamar setSession/setInitialized con
  // ella), false si ya se cerró (el caller no debe setear esa sesión).
  // Centralizado aquí porque login.tsx ya hacía este mismo chequeo justo
  // después de signInWithPassword, pero el registro (signUp) con
  // confirmación de email desactivada deja una sesión activa de
  // inmediato vía onAuthStateChange — sin este chequeo ahí, un paciente
  // recién registrado (estatus='pendiente') entraba a la app sin que
  // nadie lo hubiera aprobado, hasta el siguiente cierre/apertura de la
  // app (que sí pasaba por getSession() abajo).
  async function validarPerfilOCerrarSesion(session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>): Promise<boolean> {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('is_active, estatus, movil_vinculado')
      .eq('id', session.user.id)
      .single()

    if (!perfil) return true

    if (perfil.estatus === 'pendiente') {
      console.log('[APP] User is pending — signing out')
      await supabase.auth.signOut()
      Alert.alert('Cuenta pendiente', 'Tu cuenta está pendiente de aprobación por tu nutriólogo.')
      setSession(null)
      setInitialized(true)
      return false
    }
    if (perfil.estatus === 'rechazado') {
      console.log('[APP] User is rejected — signing out')
      await supabase.auth.signOut()
      Alert.alert('Solicitud rechazada', 'Tu solicitud de registro fue rechazada. Contacta a tu nutriólogo para más información.')
      setSession(null)
      setInitialized(true)
      return false
    }
    if (perfil.is_active === false) {
      console.log('[APP] User is disabled — signing out')
      await supabase.auth.signOut()
      Alert.alert('Cuenta deshabilitada', 'Tu cuenta se encuentra deshabilitada. Comunícate con tu administrador o nutriólogo para obtener más información.')
      setSession(null)
      setInitialized(true)
      return false
    }
    if (perfil.movil_vinculado === false) {
      supabase
        .from('perfiles')
        .update({ movil_vinculado: true })
        .eq('id', session.user.id)
        .then(({ error }) => {
          if (error) console.error('[APP] No se pudo marcar movil_vinculado:', error.message)
        })
    }
    return true
  }

  const loadSession = () => {
    setSessionError(false)
    console.log('[APP] Loading Supabase session...')
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        console.log('[APP] Supabase session loaded, user:', session?.user?.id ?? 'none')
        if (session) {
          const sigueValida = await validarPerfilOCerrarSesion(session)
          if (!sigueValida) return
        }
        setSession(session)
        setInitialized(true)
      })
      .catch((err) => {
        console.error('[APP] Supabase getSession error:', err?.message)
        setSessionError(true)
      })
  }

  // Inicializa sesión y escucha cambios de auth
  useEffect(() => {
    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('[APP] Auth state changed:', _event)
        // PASSWORD_RECOVERY trae una sesión válida (el usuario SÍ queda
        // autenticado — es el comportamiento estándar de Supabase Auth,
        // necesario para poder llamar updateUser({password}) después), pero
        // NO es un login normal: no debe mandar al usuario a /(app). El flag
        // isPasswordRecovery es lo que index.tsx y los layouts de (auth)/(app)
        // revisan antes de redirigir automáticamente por tener session.
        if (_event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true)
        }
        // SIGNED_IN cubre tanto un login normal (ya validado por login.tsx
        // antes de llegar aquí) como un signUp con confirmación de email
        // desactivada (nunca validado por nadie más) — validar aquí cierra
        // ese hueco sin duplicar trabajo para el login normal (si el perfil
        // ya está aprobado, validarPerfilOCerrarSesion no hace nada extra).
        if (_event === 'SIGNED_IN' && session) {
          validarPerfilOCerrarSesion(session).then((sigueValida) => {
            if (sigueValida) setSession(session)
          })
          return
        }
        setSession(session)
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (initialized || sessionError) {
      console.log('[APP] Initialized — hiding SplashScreen')
      SplashScreen.hideAsync()
    }
  }, [initialized, sessionError])

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={styles.root}>
          <OfflineBanner />
          {sessionError ? (
            <View style={styles.errorContainer}>
              <RetryError
                message="No se pudo conectar. Verifica tu conexión a internet e intenta de nuevo."
                onRetry={loadSession}
              />
            </View>
          ) : (
            <Stack screenOptions={{ headerShown: false }} />
          )}
        </View>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  errorContainer: { flex: 1, backgroundColor: COLORS.background },
})
