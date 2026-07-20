import { useEffect } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/auth'
import { useNewsStore } from '@/store/news'
import { COLORS } from '@/constants/colors'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({
  name,
  color,
  size,
  badge,
}: {
  name: IoniconsName
  color: string
  size: number
  badge?: boolean
}) {
  return (
    <View>
      <Ionicons name={name} size={size} color={color} />
      {badge && (
        <View
          style={{
            position: 'absolute',
            top: -1,
            right: -5,
            width: 9,
            height: 9,
            borderRadius: 4.5,
            backgroundColor: '#EF4444',
            borderWidth: 1.5,
            borderColor: COLORS.white,
          }}
        />
      )}
    </View>
  )
}

export default function AppLayout() {
  const { session, initialized, user } = useAuthStore()
  const router = useRouter()
  const { hasNewRutinas, hasNewNutricion, checkAll } = useNewsStore()

  useEffect(() => {
    if (initialized && !session) {
      router.replace('/(auth)/welcome')
    }
  }, [session, initialized])

  useEffect(() => {
    if (user?.id) {
      checkAll(user.id)
    }
  }, [user?.id])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="trending-up" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="rutinas"
        options={{
          title: 'Rutinas',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="barbell" color={color} size={size} badge={hasNewRutinas} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutricion"
        options={{
          title: 'Plan Nutricional',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="restaurant" color={color} size={size} badge={hasNewNutricion} />
          ),
          tabBarLabelStyle: { ...styles.tabLabel, fontSize: 9 },
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    elevation: 0,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
  },
  tabLabel: { fontSize: 10, fontWeight: '600' },
})
