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
            <Text style={styles.title}>Welcome to App Name</Text>
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
            <Text style={styles.brandName}>Nombre App</Text>
          </View>
        </SafeAreaView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  imageArea: {
    height: height * 0.55,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderIcon: { fontSize: 56 },
  bottomArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 0,
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  textBlock: { gap: 12 },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonBlock: { paddingBottom: 16, gap: 20 },
  button: {
    paddingVertical: 2,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 16,
    backgroundColor: COLORS.white,
    paddingHorizontal: 60,
    paddingVertical: 14,
    borderRadius: 50,
    overflow: 'hidden',
  },
  brandName: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontStyle: 'italic',
  },
})
