import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import * as Linking from 'expo-linking'
import * as SplashScreen from 'expo-splash-screen'
import { useColorScheme } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import '../global.css'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const { setSession, setInitialized, initialized } = useAuthStore()

  // Inicializa sesión y escucha cambios de auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setInitialized(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  // Escucha deep links OAuth (cuando Safari redirige de vuelta a la app)
  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      // Detecta cualquier deep link que traiga tokens o código OAuth
      if (!url.includes('access_token') && !url.includes('code=')) return
      await supabase.auth.exchangeCodeForSession(url)
    }

    // App abierta desde background via deep link
    const sub = Linking.addEventListener('url', handleUrl)

    // App abierta en frío via deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url })
    })

    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (initialized) {
      SplashScreen.hideAsync()
    }
  }, [initialized])

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  )
}
