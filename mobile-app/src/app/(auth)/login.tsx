import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>

            <View style={styles.header}>
              <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
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
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 24, gap: 24 },
  header: { gap: 8 },
  logo: { width: 64, height: 64, borderRadius: 20, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  form: { gap: 12 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  eyeBtn: { paddingLeft: 8 },
  error: { color: COLORS.error, fontSize: 12, marginTop: -6, paddingLeft: 4 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 17 },
  link: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  footerText: { color: COLORS.muted, fontSize: 14 },
})
