import { ActivityIndicator, Text, TouchableOpacity } from 'react-native'

type Variant = 'primary' | 'secondary' | 'outline' | 'danger'

interface ButtonProps {
  title: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: Variant
}

const container: Record<Variant, string> = {
  primary: 'bg-blue-500',
  secondary: 'bg-gray-100',
  outline: 'border-2 border-blue-500 bg-transparent',
  danger: 'bg-red-500',
}

const label: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-gray-800',
  outline: 'text-blue-500',
  danger: 'text-white',
}

const spinnerColor: Record<Variant, string> = {
  primary: '#ffffff',
  secondary: '#208AEF',
  outline: '#208AEF',
  danger: '#ffffff',
}

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      className={`rounded-xl py-4 items-center justify-center ${container[variant]} ${isDisabled ? 'opacity-60' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor[variant]} />
      ) : (
        <Text className={`font-semibold text-base ${label[variant]}`}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}
