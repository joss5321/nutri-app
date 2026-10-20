import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { AUTH_COLORS as PALETTE } from '@/constants/colors'
import { fetchNutricionistas, type Nutricionista } from '@/lib/api/nutricionistas'
import { fetchNutriologosDirectorio, type NutriologoDirectorio } from '@/lib/api/nutriologo-perfil'
import { createMedida } from '@/lib/api/medidas'
import { NutriologoCard } from '@/components/ui/NutriologoCard'
import { NutriologoProfileModal } from '@/components/ui/NutriologoProfileModal'

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
  // Enriquecimiento tipo "Doctoralia": mapa opcional por id — la lista base
  // (fetchNutricionistas, arriba) nunca cambia, esto solo agrega info extra
  // para quien ya publicó su perfil profesional (perfil_visible=true).
  const [directorio, setDirectorio] = useState<Map<string, NutriologoDirectorio>>(new Map())
  const [perfilAbierto, setPerfilAbierto] = useState<Nutricionista | null>(null)

  // Modo de registro: con nutriólogo (flujo actual, sin cambios) o
  // independiente ("Continuar sin nutriólogo"). Default preserva el
  // comportamiento de siempre si el usuario no toca el link nuevo.
  const [modo, setModo] = useState<'con_nutriologo' | 'sin_nutriologo'>('con_nutriologo')
  const [telefono, setTelefono] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [fechaNacimientoDate, setFechaNacimientoDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pesoInicial, setPesoInicial] = useState('')
  const [alturaInicial, setAlturaInicial] = useState('')
  const [objetivo, setObjetivo] = useState('')

  useEffect(() => {
    fetchNutricionistas()
      .then(setNutricionistas)
      .catch(() => {})
      .finally(() => setLoadingNutricionistas(false))
    fetchNutriologosDirectorio()
      .then((rows) => setDirectorio(new Map(rows.map((r) => [r.id, r]))))
      .catch(() => {})
  }, [])

  const validate = () => {
    const next: Record<string, string> = {}
    if (modo === 'con_nutriologo' && !selectedNutricionista) next.nutricionista = 'Selecciona tu nutriólogo'
    if (!name.trim() || name.trim().length < 2) next.name = 'Ingresa tu nombre completo'
    if (!email.trim()) next.email = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Correo inválido'
    if (!password || password.length < 8) next.password = 'Mínimo 8 caracteres'
    if (modo === 'sin_nutriologo') {
      if (!telefono.trim()) next.telefono = 'Requerido'
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento.trim())) next.fechaNacimiento = 'Formato AAAA-MM-DD'
      if (!pesoInicial.trim() || isNaN(parseFloat(pesoInicial)) || parseFloat(pesoInicial) <= 0) next.pesoInicial = 'Peso inválido'
      if (!alturaInicial.trim() || isNaN(parseFloat(alturaInicial)) || parseFloat(alturaInicial) <= 0) next.alturaInicial = 'Altura inválida'
    }
    setErrors(next)
    return !Object.keys(next).length
  }

  const handleRegister = async () => {
    if (!validate()) return
    setLoading(true)

    if (modo === 'con_nutriologo') {
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
      return
    }

    // ── Modo sin nutriólogo ──────────────────────────────────────────────
    const pesoNum = parseFloat(pesoInicial)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          sin_nutricionista: true,
          telefono: telefono.trim(),
          fecha_nacimiento: fechaNacimiento.trim(),
          altura_cm: parseFloat(alturaInicial),
          objetivo: objetivo.trim() || null,
          peso_inicial_kg: pesoNum,
        },
      },
    })
    setLoading(false)
    if (error) { Alert.alert('Error', error.message); return }

    if (data.session && data.user) {
      // Confirmación de email desactivada: ya hay sesión, se guarda el
      // peso inicial de una vez y se entra directo a la app.
      try {
        await createMedida(data.user.id, {
          fecha: new Date().toISOString().slice(0, 10),
          peso_kg: pesoNum,
          cintura_cm: null, cadera_cm: null, masa_muscular_pct: null,
          grasa_pct: null, brazo_cm: null, pantorrilla_cm: null, imc: null,
        })
      } catch { /* red de seguridad en (app)/_layout.tsx lo reintenta en el primer login */ }
      router.replace('/(app)/rutinas')
      return
    }
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
              {modo === 'con_nutriologo' ? (
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
                      {nutricionistas.map((n) => (
                        <NutriologoCard
                          key={n.id}
                          nutricionista={n}
                          enriquecido={directorio.get(n.id)}
                          selected={selectedNutricionista?.id === n.id}
                          onSelect={() => {
                            setSelectedNutricionista(n)
                            setErrors((e) => ({ ...e, nutricionista: '' }))
                          }}
                          onVerPerfil={() => setPerfilAbierto(n)}
                        />
                      ))}
                    </View>
                  )}
                  {errors.nutricionista ? (
                    <Text style={styles.error}>{errors.nutricionista}</Text>
                  ) : null}

                  <View style={styles.independentCard}>
                    <Text style={styles.independentTitle}>¿Prefieres usar MyFitTrack por tu cuenta?</Text>
                    <Text style={styles.independentSub}>
                      Puedes utilizar las herramientas disponibles sin tener un nutriólogo asignado.
                    </Text>
                    <TouchableOpacity
                      onPress={() => { setModo('sin_nutriologo'); setErrors({}) }}
                      style={styles.independentBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.independentBtnText}>Continuar sin nutriólogo</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ) : (
                <Animated.View entering={FadeInDown.duration(500).delay(140)} style={styles.section}>
                  <View style={styles.nutriCard}>
                    <View style={styles.nutriAvatar}>
                      <Ionicons name="person-outline" size={22} color={PALETTE.mutedMint} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nutriName}>Registro independiente</Text>
                      <Text style={styles.nutriEmail}>Sin nutriólogo asignado por ahora</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => { setModo('con_nutriologo'); setErrors({}) }}
                    style={{ marginTop: 10 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: PALETTE.mint, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                      Elegir un nutriólogo
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}

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

                  {modo === 'sin_nutriologo' && (
                    <>
                      <View>
                        <View style={styles.inputWrapper}>
                          <TextInput style={styles.input} placeholder="Teléfono" placeholderTextColor={PALETTE.mutedMint}
                            value={telefono} onChangeText={t => { setTelefono(t); setErrors(e => ({ ...e, telefono: '' })) }}
                            keyboardType="phone-pad" />
                        </View>
                        {errors.telefono ? <Text style={styles.error}>{errors.telefono}</Text> : null}
                      </View>

                      <View>
                        <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowDatePicker(true)} activeOpacity={0.75}>
                          <Text style={[styles.input, !fechaNacimiento && { color: PALETTE.mutedMint }]}>
                            {fechaNacimiento || 'Fecha de nacimiento'}
                          </Text>
                          <Ionicons name="calendar-outline" size={18} color={PALETTE.mutedMint} />
                        </TouchableOpacity>
                        {errors.fechaNacimiento ? <Text style={styles.error}>{errors.fechaNacimiento}</Text> : null}
                        {showDatePicker && (
                          <DateTimePicker
                            value={fechaNacimientoDate ?? new Date(2000, 0, 1)}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'inline' : 'default'}
                            maximumDate={new Date()}
                            onChange={(event, selectedDate) => {
                              setShowDatePicker(false)
                              if (event.type === 'dismissed' || !selectedDate) return
                              setFechaNacimientoDate(selectedDate)
                              const iso = selectedDate.toISOString().slice(0, 10)
                              setFechaNacimiento(iso)
                              setErrors(e => ({ ...e, fechaNacimiento: '' }))
                            }}
                          />
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.inputWrapper}>
                            <TextInput style={styles.input} placeholder="Peso (kg)" placeholderTextColor={PALETTE.mutedMint}
                              value={pesoInicial} onChangeText={t => { setPesoInicial(t); setErrors(e => ({ ...e, pesoInicial: '' })) }}
                              keyboardType="numeric" />
                          </View>
                          {errors.pesoInicial ? <Text style={styles.error}>{errors.pesoInicial}</Text> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.inputWrapper}>
                            <TextInput style={styles.input} placeholder="Altura (cm)" placeholderTextColor={PALETTE.mutedMint}
                              value={alturaInicial} onChangeText={t => { setAlturaInicial(t); setErrors(e => ({ ...e, alturaInicial: '' })) }}
                              keyboardType="numeric" />
                          </View>
                          {errors.alturaInicial ? <Text style={styles.error}>{errors.alturaInicial}</Text> : null}
                        </View>
                      </View>

                      <View>
                        <View style={styles.inputWrapper}>
                          <TextInput style={styles.input} placeholder="Objetivo (opcional)" placeholderTextColor={PALETTE.mutedMint}
                            value={objetivo} onChangeText={setObjetivo} />
                        </View>
                      </View>
                    </>
                  )}
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

      <NutriologoProfileModal
        visible={!!perfilAbierto}
        nutricionista={perfilAbierto}
        enriquecido={perfilAbierto ? directorio.get(perfilAbierto.id) : undefined}
        onClose={() => setPerfilAbierto(null)}
        onSeleccionar={() => {
          if (perfilAbierto) {
            setSelectedNutricionista(perfilAbierto)
            setErrors((e) => ({ ...e, nutricionista: '' }))
          }
          setPerfilAbierto(null)
        }}
      />
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

  independentCard: {
    marginTop: 14, backgroundColor: 'transparent', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: PALETTE.hairline, borderStyle: 'dashed', gap: 8,
  },
  independentTitle: { fontSize: 14, fontWeight: '700', color: PALETTE.warmWhite },
  independentSub: { fontSize: 12.5, color: PALETTE.mutedMint, lineHeight: 18 },
  independentBtn: {
    marginTop: 4, height: 42, borderRadius: 12, borderWidth: 1, borderColor: PALETTE.mintDim,
    justifyContent: 'center', alignItems: 'center',
  },
  independentBtnText: { color: PALETTE.mint, fontWeight: '700', fontSize: 13 },

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
