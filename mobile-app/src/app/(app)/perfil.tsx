import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/ui/AppHeader'
import { COLORS } from '@/constants/colors'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'

const DATA_ROWS = [
  { icon: 'person-outline', label: 'Nombre completo', value: 'Ana García López' },
  { icon: 'mail-outline', label: 'Correo electrónico', value: 'ana.garcia@email.com' },
  { icon: 'call-outline', label: 'Teléfono', value: '55 1234 5678' },
  { icon: 'calendar-outline', label: 'Fecha de nacimiento', value: '15 de mayo de 1996' },
  { icon: 'location-outline', label: 'Ubicación', value: 'Ciudad de México, México' },
  { icon: 'resize-outline', label: 'Estatura', value: '1.65 m' },
  { icon: 'scale-outline', label: 'Peso actual', value: '62 kg' },
  { icon: 'person-add-outline', label: 'Objetivo', value: 'Bajar grasa y tonificar' },
] as const

const PLANS = [
  {
    key: 'basico', icon: '🌱', name: 'Plan Básico', price: '$199 MXN', period: 'al mes', current: false,
    features: ['Recetas saludables', 'Plan semanal básico', 'Recordatorio de agua', 'Soporte por email'],
  },
  {
    key: 'pro', icon: '👑', name: 'Plan Pro', price: '$349 MXN', period: 'al mes', current: false,
    features: ['Todo lo del plan Básico', 'Planes personalizados', 'Seguimiento de progreso', 'Soporte prioritario'],
  },
]

export default function PerfilScreen() {
  const { user } = useAuthStore()
  const name = user?.user_metadata?.full_name ?? 'Ana García'
  const email = user?.email ?? 'ana.garcia@email.com'

  const handleSignOut = async () => { await supabase.auth.signOut() }

  return (
    <View style={s.container}>
      <AppHeader title="Perfil" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16, gap: 16, paddingBottom: 32 }}>

          {/* Avatar + info */}
          <View style={s.profileCard}>
            <View style={s.avatarWrap}>
              <View style={s.avatar}>
                <Ionicons name="person" size={42} color={COLORS.primary} />
              </View>
              <TouchableOpacity style={s.cameraBtn}>
                <Ionicons name="camera" size={14} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.userName}>{name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="mail-outline" size={13} color={COLORS.muted} />
                <Text style={s.userEmail}>{email}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="call-outline" size={13} color={COLORS.muted} />
                <Text style={s.userEmail}>55 1234 5678</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="calendar-outline" size={13} color={COLORS.muted} />
                <Text style={s.userEmail}>28 años  •  15 May 1996</Text>
              </View>

              <TouchableOpacity style={s.editBtn}>
                <Ionicons name="pencil-outline" size={14} color={COLORS.primary} />
                <Text style={s.editBtnText}>Editar perfil</Text>
              </TouchableOpacity>  
            </View>
          </View>

          {/* Datos personales */}
          <Text style={s.sectionTitle}>Datos personales</Text>
          <View style={s.dataCard}>
            {DATA_ROWS.map((row, i) => (
              <TouchableOpacity
                key={i}
                style={[s.dataRow, i < DATA_ROWS.length - 1 && s.dataRowBorder]}
              >
                <Ionicons name={row.icon as any} size={18} color={COLORS.muted} />
                <Text style={s.dataLabel}>{row.label}</Text>
                <Text style={s.dataValue}>{row.value}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Membresía actual */}
          <Text style={s.sectionTitle}>Mi membresía actual</Text>
          <View style={s.premiumCard}>
            <View style={s.premiumIcon}><Text style={{ fontSize: 24 }}>⭐</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.premiumName}>Plan Premium</Text>
              <View style={s.currentBadge}><Text style={s.currentBadgeText}>Plan actual</Text></View>
              <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, lineHeight: 16 }}>
                Acceso completo a todas las funciones, recetas, planes y seguimiento personalizado.
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.premiumPrice}>$499 MXN</Text>
              <Text style={{ fontSize: 11, color: COLORS.muted }}>al mes</Text>
              <Text style={{ fontSize: 10, color: COLORS.muted, marginTop: 4 }}>Renovación: 15/06/2024</Text>
            </View>
          </View>

          {/* Otros planes */}
          <Text style={s.sectionTitle}>Otros planes disponibles</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {PLANS.map(plan => (
              <View key={plan.key} style={[s.planCard, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 20 }}>{plan.icon}</Text>
                  <Text style={s.planName}>{plan.name}</Text>
                </View>
                <Text style={s.planPrice}>{plan.price}</Text>
                <Text style={{ fontSize: 11, color: COLORS.muted }}>{plan.period}</Text>
                <View style={{ marginTop: 8, gap: 4 }}>
                  {plan.features.map((f, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
                      <Ionicons name="checkmark" size={12} color={COLORS.primary} style={{ marginTop: 2 }} />
                      <Text style={{ fontSize: 11, color: COLORS.text, flex: 1 }}>{f}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={s.planBtn}>
                  <Text style={s.planBtnText}>Elegir plan</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Cerrar sesión */}
          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={s.signOutText}>Cerrar sesión</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  profileCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.cardBg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.border,
  },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.primary, width: 22, height: 22,
    borderRadius: 11, justifyContent: 'center', alignItems: 'center',
  },
  userName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.muted },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start', 
    marginTop: 6,
  },
  editBtnText: { fontSize: 12, color: COLORS.primary },
  dataCard: { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  dataRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dataLabel: { flex: 1, fontSize: 13, color: COLORS.text },
  dataValue: { fontSize: 13, color: COLORS.muted },
  premiumCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  premiumIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  premiumName: { fontWeight: '700', fontSize: 16, color: COLORS.text },
  premiumPrice: { fontWeight: '800', fontSize: 18, color: COLORS.text },
  currentBadge: {
    backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
    alignSelf: 'flex-start', marginTop: 4,
  },
  currentBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },
  planCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  planName: { fontWeight: '700', fontSize: 13, color: COLORS.text },
  planPrice: { fontWeight: '800', fontSize: 16, color: COLORS.text, marginTop: 6 },
  planBtn: {
    marginTop: 10, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20, paddingVertical: 8, alignItems: 'center',
  },
  planBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFF5F5',
    borderRadius: 12, padding: 14, marginTop: 8,
  },
  signOutText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
})
