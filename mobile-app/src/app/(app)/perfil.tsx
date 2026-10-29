import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { AppHeader } from '@/components/ui/AppHeader'
import { RetryError } from '@/components/ui/RetryError'
import { COLORS } from '@/constants/colors'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import { fetchMiPerfil, updateMiPerfil, type Perfil } from '@/lib/api/perfiles'
import { fetchUltimaMedida, type Medida } from '@/lib/api/medidas'
import { fetchMisCitas, updateEstadoCita, type Cita } from '@/lib/api/citas'
import * as WebBrowser from 'expo-web-browser'
import { crearPortalSesion } from '@/lib/api/pagos'
import { getPaqueteParaPlan, comprarPaquete, getUrlGestionSuscripcion } from '@/lib/revenuecat'
import { type PlanKey } from '@/constants/planes'
import { hasActiveSubscription, hasNutritionist } from '@/lib/permissions'
import { cambiarNutriologo, type Nutricionista } from '@/lib/api/nutricionistas'
import { NutriologoPickerModal } from '@/components/ui/NutriologoPickerModal'
import { PRIVACY_POLICY_URL } from '@/constants/legal'

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
    key: 'basico' as const, icon: 'leaf-outline' as const, name: 'Plan Básico', price: '$199 MXN', period: 'al mes',
    features: ['Recetas saludables', 'Plan semanal básico', 'Recordatorio de agua', 'Soporte por email'],
  },
  {
    key: 'pro' as const, icon: 'ribbon-outline' as const, name: 'Plan Pro', price: '$349 MXN', period: 'al mes',
    features: ['Todo lo del plan Básico', 'Planes personalizados', 'Seguimiento de progreso', 'Soporte prioritario'],
  },
  {
    key: 'premium' as const, icon: 'diamond-outline' as const, name: 'Plan Premium', price: '$599 MXN', period: 'al mes',
    features: ['Todo lo del plan Pro', 'Consultas 1:1 con nutriólogo', 'Ajustes ilimitados de plan', 'Soporte 24/7'],
  },
]

export default function PerfilScreen() {
  const { user } = useAuthStore()
  const userId = user?.id ?? ''
  const email = user?.email ?? '—'

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [payingPlan, setPayingPlan] = useState<string | null>(null)

  const handleElegirPlan = async (planKey: PlanKey) => {
    if (!userId || planKey === 'basico') return

    // El guard de "no abrir un segundo checkout" solo aplica a
    // suscriptores legados de Stripe: StoreKit/Play Billing ya manejan
    // upgrade/downgrade con prorateo dentro del mismo grupo de
    // suscripción, así que comprar otro plan es una compra legítima, no
    // una segunda suscripción en paralelo.
    if (perfil?.stripe_customer_id && hasActiveSubscription(perfil) && perfil.plan_membresia !== planKey) {
      Alert.alert(
        'Ya tienes una suscripción activa',
        'Para cambiar de plan, gestiona tu suscripción actual en vez de contratar una nueva.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Gestionar suscripción', onPress: handleGestionarSuscripcion },
        ],
      )
      return
    }

    setPayingPlan(planKey)
    try {
      const pkg = await getPaqueteParaPlan(planKey)
      if (!pkg) {
        Alert.alert('No disponible', 'Este plan todavía no está disponible para comprar. Intenta más tarde.')
        return
      }
      await comprarPaquete(pkg)
      confirmarSuscripcion()
    } catch (err) {
      // RevenueCat marca con userCancelled=true cuando el usuario cierra
      // la hoja de compra nativa por su cuenta — no es un error real.
      const cancelado = typeof err === 'object' && err !== null && (err as { userCancelled?: boolean }).userCancelled === true
      if (!cancelado) {
        Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo procesar la compra.')
      }
    } finally {
      setPayingPlan(null)
    }
  }


  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [medida, setMedida] = useState<Medida | null>(null)
  const [citas, setCitas] = useState<Cita[]>([])
  const [updatingCitaId, setUpdatingCitaId] = useState<string | null>(null)

  const handleUpdateEstadoCita = async (citaId: string, estado: 'confirmada' | 'cancelada') => {
    setUpdatingCitaId(citaId)
    try {
      await updateEstadoCita(citaId, estado)
      setCitas((prev) => prev.map((ci) => ci.id === citaId ? { ...ci, estado } : ci))
      Alert.alert('Listo', estado === 'confirmada' ? 'Cita confirmada.' : 'Cita cancelada.')
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar la cita.')
    } finally {
      setUpdatingCitaId(null)
    }
  }

  const loadData = useCallback((isRefresh = false) => {
    if (!userId) return
    if (isRefresh) setRefreshing(true); else setLoading(true)
    setLoadError(null)
    Promise.all([fetchMiPerfil(userId), fetchUltimaMedida(userId), fetchMisCitas(userId)])
      .then(([p, m, c]) => { setPerfil(p); setMedida(m); setCitas(c) })
      .catch(() => setLoadError('No se pudo cargar tu perfil.'))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [userId])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  // Confirma una suscripción recién iniciada (Stripe Checkout o compra
  // nativa vía RevenueCat) consultando el perfil real — NUNCA se asume
  // pagado solo porque el navegador se cerró o la compra nativa resolvió
  // del lado del cliente: en ambos casos el webhook correspondiente
  // (stripe-webhook / revenuecat-webhook) todavía puede no haber llegado,
  // así que se reintenta un par de veces en corto antes de desistir.
  const [verificandoPago, setVerificandoPago] = useState(false)

  const confirmarSuscripcion = useCallback(() => {
    if (!userId) return
    setVerificandoPago(true)
    let intentos = 0
    const intentar = () => {
      intentos++
      fetchMiPerfil(userId)
        .then((p) => {
          if (p) setPerfil(p)
          if (p && hasActiveSubscription(p)) {
            setVerificandoPago(false)
          } else if (intentos < 3) {
            setTimeout(intentar, intentos === 1 ? 2000 : 3000)
          } else {
            setVerificandoPago(false)
          }
        })
        .catch(() => setVerificandoPago(false))
    }
    intentar()
  }, [userId])

  // Regreso de Stripe Checkout (mobileapp://perfil?payment=success|cancel,
  // configurado en crear-checkout — solo aplica a suscriptores legados de
  // Stripe; la compra nativa vía RevenueCat llama confirmarSuscripcion()
  // directo desde handleElegirPlan, sin pasar por un deep link). "cancel"
  // no necesita hacer nada especial (el usuario simplemente sigue sin
  // suscripción).
  const { payment } = useLocalSearchParams<{ payment?: string }>()
  const pagoVerificadoRef = useRef(false)

  useEffect(() => {
    if (payment !== 'success' || pagoVerificadoRef.current || !userId) return
    pagoVerificadoRef.current = true
    confirmarSuscripcion()
  }, [payment, userId, confirmarSuscripcion])

  const [payingPortal, setPayingPortal] = useState(false)
  const handleGestionarSuscripcion = async () => {
    setPayingPortal(true)
    try {
      // Suscriptores legados de Stripe: Customer Portal, como siempre.
      // Suscriptores vía RevenueCat: no hay portal propio — se abre la
      // pantalla nativa de gestión de suscripciones del sistema.
      if (perfil?.stripe_customer_id) {
        const { url } = await crearPortalSesion()
        await WebBrowser.openBrowserAsync(url, {
          dismissButtonStyle: 'close',
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        })
      } else {
        const url = await getUrlGestionSuscripcion()
        if (!url) {
          Alert.alert('Sin suscripción', 'No tienes una suscripción activa para gestionar.')
          return
        }
        await Linking.openURL(url)
      }
      loadData(true)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo abrir la gestión de tu suscripción.')
    } finally {
      setPayingPortal(false)
    }
  }

  const [showNutriologoPicker, setShowNutriologoPicker] = useState(false)
  const [cambiandoNutriologo, setCambiandoNutriologo] = useState(false)

  const handleSeleccionarNutriologo = async (n: Nutricionista) => {
    setCambiandoNutriologo(true)
    try {
      await cambiarNutriologo(n.id)
      setShowNutriologoPicker(false)
      await loadData(true)
      Alert.alert('Listo', `Ahora tu nutriólogo es ${n.nombre_completo ?? 'el seleccionado'}.`)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo cambiar de nutriólogo.')
    } finally {
      setCambiandoNutriologo(false)
    }
  }

  const handleSignOut = async () => { await supabase.auth.signOut() }

  const handleAbrirPoliticaPrivacidad = async () => {
    await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL, {
      dismissButtonStyle: 'close',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
    })
  }

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
  const planActual = PLANS.find((p) => p.key === perfil?.plan_membresia) ?? PLANS[0]

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

  if (loadError) {
    return (
      <View style={s.container}>
        <AppHeader title="Perfil" />
        <RetryError message={loadError} onRetry={() => loadData()} />
      </View>
    )
  }

  return (
    <View style={s.container}>
      <AppHeader title="Perfil" />
      <ScrollView style={s.wideScroll} showsVerticalScrollIndicator={false}
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

          {/* Mi nutriólogo */}
          <Text style={s.sectionTitle}>Mi nutriólogo</Text>
          <TouchableOpacity style={s.nutriologoBtn} onPress={() => setShowNutriologoPicker(true)} activeOpacity={0.8}>
            <Ionicons name="people-outline" size={18} color={COLORS.primary} />
            <Text style={s.nutriologoBtnText}>
              {hasNutritionist(perfil) ? 'Cambiar nutriólogo' : 'Elegir nutriólogo'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
          </TouchableOpacity>

          {/* Próximas citas */}
          <Text style={s.sectionTitle}>Próximas citas</Text>
          {citas.length === 0 ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIcon}>
                <Ionicons name="calendar-outline" size={26} color={COLORS.primary} />
              </View>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Ionicons name="time-outline" size={12} color={COLORS.primary} />
                        <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: '600' }}>{c.hora}</Text>
                      </View>
                      {c.profesional && (
                        <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 1 }}>{c.profesional}</Text>
                      )}
                      {c.modalidad && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="location-outline" size={11} color={COLORS.muted} />
                          <Text style={{ fontSize: 11, color: COLORS.muted }}>{c.modalidad}</Text>
                        </View>
                      )}
                      {c.estado === 'pendiente' && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#D1FAE5', borderRadius: 8, paddingVertical: 7 }}
                            onPress={() => handleUpdateEstadoCita(c.id, 'confirmada')}
                            disabled={updatingCitaId === c.id}
                            activeOpacity={0.7}
                          >
                            {updatingCitaId === c.id ? (
                              <ActivityIndicator size="small" color="#065F46" />
                            ) : (
                              <>
                                <Ionicons name="checkmark-circle" size={14} color="#065F46" />
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#065F46' }}>Confirmar</Text>
                              </>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#FEE2E2', borderRadius: 8, paddingVertical: 7 }}
                            onPress={() => handleUpdateEstadoCita(c.id, 'cancelada')}
                            disabled={updatingCitaId === c.id}
                            activeOpacity={0.7}
                          >
                            {updatingCitaId === c.id ? (
                              <ActivityIndicator size="small" color="#991B1B" />
                            ) : (
                              <>
                                <Ionicons name="close-circle" size={14} color="#991B1B" />
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#991B1B' }}>Cancelar</Text>
                              </>
                            )}
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
          {verificandoPago && (
            <View style={s.verifyingBanner}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={s.verifyingText}>Confirmando tu pago…</Text>
            </View>
          )}
          <View style={s.premiumCard}>
            <View style={s.premiumIcon}>
              <Ionicons name={planActual.icon} size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.premiumName}>{planActual.name}</Text>
              <View style={s.currentBadge}>
                <Text style={s.currentBadgeText}>Plan actual</Text>
              </View>
            </View>
          </View>

          {hasActiveSubscription(perfil) && (
            <TouchableOpacity style={s.portalBtn} onPress={handleGestionarSuscripcion} disabled={payingPortal} activeOpacity={0.8}>
              {payingPortal ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="card-outline" size={16} color={COLORS.primary} />
                  <Text style={s.portalBtnText}>Gestionar suscripción</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Otros planes */}
          <Text style={s.sectionTitle}>Otros planes disponibles</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {PLANS.map((plan) => (
              <View key={plan.key} style={[s.planCard, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name={plan.icon} size={18} color={COLORS.primary} />
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
                <TouchableOpacity
                  style={s.planBtn}
                  onPress={() => handleElegirPlan(plan.key)}
                  disabled={payingPlan === plan.key || perfil?.plan_membresia === plan.key}
                >
                  {payingPlan === plan.key ? (
                    <ActivityIndicator size="small" color={COLORS.text} />
                  ) : (
                    <Text style={s.planBtnText}>
                      {perfil?.plan_membresia === plan.key
                        ? 'Plan actual'
                        : hasActiveSubscription(perfil) ? 'Cambiar a este plan' : 'Elegir plan'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Política de privacidad */}
          <TouchableOpacity style={s.privacyBtn} onPress={handleAbrirPoliticaPrivacidad}>
            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.muted} />
            <Text style={s.privacyText}>Política de privacidad</Text>
          </TouchableOpacity>

          {/* Cerrar sesión */}
          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={s.signOutText}>Cerrar sesión</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>

      <NutriologoPickerModal
        visible={showNutriologoPicker}
        onClose={() => setShowNutriologoPicker(false)}
        onSeleccionar={handleSeleccionarNutriologo}
        currentNutricionistaId={perfil?.nutricionista_id}
        guardando={cambiandoNutriologo}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  wideScroll: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, letterSpacing: -0.2 },

  nutriologoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  nutriologoBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },

  // ── Avatar / profile card ──
  profileCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.border,
  },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.primary, width: 24, height: 24,
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  userName: { fontSize: 16, fontWeight: '700', color: COLORS.text, letterSpacing: -0.2 },
  userEmail: { fontSize: 12, color: COLORS.muted },

  // ── Datos personales ──
  dataCard: {
    backgroundColor: COLORS.white, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  dataRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dataLabel: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '500' },
  dataValue: { fontSize: 13, color: COLORS.muted },

  // ── Empty / citas ──
  emptyCard: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 28,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  citaCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: COLORS.white, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  citaDateBadge: {
    width: 52, backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 8, alignItems: 'center',
  },

  // ── Membresía ──
  verifyingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 10,
  },
  verifyingText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  portalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, height: 46,
    backgroundColor: COLORS.white,
  },
  portalBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  premiumCard: {
    flexDirection: 'row', gap: 14, alignItems: 'flex-start',
    backgroundColor: COLORS.white, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  premiumIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  premiumName: { fontWeight: '700', fontSize: 16, color: COLORS.text, letterSpacing: -0.2 },
  currentBadge: {
    backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start', marginTop: 5,
  },
  currentBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },

  // ── Plan cards ──
  planCard: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  planName: { fontWeight: '700', fontSize: 13, color: COLORS.text },
  planPrice: { fontWeight: '800', fontSize: 17, color: COLORS.text, marginTop: 6, letterSpacing: -0.5 },
  planBtn: {
    marginTop: 12, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingVertical: 9, alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  planBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.text },

  // ── Política de privacidad ──
  privacyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
    borderRadius: 16, padding: 14, marginTop: 8,
  },
  privacyText: { color: COLORS.muted, fontWeight: '600', fontSize: 15 },

  // ── Sign out ──
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFF5F5',
    borderRadius: 16, padding: 14, marginTop: 8,
  },
  signOutText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },

  // ── Edit mode ──
  editToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: COLORS.white,
  },
  editRow: { padding: 14, gap: 6 },
  editLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  editInput: {
    height: 44, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 12, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  sexoChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  sexoChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sexoChipText: { fontSize: 12, fontWeight: '500', color: COLORS.muted },
  sexoChipTextActive: { color: COLORS.white, fontWeight: '700' },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background,
  },
  saveBtn: {
    flex: 1, height: 48, borderRadius: 14, backgroundColor: COLORS.primary,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    shadowColor: COLORS.primary, shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
})
