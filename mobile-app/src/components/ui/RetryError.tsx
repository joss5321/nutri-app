import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { COLORS } from '@/constants/colors'

interface RetryErrorProps {
  message?: string
  onRetry: () => void
}

export function RetryError({ message = 'No se pudo cargar la información. Revisa tu conexión.', onRetry }: RetryErrorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="cloud-offline-outline" size={28} color={COLORS.primary} />
      </View>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
        <Ionicons name="refresh" size={16} color={COLORS.white} />
        <Text style={styles.retryText}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  icon: {
    width: 56, height: 56, borderRadius: 28, marginBottom: 12,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  message: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  retryText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
})
