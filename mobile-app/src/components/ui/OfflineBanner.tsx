import { useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import NetInfo from '@react-native-community/netinfo'
import { COLORS } from '@/constants/colors'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false)
    })
    return () => unsubscribe()
  }, [])

  if (!isOffline) return null

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <Ionicons name="cloud-offline-outline" size={14} color={COLORS.white} />
      <Text style={styles.text}>Sin conexión a internet</Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.error,
    paddingVertical: 6,
  },
  text: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
})
