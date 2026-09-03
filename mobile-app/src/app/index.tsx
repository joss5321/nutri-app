import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuthStore } from '@/store/auth'
import { COLORS } from '@/constants/colors'
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';

export default function Index() {
  const { session, initialized, isPasswordRecovery } = useAuthStore()

  useEffect(() => {
    NavigationBar.setVisibilityAsync('hidden');
    NavigationBar.setBehaviorAsync('overlay-swipe');
  }, []);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  if (isPasswordRecovery) return <Redirect href="/reset-password" />

  if (session) return <Redirect href="/(app)/progreso" />

  return <Redirect href="/(auth)/welcome" />
}