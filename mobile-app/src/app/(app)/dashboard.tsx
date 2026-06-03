import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'

const QUICK_ACTIONS = ['Registrar comida', 'Ver plan nutricional', 'Mi progreso', 'Registro de agua']

export default function DashboardScreen() {
  const { user } = useAuthStore()
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Usuario'

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-6">

          {/* Header */}
          <View className="flex-row items-center justify-between mb-8">
            <View>
              <Text className="text-gray-500 text-sm">Buenos días 👋</Text>
              <Text className="text-2xl font-bold text-gray-900 mt-0.5">
                Hola, {firstName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleSignOut}
              className="bg-white rounded-xl px-4 py-2 border border-gray-100"
            >
              <Text className="text-red-500 font-medium text-sm">Cerrar sesión</Text>
            </TouchableOpacity>
          </View>

          {/* Tarjetas de resumen */}
          <View className="flex-row gap-4 mb-6">
            <View className="flex-1 bg-blue-500 rounded-2xl p-4">
              <Text className="text-blue-100 text-xs font-medium mb-1">Calorías hoy</Text>
              <Text className="text-white text-2xl font-bold">0</Text>
              <Text className="text-blue-200 text-xs mt-0.5">de 2,000 kcal</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
              <Text className="text-gray-500 text-xs font-medium mb-1">Proteína</Text>
              <Text className="text-gray-900 text-2xl font-bold">0 g</Text>
              <Text className="text-gray-400 text-xs mt-0.5">de 120 g</Text>
            </View>
          </View>

          <View className="flex-row gap-4 mb-8">
            <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
              <Text className="text-gray-500 text-xs font-medium mb-1">Agua</Text>
              <Text className="text-gray-900 text-2xl font-bold">0</Text>
              <Text className="text-gray-400 text-xs mt-0.5">de 8 vasos</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
              <Text className="text-gray-500 text-xs font-medium mb-1">Comidas</Text>
              <Text className="text-gray-900 text-2xl font-bold">0</Text>
              <Text className="text-gray-400 text-xs mt-0.5">registradas hoy</Text>
            </View>
          </View>

          {/* Acciones rápidas */}
          <Text className="text-lg font-semibold text-gray-900 mb-3">Acciones rápidas</Text>
          <View className="gap-3">
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action}
                className="bg-white rounded-2xl p-4 border border-gray-100 flex-row items-center justify-between"
                activeOpacity={0.7}
              >
                <Text className="text-gray-800 font-medium">{action}</Text>
                <Text className="text-gray-400 text-base">→</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info de cuenta */}
          <View className="mt-6 bg-white rounded-2xl p-4 border border-gray-100">
            <Text className="text-xs text-gray-400 font-semibold tracking-widest mb-1">CUENTA</Text>
            <Text className="text-gray-600 text-sm">{user?.email}</Text>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
