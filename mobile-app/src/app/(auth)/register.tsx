import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { AUTH_COLORS as PALETTE } from '@/constants/colors'
import { fetchNutricionistas, type Nutricionista } from '@/lib/api/nutricionistas'

export default function RegisterScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
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
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.inner}>

              <Animated.View entering={FadeIn.duration(450)} style={styles.brand}>
                <Image source={require('@/assets/branding/icon.png')} style={styles.brandLogo} />
                <Text style={styles.brandName}>MyFitTrack</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.duration(500).delay(80)} style={styles.header}>
                <Text style={styles.title}>Crea tu cuenta</Text>
                <Text style={styles.subtitle}>Empieza tu seguimiento guiado por un nutriólogo.</Text>
              </Animated.View>

              {/* ── Paso 1: Selección de nutriólogo ── */}
              <Animated.View entering={FadeInDown.duration(500).delay(140)} style={styles.section}>
                <Text style={styles.sectionTitle}>1. Selecciona tu nutriólogo</Text>
                <Text style={styles.sectionSub}>¿Con qué nutriólogo llevarás tu tratamiento?</Text>

                {loadingNutricionistas ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={PALETTE.mint} />
                  </View>
                ) : nutricionistas.length === 0 ? (
                  <View style={styles.emptyNutri}>
                    <Text style={{ color: PALETTE.mutedMint, fontSize: 13, textAlign: 'center' }}>
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
                          <View style={[styles.nutriAvatar, selected && { backgroundColor: PALETTE.mint }]}>
                            <Ionicons name="person" size={22} color={selected ? PALETTE.onMint : PALETTE.mutedMint} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.nutriName, selected && { color: PALETTE.mint }]}>
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
              </Animated.View>

              {/* ── Paso 2: Datos personales ── */}
              <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.section}>
                <Text style={styles.sectionTitle}>2. Tus datos</Text>
                <View style={{ gap: 12 }}>
                  <View>
                    <View style={styles.inputWrapper}>
                      <TextInput style={styles.input} placeholder="Nombre completo" placeholderTextColor={PALETTE.mutedMint}
                        value={name} onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: '' })) }}
                        autoCapitalize="words" />
                    </View>
                    {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}
                  </View>

                  <View>
                    <View style={styles.inputWrapper}>
                      <TextInput style={styles.input} placeholder="Correo electrónico" placeholderTextColor={PALETTE.mutedMint}
                        value={email} onChangeText={t => { setEmail(t); setErrors(e => ({ ...e, email: '' })) }}
                        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                    </View>
                    {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}
                  </View>

                  <View>
                    <View style={styles.inputWrapper}>
                      <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor={PALETTE.mutedMint}
                        value={password} onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: '' })) }}
                        secureTextEntry={!showPass} autoCapitalize="none" />
                      <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={PALETTE.mutedMint} />
                      </TouchableOpacity>
                    </View>
                    {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}
                  </View>
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.duration(500).delay(260)} style={{ gap: 20 }}>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
                  <Text style={styles.primaryBtnText}>{loading ? 'Registrando...' : 'Registrar'}</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
                  <Link href="/(auth)/login" asChild>
                    <TouchableOpacity><Text style={styles.link}>Inicia sesión</Text></TouchableOpacity>
                  </Link>
                </View>
              </Animated.View>

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

  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 32, height: 32, borderRadius: 10 },
  brandName: { color: PALETTE.warmWhite, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: PALETTE.warmWhite, letterSpacing: -0.6 },
  subtitle: { fontSize: 15, color: PALETTE.mutedMint, lineHeight: 21 },

  section: { gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: PALETTE.warmWhite, letterSpacing: -0.2 },
  sectionSub: { fontSize: 13, color: PALETTE.mutedMint, marginBottom: 4, lineHeight: 18 },

  nutriCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: PALETTE.bgElevated, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: PALETTE.hairline,
  },
  nutriCardSelected: { borderColor: PALETTE.mint, backgroundColor: PALETTE.mintSoft },
  nutriAvatar: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: 'rgba(247,245,240,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  nutriName: { fontWeight: '700', fontSize: 15, color: PALETTE.warmWhite },
  nutriEmail: { fontSize: 12, color: PALETTE.mutedMint, marginTop: 1 },
  radioCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: PALETTE.hairline,
    justifyContent: 'center', alignItems: 'center',
  },
  radioCircleSelected: { borderColor: PALETTE.mint },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PALETTE.mint },
  emptyNutri: {
    backgroundColor: PALETTE.bgElevated, borderRadius: 14, padding: 20,
    alignItems: 'center', marginTop: 8,
  },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(247,245,240,0.06)', borderRadius: 16, paddingHorizontal: 20, height: 54,
    borderWidth: 1, borderColor: PALETTE.hairline,
  },
  input: { flex: 1, fontSize: 15, color: PALETTE.warmWhite },
  eyeBtn: { paddingLeft: 8 },
  error: { color: PALETTE.error, fontSize: 12, marginTop: 6, paddingLeft: 4 },

  primaryBtn: {
    backgroundColor: PALETTE.mint, borderRadius: 16, height: 54,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: PALETTE.mint, shadowOpacity: 0.3, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  primaryBtnText: { color: PALETTE.onMint, fontWeight: '800', fontSize: 16 },
  link: { color: PALETTE.mint, fontWeight: '600', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: PALETTE.mutedMint, fontSize: 14 },
})
