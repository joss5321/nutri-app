import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { AUTH_COLORS as PALETTE } from '@/constants/colors'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const FEATURES: { icon: IoniconsName; label: string }[] = [
  { icon: 'restaurant-outline', label: 'Recetas saludables' },
  { icon: 'barbell-outline', label: 'Rutinas efectivas' },
  { icon: 'clipboard-outline', label: 'Planes personalizados' },
]

const WEEK = [
  { day: 'L', value: 0.45 },
  { day: 'M', value: 0.6 },
  { day: 'M', value: 0.5 },
  { day: 'J', value: 0.8 },
  { day: 'V', value: 0.65 },
  { day: 'S', value: 1 },
  { day: 'D', value: 0.35 },
] as const

function ActionButton({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode
  onPress: () => void
  style: object
  accessibilityLabel: string
}) {
  const scale = useSharedValue(1)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 100 }) }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 150 }) }}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[style, hovered && styles.pressableHovered, focused && styles.pressableFocused]}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}

export default function WelcomeScreen() {
  const router = useRouter()
  const isToday = (i: number) => WEEK[i].value === 1

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>

            <Animated.View entering={FadeIn.duration(450)} style={styles.brand}>
              <Image source={require('@/assets/branding/icon.png')} style={styles.brandLogo} />
              <Text style={styles.brandName}>MyFitTrack</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(500).delay(80)} style={styles.heroText}>
              <Text style={styles.title}>Tu bienestar{'\n'}es tu mejor inversión</Text>
              <Text style={styles.subtitle}>
                Rutinas, nutrición y seguimiento de tu progreso en un solo lugar, guiados por tu nutriólogo.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(500).delay(160)} style={styles.statCard}>
              <View style={styles.statHeader}>
                <Text style={styles.statHeaderLabel}>Tu semana en un vistazo</Text>
                <Ionicons name="trending-up-outline" size={18} color={PALETTE.mint} />
              </View>

              <View style={styles.barsRow}>
                {WEEK.map((d, i) => (
                  <View key={i} style={styles.barColumn}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${d.value * 100}%`,
                            backgroundColor: isToday(i) ? PALETTE.mint : PALETTE.mintDim,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barDay, isToday(i) && styles.barDayActive]}>{d.day}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.statDivider} />

              <View style={styles.macroRow}>
                <View style={styles.macroInfo}>
                  <Text style={styles.macroLabel}>Proteína de hoy</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: '71%' }]} />
                  </View>
                </View>
                <Text style={styles.macroValue}>78g / 110g</Text>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(500).delay(220)} style={styles.featuresRow}>
              {FEATURES.map((f) => (
                <View key={f.label} style={styles.featureCard}>
                  <View style={styles.featureIconWrap}>
                    <Ionicons name={f.icon} size={19} color={PALETTE.mint} />
                  </View>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                </View>
              ))}
            </Animated.View>

          </View>

          <Animated.View entering={FadeInDown.duration(500).delay(280)} style={styles.ctaBlock}>
            <ActionButton
              onPress={() => router.push('/(auth)/register')}
              style={styles.primaryBtn}
              accessibilityLabel="Comenzar ahora, crear una cuenta"
            >
              <Text style={styles.primaryBtnText}>Comenzar ahora</Text>
              <Ionicons name="arrow-forward" size={18} color={PALETTE.onMint} />
            </ActionButton>

            <ActionButton
              onPress={() => router.push('/(auth)/login')}
              style={styles.secondaryBtn}
              accessibilityLabel="Ya tengo una cuenta, iniciar sesión"
            >
              <Text style={styles.secondaryBtnText}>Ya tengo una cuenta</Text>
            </ActionButton>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.bg,
    experimental_backgroundImage:
      'radial-gradient(circle at 15% -8%, rgba(61,220,151,0.18), transparent 55%), radial-gradient(circle at 100% 105%, rgba(18,61,48,0.95), transparent 60%)',
  },
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between' },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  brandLogo: { width: 32, height: 32, borderRadius: 10 },
  brandName: { color: PALETTE.warmWhite, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  heroText: { gap: 12 },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: PALETTE.warmWhite,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15.5,
    lineHeight: 22,
    color: PALETTE.mutedMint,
    maxWidth: 320,
  },

  statCard: {
    marginTop: 28,
    backgroundColor: PALETTE.bgElevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PALETTE.hairline,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statHeaderLabel: { color: PALETTE.warmWhite, fontSize: 13.5, fontWeight: '600' },

  barsRow: { flexDirection: 'row', gap: 6 },
  barColumn: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: {
    width: '100%',
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(247,245,240,0.06)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 8 },
  barDay: { fontSize: 11, color: PALETTE.mutedMint, fontWeight: '600' },
  barDayActive: { color: PALETTE.mint },

  statDivider: { height: 1, backgroundColor: PALETTE.hairline },

  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  macroInfo: { flex: 1, gap: 8 },
  macroLabel: { fontSize: 12.5, color: PALETTE.mutedMint, fontWeight: '600' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(247,245,240,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: PALETTE.mint },
  macroValue: { fontSize: 13.5, color: PALETTE.warmWhite, fontWeight: '700' },

  featuresRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  featureCard: {
    flex: 1,
    backgroundColor: 'rgba(247,245,240,0.04)',
    borderWidth: 1,
    borderColor: PALETTE.hairline,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 8,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PALETTE.mintSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureLabel: {
    fontSize: 11.5,
    lineHeight: 15,
    color: PALETTE.warmWhite,
    fontWeight: '600',
    textAlign: 'center',
  },

  ctaBlock: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: PALETTE.mint,
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PALETTE.mint,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryBtnText: { color: PALETTE.onMint, fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(247,245,240,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: { color: PALETTE.warmWhite, fontSize: 15, fontWeight: '600' },

  pressableHovered: { opacity: 0.92 },
  pressableFocused: { borderWidth: 2, borderColor: PALETTE.warmWhite },
})
