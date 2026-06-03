import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const router = useRouter()

  const validate = (): boolean => {
    if (!email.trim()) {
      setError('El correo es requerido')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Ingresa un correo válido')
      return false
    }
    setError(undefined)
    return true
  }

  const handleSendReset = async () => {
    if (!validate()) return

    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: 'mobileapp://reset-password' },
    )
    setLoading(false)

    if (resetError) {
      Alert.alert('Error', resetError.message)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 px-6 items-center justify-center">
          <View className="w-24 h-24 bg-blue-50 rounded-full items-center justify-center mb-6">
            <Text className="text-5xl">✉️</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900 text-center mb-3">
            ¡Correo enviado!
          </Text>
          <Text className="text-gray-500 text-center text-base mb-10 leading-6">
            Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
          </Text>
          <View className="w-full">
            <Button
              title="Volver al inicio de sesión"
              onPress={() => router.replace('/(auth)/login')}
            />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6">
          {/* Botón de regreso */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 mb-8 w-10 h-10 rounded-full bg-white shadow-sm items-center justify-center border border-gray-100"
          >
            <Text className="text-gray-600 text-lg font-medium">←</Text>
          </TouchableOpacity>

          {/* Encabezado */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900 mb-2">
              ¿Olvidaste tu contraseña?
            </Text>
            <Text className="text-gray-500 text-base leading-6">
              Ingresa tu correo y te enviaremos un enlace para restablecerla.
            </Text>
          </View>

          {/* Formulario */}
          <View className="bg-white rounded-3xl p-6 shadow-sm">
            <Input
              label="Correo electrónico"
              value={email}
              onChangeText={(t) => {
                setEmail(t)
                if (error) setError(undefined)
              }}
              placeholder="tu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={error}
              autoFocus
            />

            <Button
              title="Enviar enlace de recuperación"
              onPress={handleSendReset}
              loading={loading}
            />
          </View>

          {/* Link de regreso */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500">¿La recuerdas? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text className="text-blue-500 font-semibold">Inicia sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
