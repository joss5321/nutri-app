import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { AppHeader } from '@/components/ui/AppHeader'
import { COLORS } from '@/constants/colors'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import { fetchMiPerfil, updateMiPerfil, type Perfil } from '@/lib/api/perfiles'
import { fetchUltimaMedida, type Medida } from '@/lib/api/medidas'
import { fetchMisCitas, updateEstadoCita, type Cita } from '@/lib/api/citas'

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
  const [refreshing, setRefreshing] = useState(false)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [medida, setMedida] = useState<Medida | null>(null)
  const [citas, setCitas] = useState<Cita[]>([])

  const loadData = useCallback((isRefresh = false) => {
    if (!userId) return
    if (isRefresh) setRefreshing(true); else setLoading(true)
    Promise.all([fetchMiPerfil(userId), fetchUltimaMedida(userId), fetchMisCitas(userId)])
      .then(([p, m, c]) => { setPerfil(p); setMedida(m); setCitas(c) })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [userId])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const handleSignOut = async () => { await supabase.auth.signOut() }

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (result.canceled || !result.assets[0]) return

    try {
      const uri = result.assets[0].uri
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${userId}.${ext}`

      const response = await fetch(uri)
      const blob = await response.blob()
      const arrayBuffer = await new Response(blob).arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { upsert: true, contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}` })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatarUrl = `${publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('perfiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId)
      if (updateError) throw updateError

      setPerfil((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la foto.')
    }
  }

  const nombre = perfil?.nombre_completo ?? user?.user_metadata?.full_name ?? 'Usuario'
  const isPremium = perfil?.plan_membresia === 'premium'

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editNombre, setEditNombre] = useState('')
  const [editFecha, setEditFecha] = useState('')
  const [editSexo, setEditSexo] = useState('')
  const [editAltura, setEditAltura] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const startEdit = () => {
    setEditNombre(perfil?.nombre_completo ?? '')
    setEditFecha(perfil?.fecha_nacimiento ?? '')
    setEditSexo(perfil?.sexo ?? 'femenino')
    setEditAltura(perfil?.altura_cm != null ? String(perfil.altura_cm) : '')
    setEditing(true)
  }

  const handleSaveEdit = async () => {
    setSavingEdit(true)
    try {
      await updateMiPerfil(userId, {
        sexo: editSexo || null,
        fecha_nacimiento: editFecha || null,
        altura_cm: editAltura.trim() ? Number(editAltura) : null,
      })
      await supabase.from('perfiles').update({ nombre_completo: editNombre.trim() || null }).eq('id', userId)
      setPerfil((prev) => prev ? {
        ...prev,
        nombre_completo: editNombre.trim() || null,
        sexo: editSexo || null,
        fecha_nacimiento: editFecha || null,
        altura_cm: editAltura.trim() ? Number(editAltura) : null,
      } : prev)
      setEditing(false)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSavingEdit(false)
    }
  }

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
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[COLORS.primary]} tintColor={COLORS.primary} />}>
        <View style={{ padding: 16, gap: 16, paddingBottom: 32 }}>

          {/* Avatar + info */}
          <View style={s.profileCard}>
            <TouchableOpacity style={s.avatarWrap} onPress={handlePickAvatar} activeOpacity={0.7}>
              {perfil?.avatar_url ? (
                <Image source={{ uri: perfil.avatar_url }} style={s.avatar} />
              ) : (
                <View style={s.avatar}>
                  <Ionicons name="person" size={42} color={COLORS.primary} />
                </View>
              )}
              <View style={s.cameraBtn}>
                <Ionicons name="camera" size={14} color={COLORS.white} />
              </View>
            </TouchableOpacity>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.sectionTitle}>Datos personales</Text>
            {!editing && (
              <TouchableOpacity onPress={startEdit} style={s.editToggle} activeOpacity={0.7}>
                <Ionicons name="pencil-outline" size={14} color={COLORS.primary} />
                <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: '600' }}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <View style={s.dataCard}>
              <View style={[s.editRow, s.dataRowBorder]}>
                <Text style={s.editLabel}>Nombre completo</Text>
                <TextInput value={editNombre} onChangeText={setEditNombre} style={s.editInput} placeholder="Tu nombre" />
              </View>
              <View style={[s.editRow, s.dataRowBorder]}>
                <Text style={s.editLabel}>Fecha de nacimiento</Text>
                <TextInput value={editFecha} onChangeText={setEditFecha} style={s.editInput} placeholder="AAAA-MM-DD" />
              </View>
              <View style={[s.editRow, s.dataRowBorder]}>
                <Text style={s.editLabel}>Sexo</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {['femenino', 'masculino', 'otro'].map((opt) => (
                    <TouchableOpacity key={opt} onPress={() => setEditSexo(opt)}
                      style={[s.sexoChip, editSexo === opt && s.sexoChipActive]} activeOpacity={0.7}>
                      <Text style={[s.sexoChipText, editSexo === opt && s.sexoChipTextActive]}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={s.editRow}>
                <Text style={s.editLabel}>Estatura (cm)</Text>
                <TextInput value={editAltura} onChangeText={setEditAltura} style={s.editInput} placeholder="Ej. 170" keyboardType="numeric" />
              </View>

              <View style={{ flexDirection: 'row', gap: 8, padding: 14 }}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(false)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit} disabled={savingEdit} activeOpacity={0.85}>
                  <Ionicons name="checkmark" size={16} color={COLORS.white} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.white }}>
                    {savingEdit ? 'Guardando...' : 'Guardar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.dataCard}>
              {dataRows.map((row, i) => (
                <View key={i} style={[s.dataRow, i < dataRows.length - 1 && s.dataRowBorder]}>
                  <Ionicons name={row.icon} size={18} color={COLORS.muted} />
                  <Text style={s.dataLabel}>{row.label}</Text>
                  <Text style={s.dataValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          )}

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
                      {c.estado === 'pendiente' && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#D1FAE5', borderRadius: 8, paddingVertical: 7 }}
                            onPress={async () => {
                              await updateEstadoCita(c.id, 'confirmada')
                              setCitas((prev) => prev.map((ci) => ci.id === c.id ? { ...ci, estado: 'confirmada' } : ci))
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="checkmark-circle" size={14} color="#065F46" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#065F46' }}>Confirmar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#FEE2E2', borderRadius: 8, paddingVertical: 7 }}
                            onPress={async () => {
                              await updateEstadoCita(c.id, 'cancelada')
                              setCitas((prev) => prev.map((ci) => ci.id === c.id ? { ...ci, estado: 'cancelada' } : ci))
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="close-circle" size={14} color="#991B1B" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#991B1B' }}>Cancelar</Text>
                          </TouchableOpacity>
                        </View>
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
  editToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  editRow: { padding: 14, gap: 6 },
  editLabel: { fontSize: 12, color: COLORS.muted, fontWeight: '500' },
  editInput: {
    height: 40, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 10, fontSize: 14, color: COLORS.text,
  },
  sexoChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  sexoChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sexoChipText: { fontSize: 12, color: COLORS.text },
  sexoChipTextActive: { color: COLORS.white, fontWeight: '700' },
  cancelBtn: {
    flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtn: {
    flex: 1, height: 44, borderRadius: 10, backgroundColor: COLORS.primary,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
})
