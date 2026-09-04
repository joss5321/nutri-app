import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { AUTH_COLORS as PALETTE } from '@/constants/colors'

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
        placeholderTextColor={PALETTE.mutedMint}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !show}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShow(v => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={show ? 'eye-off' : 'eye'} size={20} color={PALETTE.mutedMint} />
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
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
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) {
      setLoading(false)
      Alert.alert('Error', error.message)
      return
    }
    // Verificar estatus del perfil antes de dejar entrar
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('is_active, estatus')
      .eq('id', data.user.id)
      .single()

    if (perfil) {
      if (perfil.estatus === 'pendiente') {
        await supabase.auth.signOut()
        setLoading(false)
        Alert.alert(
          'Cuenta pendiente',
          'Tu cuenta está pendiente de aprobación por tu nutriólogo. Te avisaremos cuando sea revisada.',
        )
        return
      }
      if (perfil.estatus === 'rechazado') {
        await supabase.auth.signOut()
        setLoading(false)
        Alert.alert(
          'Solicitud rechazada',
          'Tu solicitud de registro fue rechazada. Contacta a tu nutriólogo para más información.',
        )
        return
      }
      if (perfil.is_active === false) {
        await supabase.auth.signOut()
        setLoading(false)
        Alert.alert(
          'Cuenta deshabilitada',
          'Tu cuenta se encuentra deshabilitada. Comunícate con tu administrador o nutriólogo para obtener más información.',
        )
        return
      }
    }
    setLoading(false)
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
                <Text style={styles.title}>Bienvenido de vuelta</Text>
                <Text style={styles.subtitle}>Inicia sesión para continuar tu seguimiento.</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.duration(500).delay(140)} style={styles.form}>
                <View>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Correo electrónico"
                      placeholderTextColor={PALETTE.mutedMint}
                      value={email}
                      onChangeText={t => { setEmail(t); if (errors.email) setErrors(e => ({ ...e, email: undefined })) }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  {errors.email && <Text style={styles.error}>{errors.email}</Text>}
                </View>

                <View>
                  <AuthInput
                    placeholder="Contraseña"
                    value={password}
                    onChangeText={t => { setPassword(t); if (errors.password) setErrors(e => ({ ...e, password: undefined })) }}
                    secureTextEntry
                  />
                  {errors.password && <Text style={styles.error}>{errors.password}</Text>}
                </View>

                <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                  <Text style={styles.primaryBtnText}>{loading ? 'Ingresando...' : 'Ingresar'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={{ alignSelf: 'center', marginTop: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.link}>Olvidé mi contraseña</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.footer}>
                <Text style={styles.footerText}>¿No tienes cuenta? </Text>
                <Link href="/(auth)/register" asChild>
                  <TouchableOpacity><Text style={styles.link}>Regístrate</Text></TouchableOpacity>
                </Link>
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
  inner: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 28 },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 32, height: 32, borderRadius: 10 },
  brandName: { color: PALETTE.warmWhite, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: PALETTE.warmWhite, letterSpacing: -0.6 },
  subtitle: { fontSize: 15, color: PALETTE.mutedMint, lineHeight: 21 },

  form: { gap: 14 },
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
    justifyContent: 'center', alignItems: 'center', marginTop: 6,
    shadowColor: PALETTE.mint, shadowOpacity: 0.3, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  primaryBtnText: { color: PALETTE.onMint, fontWeight: '800', fontSize: 16 },
  link: { color: PALETTE.mint, fontWeight: '600', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  footerText: { color: PALETTE.mutedMint, fontSize: 14 },
})
