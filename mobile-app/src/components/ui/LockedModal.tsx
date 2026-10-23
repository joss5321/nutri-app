import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '@/constants/colors'

interface LockedModalProps {
  visible: boolean
  onDismiss: () => void
  mensaje?: string
  /** Si se pasa, muestra un botón "Suscribirme" primario arriba de "Entendido". */
  onSuscribirme?: () => void
}

export function LockedModal({
  visible,
  onDismiss,
  mensaje = 'Para poder acceder a este módulo debes suscribirte.',
  onSuscribirme,
}: LockedModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.iconBox}>
            <Ionicons name="lock-closed" size={28} color={COLORS.primary} />
          </View>
          <Text style={s.title}>Módulo bloqueado</Text>
          <Text style={s.message}>{mensaje}</Text>
          {onSuscribirme && (
            <TouchableOpacity style={s.button} onPress={onSuscribirme} activeOpacity={0.85}>
              <Text style={s.buttonText}>Suscribirme</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={onSuscribirme ? s.secondaryButton : s.button}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={onSuscribirme ? s.secondaryButtonText : s.buttonText}>Entendido</Text>
          </TouchableOpacity>
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
  button: {
    width: '100%', height: 48, borderRadius: 14, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  buttonText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    width: '100%', height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  secondaryButtonText: { color: COLORS.muted, fontWeight: '600', fontSize: 14 },
})
