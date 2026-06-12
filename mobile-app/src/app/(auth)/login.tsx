import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useOAuthSignIn } from '@/hooks/useOAuthSignIn'
import { COLORS } from '@/constants/colors'

type Errors = { email?: string; password?: string }

function AuthInput({
  placeholder, value, onChangeText, secureTextEntry = false, keyboardType = 'default' as any,
}: {
  placeholder: string; value: string; onChangeText: (t: string) => void;
  secureTextEntry?: boolean; keyboardType?: any;
}) {
  const [show, setShow] = useState(false)
  return (
    <View style={styles.inputWrapper}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !show}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShow(v => !v)} style={styles.eyeBtn}>
          <Ionicons name={show ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
        </TouchableOpacity>
      )}
    </View>
  )
}

import { TextInput } from 'react-native'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const { signInWithProvider, loading: oauthLoading } = useOAuthSignIn()
  const router = useRouter()

  const validate = () => {
    const next: Errors = {}
    if (!email.trim()) next.email = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Correo inválido'
    if (!password) next.password = 'Requerido'
    setErrors(next)
    return !Object.keys(next).length
  }

  const handleLogin = async () => {
    if (!validate()) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    setLoading(false)
    if (error) Alert.alert('Error', error.message)
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>

            <View style={styles.header}>
              <Text style={styles.title}>Iniciar Sesión</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Correo electrónico"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={t => { setEmail(t); if (errors.email) setErrors(e => ({ ...e, email: undefined })) }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email && <Text style={styles.error}>{errors.email}</Text>}

              <AuthInput
                placeholder="Contraseña"
                value={password}
                onChangeText={t => { setPassword(t); if (errors.password) setErrors(e => ({ ...e, password: undefined })) }}
                secureTextEntry
              />
              {errors.password && <Text style={styles.error}>{errors.password}</Text>}

              <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>{loading ? 'Ingresando...' : 'Ingresar'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
                <Text style={styles.link}>Olvide mi contraseña</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <Text style={styles.dividerText}>Ingresar con</Text>
            </View>

            <View style={styles.socialBlock}>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => signInWithProvider('google')}
                disabled={oauthLoading === 'google'}
                activeOpacity={0.8}
              >
                <Text style={styles.gIcon}>G</Text>
                <Text style={styles.socialBtnText}>Continue with Google</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.socialBtn}
                  onPress={() => signInWithProvider('apple')}
                  disabled={oauthLoading === 'apple'}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-apple" size={20} color="#000" />
                  <Text style={styles.socialBtnText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>¿No tienes cuenta? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity><Text style={styles.link}>Regístrate</Text></TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 50,
    paddingHorizontal: 20,
    height: 54,
  },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  eyeBtn: { paddingLeft: 8 },
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
  divider: { alignItems: 'center' },
  dividerText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },
  socialBlock: { gap: 12 },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 50,
    height: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  footerText: { color: COLORS.muted, fontSize: 14 },
})
