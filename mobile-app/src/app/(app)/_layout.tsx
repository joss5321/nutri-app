import { useEffect } from 'react'
import { AppState, Platform, StyleSheet, View } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/auth'
import { useNewsStore } from '@/store/news'
import { COLORS } from '@/constants/colors'
import { registrarActividadSiCorresponde } from '@/lib/activity'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({
  name,
  color,
  size,
  focused,
  badge,
}: {
  name: IoniconsName
  color: string
  size: number
  focused: boolean
  badge?: boolean
}) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      <Ionicons name={name} size={size} color={color} />
      {badge && (
        <View
          style={{
            position: 'absolute',
            top: -1,
            right: -3,
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
  const { session, initialized, user, isPasswordRecovery } = useAuthStore()
  const router = useRouter()
  const { hasNewRutinas, hasNewNutricion, checkAll } = useNewsStore()

  useEffect(() => {
    // Defensa adicional: una sesión de recuperación nunca debe quedar
    // navegando dentro de (app), aunque session sea verdadero.
    if (initialized && isPasswordRecovery) {
      router.replace('/reset-password')
      return
    }
    if (initialized && !session) {
      router.replace('/(auth)/welcome')
    }
  }, [session, initialized, isPasswordRecovery])

  useEffect(() => {
    if (user?.id) {
      checkAll(user.id)
    }
  }, [user?.id])

  // Radar (Blueprint v1.1, R3) — PATIENT_ACTIVE: una señal por día, nunca
  // por pantalla. Se registra al entrar a la zona autenticada y cada vez
  // que la app vuelve a primer plano; registrarActividadSiCorresponde ya
  // trae su propio guard local para no escribir más de una vez al día.
  useEffect(() => {
    if (!user?.id) return
    registrarActividadSiCorresponde(user.id)
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') registrarActividadSiCorresponde(user.id)
    })
    return () => sub.remove()
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
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="trending-up" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="rutinas"
        options={{
          title: 'Rutinas',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="barbell" color={color} size={size} focused={focused} badge={hasNewRutinas} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutricion"
        options={{
          title: 'Plan Nutricional',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="restaurant" color={color} size={size} focused={focused} badge={hasNewNutricion} />
          ),
          tabBarLabelStyle: { ...styles.tabLabel, fontSize: 9 },
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="person-circle" color={color} size={size} focused={focused} />
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
  tabIconWrap: {
    width: 40,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconWrapActive: {
    backgroundColor: COLORS.primaryLight,
  },
})
