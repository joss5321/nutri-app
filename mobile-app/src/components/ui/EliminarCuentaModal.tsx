import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { eliminarCuenta } from '@/lib/api/cuenta'
import { getUrlGestionSuscripcion } from '@/lib/revenuecat'

type Paso = 'warning' | 'suscripcion-nativa' | 'password' | 'confirmar-final'

interface EliminarCuentaModalProps {
  visible: boolean
  onClose: () => void
  userEmail: string
  /** Suscripción activa vía Stripe — se cancela sola en el servidor, no requiere aviso. */
  tieneSuscripcionStripe: boolean
  /** Suscripción activa vía RevenueCat (App Store/Google Play) — no se puede
   * cancelar por API, hay que avisar al usuario antes de continuar. */
  tieneSuscripcionNativa: boolean
}

export function EliminarCuentaModal({
  visible,
  onClose,
  userEmail,
  tieneSuscripcionStripe,
  tieneSuscripcionNativa,
}: EliminarCuentaModalProps) {
  const [paso, setPaso] = useState<Paso>('warning')
  const [password, setPassword] = useState('')
  const [verificandoPassword, setVerificandoPassword] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [managementUrl, setManagementUrl] = useState<string | null>(null)

  // Reinicia el flujo cada vez que se vuelve a abrir el modal.
  useEffect(() => {
    if (visible) {
      setPaso('warning')
      setPassword('')
    }
  }, [visible])

  useEffect(() => {
    if (paso !== 'suscripcion-nativa') return
    getUrlGestionSuscripcion()
      .then(setManagementUrl)
      .catch(() => setManagementUrl(null))
  }, [paso])

  const handleContinuarDesdeWarning = () => {
    setPaso(tieneSuscripcionNativa ? 'suscripcion-nativa' : 'password')
  }

  const handleAbrirGestionNativa = async () => {
    if (managementUrl) await Linking.openURL(managementUrl)
  }

  const handleConfirmarPassword = async () => {
    if (!password) {
      Alert.alert('Falta tu contraseña', 'Ingresa tu contraseña para continuar.')
      return
    }
    setVerificandoPassword(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: userEmail, password })
      if (error) {
        Alert.alert('Error', error.message)
        return
      }
      setPaso('confirmar-final')
    } finally {
      setVerificandoPassword(false)
    }
  }

  const handleEliminarDefinitivo = async () => {
    setEliminando(true)
    try {
      await eliminarCuenta()
      await supabase.auth.signOut()
      // No hace falta limpiar el store de Zustand ni el estado de
      // RevenueCat aquí — el listener de onAuthStateChange en _layout.tsx
      // ya lo hace al detectar la sesión en null, igual que "Cerrar sesión".
      onClose()
    } catch (err) {
      Alert.alert('No se pudo eliminar tu cuenta', err instanceof Error ? err.message : 'Intenta de nuevo.')
    } finally {
      setEliminando(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          {paso === 'warning' && (
            <>
              <View style={s.iconBox}>
                <Ionicons name="warning-outline" size={28} color={COLORS.error} />
              </View>
              <Text style={s.title}>Eliminar tu cuenta</Text>
              <Text style={s.message}>
                Esto borra permanentemente tu perfil, rutinas, planes de nutrición, medidas,
                citas y todo tu historial{tieneSuscripcionStripe ? ', y cancela tu suscripción' : ''}.
                No se puede deshacer.
              </Text>
              <TouchableOpacity style={s.dangerButton} onPress={handleContinuarDesdeWarning} activeOpacity={0.85}>
                <Text style={s.dangerButtonText}>Continuar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryButton} onPress={onClose} activeOpacity={0.85}>
                <Text style={s.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}

          {paso === 'suscripcion-nativa' && (
            <>
              <View style={s.iconBox}>
                <Ionicons name="card-outline" size={28} color={COLORS.error} />
              </View>
              <Text style={s.title}>Tu suscripción sigue activa</Text>
              <Text style={s.message}>
                Eliminar tu cuenta NO cancela el cobro de App Store/Google Play — seguirán
                cobrándote hasta que la canceles tú mismo desde ahí.
              </Text>
              {managementUrl && (
                <TouchableOpacity style={s.secondaryButton} onPress={handleAbrirGestionNativa} activeOpacity={0.85}>
                  <Text style={s.secondaryButtonText}>Cancelar suscripción primero</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.dangerButton} onPress={() => setPaso('password')} activeOpacity={0.85}>
                <Text style={s.dangerButtonText}>Entendido, continuar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryButton} onPress={onClose} activeOpacity={0.85}>
                <Text style={s.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}

          {paso === 'password' && (
            <>
              <View style={s.iconBox}>
                <Ionicons name="lock-closed-outline" size={28} color={COLORS.primary} />
              </View>
              <Text style={s.title}>Confirma tu identidad</Text>
              <Text style={s.message}>Ingresa tu contraseña para continuar.</Text>
              <TextInput
                style={s.input}
                placeholder="Contraseña"
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoFocus
                editable={!verificandoPassword}
              />
              <TouchableOpacity
                style={s.dangerButton}
                onPress={handleConfirmarPassword}
                disabled={verificandoPassword}
                activeOpacity={0.85}
              >
                {verificandoPassword ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={s.dangerButtonText}>Confirmar identidad</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryButton} onPress={onClose} disabled={verificandoPassword} activeOpacity={0.85}>
                <Text style={s.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}

          {paso === 'confirmar-final' && (
            <>
              <View style={s.iconBox}>
                <Ionicons name="trash-outline" size={28} color={COLORS.error} />
              </View>
              <Text style={s.title}>Última confirmación</Text>
              <Text style={s.message}>
                Tu identidad quedó confirmada. Al continuar, tu cuenta y todos tus datos se
                eliminan de inmediato — esta acción no se puede deshacer.
              </Text>
              <TouchableOpacity
                style={s.dangerButton}
                onPress={handleEliminarDefinitivo}
                disabled={eliminando}
                activeOpacity={0.85}
              >
                {eliminando ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={s.dangerButtonText}>Sí, eliminar mi cuenta</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryButton} onPress={onClose} disabled={eliminando} activeOpacity={0.85}>
                <Text style={s.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: COLORS.overlay,
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: COLORS.white, borderRadius: 20,
    padding: 24, alignItems: 'center', gap: 10,
  },
  iconBox: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  message: { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  input: {
    width: '100%', height: 48, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 14, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.inputBg, marginBottom: 2,
  },
  dangerButton: {
    width: '100%', height: 48, borderRadius: 14, backgroundColor: COLORS.error,
    justifyContent: 'center', alignItems: 'center',
  },
  dangerButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    width: '100%', height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  secondaryButtonText: { color: COLORS.muted, fontWeight: '600', fontSize: 14 },
})
