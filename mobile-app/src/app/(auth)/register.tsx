import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useOAuthSignIn } from '@/hooks/useOAuthSignIn'
import { COLORS } from '@/constants/colors'

export default function RegisterScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { signInWithProvider, loading: oauthLoading } = useOAuthSignIn()
  const router = useRouter()

  const validate = () => {
    const next: Record<string, string> = {}
    if (!name.trim() || name.trim().length < 2) next.name = 'Ingresa tu nombre completo'
    if (!email.trim()) next.email = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Correo inválido'
    if (!password || password.length < 8) next.password = 'Mínimo 8 caracteres'
    setErrors(next)
    return !Object.keys(next).length
  }

  const handleRegister = async () => {
    if (!validate()) return
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: name.trim() } },
    })
    setLoading(false)
    if (error) { Alert.alert('Error', error.message); return }
    Alert.alert('¡Registro exitoso!', 'Revisa tu correo para confirmar tu cuenta.', [
      { text: 'OK', onPress: () => router.replace('/(auth)/login') },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>

            <View style={styles.header}>
              <Text style={styles.title}>Crear Cuenta</Text>
              <Text style={styles.subtitle}>Lorem Ipsum is simply dummy text of the printing{'\n'}and typesetting industry.</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.input} placeholder="Nombre completo" placeholderTextColor="#9CA3AF"
                  value={name} onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: '' })) }}
                  autoCapitalize="words" />
              </View>
              {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

              <View style={styles.inputWrapper}>
                <TextInput style={styles.input} placeholder="Correo electrónico" placeholderTextColor="#9CA3AF"
                  value={email} onChangeText={t => { setEmail(t); setErrors(e => ({ ...e, email: '' })) }}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              </View>
              {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

              <View style={styles.inputWrapper}>
                <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor="#9CA3AF"
                  value={password} onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: '' })) }}
                  secureTextEntry={!showPass} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

              <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>{loading ? 'Registrando...' : 'Registrar'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <Text style={styles.dividerText}>O ingresar con</Text>
            </View>

            <View style={styles.socialBlock}>
              <TouchableOpacity style={styles.socialBtn} onPress={() => signInWithProvider('google')}
                disabled={oauthLoading === 'google'} activeOpacity={0.8}>
                <Text style={styles.gIcon}>G</Text>
                <Text style={styles.socialBtnText}>Continue with Google</Text>
              </TouchableOpacity>
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.socialBtn} onPress={() => signInWithProvider('apple')}
                  disabled={oauthLoading === 'apple'} activeOpacity={0.8}>
                  <Ionicons name="logo-apple" size={20} color="#000" />
                  <Text style={styles.socialBtnText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity><Text style={styles.link}>Inicia sesión</Text></TouchableOpacity>
              </Link>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 24, gap: 20 },
  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 14, color: COLORS.primary, lineHeight: 20 },
  form: { gap: 12 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.inputBg, borderRadius: 50, paddingHorizontal: 20, height: 54,
  },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  eyeBtn: { paddingLeft: 8 },
  error: { color: COLORS.error, fontSize: 12, marginTop: -6, paddingLeft: 12 },
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 50, height: 54,
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 17 },
  link: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  divider: { alignItems: 'center' },
  dividerText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },
  socialBlock: { gap: 12 },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 50, height: 54,
    borderWidth: 1, borderColor: COLORS.border,
  },
  gIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  footerText: { color: COLORS.muted, fontSize: 14 },
})
