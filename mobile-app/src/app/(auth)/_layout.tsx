import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth'

export default function AuthLayout() {
  const { session, initialized, isPasswordRecovery } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (initialized && session && !isPasswordRecovery) {
      // Rutinas, no Progreso: es la única pantalla disponible para todos los
      // pacientes (ver mismo fix en src/app/index.tsx).
      router.replace('/(app)/rutinas')
    }
  }, [session, initialized, isPasswordRecovery])

  return <Stack screenOptions={{ headerShown: false }} />
}
