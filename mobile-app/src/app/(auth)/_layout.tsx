import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth'

export default function AuthLayout() {
  const { session, initialized, isPasswordRecovery } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (initialized && session && !isPasswordRecovery) {
      router.replace('/(app)/progreso')
    }
  }, [session, initialized, isPasswordRecovery])

  return <Stack screenOptions={{ headerShown: false }} />
}
