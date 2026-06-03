import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth'

export default function AuthLayout() {
  const { session, initialized } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (initialized && session) {
      router.replace('/(app)/progreso')
    }
  }, [session, initialized])

  return <Stack screenOptions={{ headerShown: false }} />
}
