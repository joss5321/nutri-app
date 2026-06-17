import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/ui/AppHeader'
import { COLORS } from '@/constants/colors'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import { fetchMiPerfil, type Perfil } from '@/lib/api/perfiles'
import { fetchUltimaMedida, type Medida } from '@/lib/api/medidas'
import { fetchMisCitas, type Cita } from '@/lib/api/citas'

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function formatFecha(fecha: string | null): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-').map(Number)
  return `${d} ${MONTH_SHORT[m - 1]} ${y}`
}

function calcularEdad(fecha: string | null): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-').map(Number)
  const hoy = new Date()
  let edad = hoy.getFullYear() - y
  const mesActual = hoy.getMonth() + 1
  if (mesActual < m || (mesActual === m && hoy.getDate() < d)) edad--
  return `${edad} años`
}

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: '#FEF3C7', text: '#92400E' },
  confirmada: { bg: '#D1FAE5', text: '#065F46' },
  cancelada: { bg: '#F3F4F6', text: '#6B7280' },
}

const PLANS = [
  {
    key: 'basico', icon: '🌱', name: 'Plan Básico', price: '$199 MXN', period: 'al mes',
    features: ['Recetas saludables', 'Plan semanal básico', 'Recordatorio de agua', 'Soporte por email'],
  },
  {
    key: 'pro', icon: '👑', name: 'Plan Pro', price: '$349 MXN', period: 'al mes',
    features: ['Todo lo del plan Básico', 'Planes personalizados', 'Seguimiento de progreso', 'Soporte prioritario'],
  },
]

export default function PerfilScreen() {
  const { user } = useAuthStore()
  const userId = user?.id ?? ''
  const email = user?.email ?? '—'

  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [medida, setMedida] = useState<Medida | null>(null)
  const [citas, setCitas] = useState<Cita[]>([])

  useEffect(() => {
    if (!userId) return
    Promise.all([fetchMiPerfil(userId), fetchUltimaMedida(userId), fetchMisCitas(userId)])
      .then(([p, m, c]) => { setPerfil(p); setMedida(m); setCitas(c) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const handleSignOut = async () => { await supabase.auth.signOut() }

  const nombre = perfil?.nombre_completo ?? user?.user_metadata?.full_name ?? 'Usuario'
  const isPremium = perfil?.plan_membresia === 'premium'

  const dataRows = [
    { icon: 'person-outline' as const, label: 'Nombre completo', value: nombre },
    { icon: 'mail-outline' as const, label: 'Correo electrónico', value: email },
    { icon: 'calendar-outline' as const, label: 'Fecha de nacimiento', value: formatFecha(perfil?.fecha_nacimiento ?? null) },
    { icon: 'male-female-outline' as const, label: 'Sexo', value: perfil?.sexo ? perfil.sexo.charAt(0).toUpperCase() + perfil.sexo.slice(1) : '—' },
    { icon: 'resize-outline' as const, label: 'Estatura', value: perfil?.altura_cm != null ? `${perfil.altura_cm} cm` : '—' },
    { icon: 'scale-outline' as const, label: 'Peso actual', value: medida?.peso_kg != null ? `${medida.peso_kg} kg` : '—' },
    { icon: 'analytics-outline' as const, label: 'IMC', value: medida?.imc != null ? medida.imc.toFixed(1) : '—' },
  ]

  if (loading) {
    return (
      <View style={s.container}>
        <AppHeader title="Perfil" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    )
  }

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
              <Text style={s.userName}>{nombre}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="mail-outline" size={13} color={COLORS.muted} />
                <Text style={s.userEmail}>{email}</Text>
              </View>
              {perfil?.fecha_nacimiento && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="calendar-outline" size={13} color={COLORS.muted} />
                  <Text style={s.userEmail}>{calcularEdad(perfil.fecha_nacimiento)}  •  {formatFecha(perfil.fecha_nacimiento)}</Text>
                </View>
              )}
              {perfil?.sexo && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="male-female-outline" size={13} color={COLORS.muted} />
                  <Text style={s.userEmail}>{perfil.sexo.charAt(0).toUpperCase() + perfil.sexo.slice(1)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Datos personales */}
          <Text style={s.sectionTitle}>Datos personales</Text>
          <View style={s.dataCard}>
            {dataRows.map((row, i) => (
              <View key={i} style={[s.dataRow, i < dataRows.length - 1 && s.dataRowBorder]}>
                <Ionicons name={row.icon} size={18} color={COLORS.muted} />
                <Text style={s.dataLabel}>{row.label}</Text>
                <Text style={s.dataValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* Próximas citas */}
          <Text style={s.sectionTitle}>Próximas citas</Text>
          {citas.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={{ fontSize: 32 }}>📅</Text>
              <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 4 }}>
                No tienes citas programadas.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {citas.map((c) => {
                const [, month, day] = c.fecha.split('-').map(Number)
                const colors = ESTADO_COLORS[c.estado] ?? ESTADO_COLORS.pendiente
                return (
                  <View key={c.id} style={s.citaCard}>
                    <View style={s.citaDateBadge}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.white, opacity: 0.8 }}>
                        {MONTH_SHORT[month - 1]}
                      </Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.white }}>{day}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontWeight: '700', fontSize: 14, color: COLORS.text }}>{c.tipo}</Text>
                        <View style={{ backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>
                            {c.estado}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 }}>
                        🕐 {c.hora}
                      </Text>
                      {c.profesional && (
                        <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 1 }}>{c.profesional}</Text>
                      )}
                      {c.modalidad && (
                        <Text style={{ fontSize: 11, color: COLORS.muted }}>📍 {c.modalidad}</Text>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {/* Membresía actual */}
          <Text style={s.sectionTitle}>Mi membresía actual</Text>
          <View style={s.premiumCard}>
            <View style={s.premiumIcon}>
              <Text style={{ fontSize: 24 }}>{isPremium ? '⭐' : '🌱'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.premiumName}>{isPremium ? 'Plan Premium' : 'Plan Básico'}</Text>
              <View style={s.currentBadge}>
                <Text style={s.currentBadgeText}>Plan actual</Text>
              </View>
            </View>
          </View>

          {/* Otros planes */}
          <Text style={s.sectionTitle}>Otros planes disponibles</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {PLANS.map((plan) => (
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
  dataCard: { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  dataRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dataLabel: { flex: 1, fontSize: 13, color: COLORS.text },
  dataValue: { fontSize: 13, color: COLORS.muted },
  emptyCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 24,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  citaCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: COLORS.white, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  citaDateBadge: {
    width: 50, backgroundColor: COLORS.primary, borderRadius: 10,
    paddingVertical: 6, alignItems: 'center',
  },
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
