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
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { AUTH_COLORS as PALETTE } from '@/constants/colors'

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
      <View style={styles.screen}>
        <SafeAreaView style={styles.container}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.successWrapper}>
            <View style={styles.envelopeCircle}>
              <Ionicons name="mail-outline" size={40} color={PALETTE.mint} />
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
          </Animated.View>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
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
                <Ionicons name="arrow-back" size={20} color={PALETTE.mint} />
              </TouchableOpacity>

              {/* Encabezado */}
              <Animated.View entering={FadeInDown.duration(500).delay(60)} style={styles.header}>
                <Image source={require('@/assets/branding/icon.png')} style={styles.logo} />
                <Text style={styles.title}>¿Olvidaste tu{'\n'}contraseña?</Text>
                <Text style={styles.subtitle}>
                  Ingresa tu correo y te enviaremos un enlace para restablecerla.
                </Text>
              </Animated.View>

              {/* Formulario */}
              <Animated.View entering={FadeInDown.duration(500).delay(120)} style={styles.form}>
                <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Correo electrónico"
                    placeholderTextColor={PALETTE.mutedMint}
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
              </Animated.View>

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
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.bg,
    experimental_backgroundImage:
      'radial-gradient(circle at 15% -8%, rgba(61,220,151,0.16), transparent 55%), radial-gradient(circle at 100% 105%, rgba(18,61,48,0.9), transparent 60%)',
  },
  container: { flex: 1 },
  inner: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 24 },

  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(247,245,240,0.06)', borderWidth: 1, borderColor: PALETTE.hairline,
    alignItems: 'center', justifyContent: 'center',
  },

  header: { gap: 10 },
  logo: { width: 56, height: 56, borderRadius: 18, marginBottom: 4 },
  title: { fontSize: 27, fontWeight: '800', color: PALETTE.warmWhite, lineHeight: 34, letterSpacing: -0.6 },
  subtitle: { fontSize: 14, color: PALETTE.mutedMint, lineHeight: 20 },

  form: { gap: 12 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(247,245,240,0.06)', borderRadius: 16,
    paddingHorizontal: 20, height: 54,
    borderWidth: 1, borderColor: PALETTE.hairline,
  },
  inputError: { borderColor: PALETTE.error },
  input: { flex: 1, fontSize: 15, color: PALETTE.warmWhite },
  error: { color: PALETTE.error, fontSize: 12, marginTop: -6, paddingLeft: 4 },

  primaryBtn: {
    backgroundColor: PALETTE.mint, borderRadius: 16,
    height: 54, justifyContent: 'center', alignItems: 'center', marginTop: 4,
    shadowColor: PALETTE.mint, shadowOpacity: 0.3, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  primaryBtnText: { color: PALETTE.onMint, fontWeight: '800', fontSize: 16 },

  link: { color: PALETTE.mint, fontWeight: '600', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  footerText: { color: PALETTE.mutedMint, fontSize: 14 },

  // Estado de éxito
  successWrapper: {
    flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  envelopeCircle: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: PALETTE.mintSoft,
    borderWidth: 1.5, borderColor: PALETTE.hairline,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  successTitle: { fontSize: 25, fontWeight: '800', color: PALETTE.warmWhite, textAlign: 'center', letterSpacing: -0.5 },
  successSubtitle: {
    fontSize: 15, color: PALETTE.mutedMint, textAlign: 'center', lineHeight: 22,
    paddingHorizontal: 12, marginBottom: 8,
  },
})
