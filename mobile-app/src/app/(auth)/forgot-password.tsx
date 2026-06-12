import { useState } from 'react'
import {
  Alert,
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
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS } from '@/constants/colors'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const router = useRouter()

  const validate = (): boolean => {
    if (!email.trim()) {
      setError('El correo es requerido')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Ingresa un correo válido')
      return false
    }
    setError(undefined)
    return true
  }

  const handleSendReset = async () => {
    if (!validate()) return
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: 'mobileapp://reset-password' },
    )
    setLoading(false)
    if (resetError) {
      Alert.alert('Error', resetError.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successWrapper}>
          <View style={styles.envelopeCircle}>
            <Text style={styles.envelopeIcon}>✉️</Text>
          </View>
          <Text style={styles.successTitle}>¡Correo enviado!</Text>
          <Text style={styles.successSubtitle}>
            Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Volver al inicio de sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>

            {/* Botón de regreso */}
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
            </TouchableOpacity>

            {/* Encabezado */}
            <View style={styles.header}>
              <Text style={styles.title}>¿Olvidaste tu{'\n'}contraseña?</Text>
              <Text style={styles.subtitle}>
                Ingresa tu correo y te enviaremos un enlace para restablecerla.
              </Text>
            </View>

            {/* Formulario */}
            <View style={styles.form}>
              <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="Correo electrónico"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={t => {
                    setEmail(t)
                    if (error) setError(undefined)
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>
              {error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleSendReset}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Link de regreso */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>¿La recuerdas? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.link}>Inicia sesión</Text>
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
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, gap: 24 },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: { gap: 10 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.primary, lineHeight: 36 },
  subtitle: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },

  form: { gap: 12 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 50,
    paddingHorizontal: 20,
    height: 54,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: { borderColor: COLORS.error },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  error: { color: COLORS.error, fontSize: 12, marginTop: -6, paddingLeft: 12 },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 50,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 17 },

  link: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  footerText: { color: COLORS.muted, fontSize: 14 },

  // Estado de éxito
  successWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  envelopeCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.completed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  envelopeIcon: { fontSize: 48 },
  successTitle: { fontSize: 26, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },
  successSubtitle: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
})
