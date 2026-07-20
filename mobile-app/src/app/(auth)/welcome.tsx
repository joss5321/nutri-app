import { Dimensions, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { COLORS } from '@/constants/colors'

const { height } = Dimensions.get('window')

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      {/* Área imagen superior */}
      <View style={styles.imageArea}>
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderIcon}>🏋️</Text>
        </View>
      </View>

      {/* Área inferior verde */}
      <View style={styles.bottomArea}>
        <SafeAreaView edges={['bottom']} style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={styles.textBlock}>
            <Text style={styles.title}>MyFitTrack</Text>
            <Text style={styles.subtitle}>
              Explora todos los beneficios y productos{'\n'}que te ofrece la App
            </Text>
          </View>

          <View style={styles.buttonBlock}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Continuar</Text>
            </TouchableOpacity>
            <Text style={styles.brandName}>MyFitTrack</Text>
          </View>
        </SafeAreaView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1B2A' },
  imageArea: {
    height: height * 0.55,
    backgroundColor: '#0D1B2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(76,175,141,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(76,175,141,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderIcon: { fontSize: 60 },
  bottomArea: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
  },
  textBlock: { gap: 10 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonBlock: { paddingBottom: 20, gap: 16 },
  button: {
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 64,
    paddingVertical: 16,
    borderRadius: 50,
    overflow: 'hidden',
  },
  brandName: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '500',
  },
})
