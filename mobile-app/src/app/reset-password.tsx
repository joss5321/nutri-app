import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { Image } from 'expo-image'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { COLORS } from '@/constants/colors'

// Longitud mínima alineada con register.tsx (8) — más estricta que el
// mínimo real configurado en Supabase Auth (6), a propósito: nunca puede
// entrar en conflicto con el servidor, y mantiene consistencia con el
// único otro formulario de contraseña que existe hoy en la app.
const MIN_PASSWORD_LENGTH = 8

// El link de recuperación de Supabase (flujo implícito) trae los tokens
// como fragment (#access_token=...&refresh_token=...&type=recovery), o
// como error (#error=...&error_code=...&error_description=...) si el link
// ya expiró/fue usado/es inválido. expo-linking no parsea el fragment
// automáticamente (solo el query string ?...), así que se extrae a mano
// aquí — funciona igual si Supabase alguna vez lo manda como ?... en vez
// de #....
export function extractParamsFromUrl(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#')
  const queryIndex = url.indexOf('?')
  let paramsString = ''
  if (hashIndex !== -1) {
    paramsString = url.slice(hashIndex + 1)
  } else if (queryIndex !== -1) {
    paramsString = url.slice(queryIndex + 1)
  }
  return Object.fromEntries(new URLSearchParams(paramsString).entries())
}

export function validateNewPassword(password: string, confirmPassword: string): string | null {
  if (!password || !confirmPassword) return 'Completa ambos campos'
  if (password.length < MIN_PASSWORD_LENGTH) return `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`
  if (password !== confirmPassword) return 'Las contraseñas no coinciden'
  return null
}

// Mapeo de errores conocidos de Supabase a mensajes que sí puede leer un
// usuario — nunca se muestra el mensaje crudo del SDK/servidor.
function friendlyLinkError(params: Record<string, string>): string | null {
  if (params.error_code === 'otp_expired') {
    return 'Este enlace ya expiró. Solicita uno nuevo.'
  }
  if (params.error) {
    return 'Este enlace ya no es válido. Solicita uno nuevo.'
  }
  return null
}

type ScreenStatus = 'loading' | 'ready' | 'linkError' | 'submitting' | 'success'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const setPasswordRecovery = useAuthStore((s) => s.setPasswordRecovery)

  const [status, setStatus] = useState<ScreenStatus>('loading')
  const [linkErrorMessage, setLinkErrorMessage] = useState<string>('')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | undefined>()
  const [submitError, setSubmitError] = useState<string | undefined>()

  // Evita procesar el mismo link dos veces si getInitialURL() y el
  // listener de 'url' llegan a dispararse ambos para la misma apertura.
  const handledRef = useRef(false)

  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!url || handledRef.current) return
      handledRef.current = true

      const params = extractParamsFromUrl(url)

      const linkError = friendlyLinkError(params)
      if (linkError) {
        setLinkErrorMessage(linkError)
        setStatus('linkError')
        return
      }

      const { access_token, refresh_token } = params
      if (!access_token || !refresh_token) {
        setLinkErrorMessage('Este enlace no es válido. Solicita uno nuevo desde la app.')
        setStatus('linkError')
        return
      }

      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (error) {
        console.error('[reset-password] setSession error:', error.message)
        setLinkErrorMessage('No se pudo validar el enlace. Puede que ya haya sido usado o haya expirado.')
        setStatus('linkError')
        return
      }

      // Sesión de recuperación establecida — marcar el flag global para
      // que el resto de la app (index/(auth)/(app)) no redirija a /(app)
      // solo porque ahora existe una session válida.
      setPasswordRecovery(true)
      setStatus('ready')
    }

    // Cold start: el deep link lanzó la app directamente.
    Linking.getInitialURL().then(handleUrl)

    // App ya abierta: el usuario tocó el link mientras corría en segundo plano.
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url))

    return () => subscription.remove()
  }, [])

  const handleSubmit = async () => {
    const validationError = validateNewPassword(password, confirmPassword)
    setFormError(validationError ?? undefined)
    if (validationError) return

    setSubmitError(undefined)
    setStatus('submitting')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      console.error('[reset-password] updateUser error:', error.message)
      setSubmitError('No se pudo actualizar tu contraseña. Intenta de nuevo o solicita un enlace nuevo.')
      setStatus('ready')
      return
    }

    // Éxito: no dejamos al usuario autenticado dentro de la app con la
    // sesión de recuperación — cierra sesión y lo manda a login normal
    // para que entre ya con la contraseña nueva, siguiendo el flujo
    // habitual de la app.
    await supabase.auth.signOut()
    setPasswordRecovery(false)
    setStatus('success')
  }

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (status === 'linkError') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.title}>Enlace no disponible</Text>
          <Text style={styles.subtitle}>{linkErrorMessage}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace('/(auth)/forgot-password')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Solicitar nuevo enlace</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 12 }}>
            <Text style={styles.link}>Volver al inicio de sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (status === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.envelopeCircle}>
            <Text style={styles.envelopeIcon}>✅</Text>
          </View>
          <Text style={styles.title}>¡Contraseña actualizada!</Text>
          <Text style={styles.subtitle}>Ya puedes iniciar sesión con tu nueva contraseña.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Ir a iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // status === 'ready' | 'submitting'
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>
            <View style={styles.header}>
              <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
              <Text style={styles.title}>Crea tu nueva{'\n'}contraseña</Text>
              <Text style={styles.subtitle}>Debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.</Text>
            </View>

            <View style={styles.form}>
              <View style={[styles.inputWrapper, formError ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="Nueva contraseña"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setFormError(undefined) }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={[styles.inputWrapper, formError ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar contraseña"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setFormError(undefined) }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {formError && <Text style={styles.error}>{formError}</Text>}
              {submitError && <Text style={styles.error}>{submitError}</Text>}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleSubmit}
                disabled={status === 'submitting'}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>
                  {status === 'submitting' ? 'Guardando...' : 'Guardar contraseña'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 40, gap: 24 },

  header: { gap: 10, alignItems: 'center' },
  logo: { width: 64, height: 64, borderRadius: 20, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, lineHeight: 32, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.muted, lineHeight: 20, textAlign: 'center' },

  form: { gap: 12 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 16,
    paddingHorizontal: 20, height: 54,
    borderWidth: 1, borderColor: COLORS.border,
  },
  inputError: { borderColor: COLORS.error },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  error: { color: COLORS.error, fontSize: 12, marginTop: -6, paddingLeft: 4 },

  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    height: 54, justifyContent: 'center', alignItems: 'center', marginTop: 4,
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 17 },
  link: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },

  envelopeCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.completed,
    borderWidth: 2, borderColor: '#BBF7D0',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  envelopeIcon: { fontSize: 48 },
  errorIcon: { fontSize: 48, marginBottom: 8 },
})
