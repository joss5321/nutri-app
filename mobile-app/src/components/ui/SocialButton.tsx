import { ActivityIndicator, Text, TouchableOpacity } from 'react-native'

interface SocialButtonProps {
  label: string
  onPress: () => void
  loading?: boolean
  icon: string
  bgColor: string
  textColor: string
  borderColor: string
}

export function SocialButton({
  label,
  onPress,
  loading = false,
  icon,
  bgColor,
  textColor,
  borderColor,
}: SocialButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
      className="flex-row items-center justify-center rounded-xl py-3.5 mb-3"
      style={{ backgroundColor: bgColor, borderWidth: 1, borderColor }}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          <Text className="text-lg mr-2.5" style={{ lineHeight: 22 }}>{icon}</Text>
          <Text className="font-semibold text-base" style={{ color: textColor }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}
