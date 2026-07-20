import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useOAuthSignIn } from '@/hooks/useOAuthSignIn'
import { COLORS } from '@/constants/colors'
import { fetchNutricionistas, type Nutricionista } from '@/lib/api/nutricionistas'

export default function RegisterScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { signInWithProvider, loading: oauthLoading } = useOAuthSignIn()
  const router = useRouter()

  // Nutritionist selection
  const [nutricionistas, setNutricionistas] = useState<Nutricionista[]>([])
  const [loadingNutricionistas, setLoadingNutricionistas] = useState(true)
  const [selectedNutricionista, setSelectedNutricionista] = useState<Nutricionista | null>(null)

  useEffect(() => {
    fetchNutricionistas()
      .then(setNutricionistas)
      .catch(() => {})
      .finally(() => setLoadingNutricionistas(false))
  }, [])

  const validate = () => {
    const next: Record<string, string> = {}
    if (!selectedNutricionista) next.nutricionista = 'Selecciona tu nutriólogo'
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
      options: {
        data: {
          full_name: name.trim(),
          nutricionista_id: selectedNutricionista!.id,
        },
      },
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
              <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
              <Text style={styles.title}>Crear Cuenta</Text>
            </View>

            {/* ── Paso 1: Selección de nutriólogo ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Selecciona tu nutriólogo</Text>
              <Text style={styles.sectionSub}>¿Con qué nutriólogo llevarás tu tratamiento?</Text>

              {loadingNutricionistas ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              ) : nutricionistas.length === 0 ? (
                <View style={styles.emptyNutri}>
                  <Text style={{ color: COLORS.muted, fontSize: 13, textAlign: 'center' }}>
                    No hay nutriólogos disponibles en este momento.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10, marginTop: 8 }}>
                  {nutricionistas.map((n) => {
                    const selected = selectedNutricionista?.id === n.id
                    return (
                      <TouchableOpacity
                        key={n.id}
                        style={[styles.nutriCard, selected && styles.nutriCardSelected]}
                        onPress={() => {
                          setSelectedNutricionista(n)
                          setErrors((e) => ({ ...e, nutricionista: '' }))
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.nutriAvatar, selected && { backgroundColor: COLORS.primary }]}>
                          <Text style={{ fontSize: 22 }}>👨‍⚕️</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.nutriName, selected && { color: COLORS.primary }]}>
                            {n.nombre_completo ?? 'Nutriólogo'}
                          </Text>
                          {n.email && (
                            <Text style={styles.nutriEmail}>{n.email}</Text>
                          )}
                        </View>
                        <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
                          {selected && <View style={styles.radioDot} />}
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
              {errors.nutricionista ? (
                <Text style={styles.error}>{errors.nutricionista}</Text>
              ) : null}
            </View>

            {/* ── Paso 2: Datos personales ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Tus datos</Text>
              <View style={{ gap: 12 }}>
                <View>
                  <View style={styles.inputWrapper}>
                    <TextInput style={styles.input} placeholder="Nombre completo" placeholderTextColor="#9CA3AF"
                      value={name} onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: '' })) }}
                      autoCapitalize="words" />
                  </View>
                  {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}
                </View>

                <View>
                  <View style={styles.inputWrapper}>
                    <TextInput style={styles.input} placeholder="Correo electrónico" placeholderTextColor="#9CA3AF"
                      value={email} onChangeText={t => { setEmail(t); setErrors(e => ({ ...e, email: '' })) }}
                      keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                  </View>
                  {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}
                </View>

                <View>
                  <View style={styles.inputWrapper}>
                    <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor="#9CA3AF"
                      value={password} onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: '' })) }}
                      secureTextEntry={!showPass} autoCapitalize="none" />
                    <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
                      <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
                    </TouchableOpacity>
                  </View>
                  {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{loading ? 'Registrando...' : 'Registrar'}</Text>
            </TouchableOpacity>

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
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 24, gap: 24 },
  header: { gap: 8 },
  logo: { width: 64, height: 64, borderRadius: 20, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },

  section: { gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, letterSpacing: -0.2 },
  sectionSub: { fontSize: 13, color: COLORS.muted, marginBottom: 4, lineHeight: 18 },

  nutriCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  nutriCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  nutriAvatar: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
  },
  nutriName: { fontWeight: '700', fontSize: 15, color: COLORS.text },
  nutriEmail: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  radioCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  radioCircleSelected: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  emptyNutri: {
    backgroundColor: '#F1F5F9', borderRadius: 14, padding: 20,
    alignItems: 'center', marginTop: 8,
  },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 16, paddingHorizontal: 20, height: 54,
    borderWidth: 1, borderColor: COLORS.border,
  },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  eyeBtn: { paddingLeft: 8 },
  error: { color: COLORS.error, fontSize: 12, marginTop: 2, paddingLeft: 4 },

  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16, height: 54,
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 17 },
  link: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  divider: { alignItems: 'center' },
  dividerText: { color: COLORS.muted, fontWeight: '500', fontSize: 14 },
  socialBlock: { gap: 12 },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 16, height: 54,
    borderWidth: 1, borderColor: COLORS.border,
  },
  gIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  footerText: { color: COLORS.muted, fontSize: 14 },
})
