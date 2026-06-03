import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '@/constants/colors'

interface AppHeaderProps {
  title: string
  onMenuPress?: () => void
  onBellPress?: () => void
}

export function AppHeader({ title, onMenuPress, onBellPress }: AppHeaderProps) {
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.background }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
      }}>
        <TouchableOpacity onPress={onMenuPress} style={{ width: 36, height: 36, justifyContent: 'center' }}>
          <Ionicons name="menu" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.primary }}>{title}</Text>
        <TouchableOpacity onPress={onBellPress} style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-end' }}>
          <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
