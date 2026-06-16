import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuthStore } from '@/store/auth'
import { COLORS } from '@/constants/colors'
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';

export default function Index() {
  const { session, initialized } = useAuthStore()

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

  if (session) return <Redirect href="/(app)/progreso" />

  return <Redirect href="/(auth)/welcome" />
}