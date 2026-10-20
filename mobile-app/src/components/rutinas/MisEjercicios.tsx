import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { COLORS } from '@/constants/colors'
import {
  fetchMisEjerciciosPersonalizados,
  createEjercicioPersonalizado,
  updateEjercicioPersonalizado,
  deleteEjercicioPersonalizado,
  marcarEjercicioPersonalizadoUsado,
  type EjercicioPersonalizado,
  type EjercicioPersonalizadoInput,
} from '@/lib/api/ejercicios_personalizados'

const EMPTY_FORM: EjercicioPersonalizadoInput = {
  nombre: '',
  grupo_muscular: null,
  series: null,
  repeticiones: null,
  peso_sugerido_kg: null,
  unidad_peso: 'kg',
  descanso_seg: null,
  notas: null,
}

function haceTiempo(iso: string | null): string {
  if (!iso) return 'Nunca'
  const diffMs = Date.now() - new Date(iso).getTime()
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Hace 1 día'
  return `Hace ${dias} días`
}

export function MisEjercicios({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [ejercicios, setEjercicios] = useState<EjercicioPersonalizado[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EjercicioPersonalizado | null>(null)
  const [form, setForm] = useState<EjercicioPersonalizadoInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    if (!userId) return
    setLoading(true)
    fetchMisEjerciciosPersonalizados(userId)
      .then(setEjercicios)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (ej: EjercicioPersonalizado) => {
    setEditing(ej)
    setForm({
      nombre: ej.nombre,
      grupo_muscular: ej.grupo_muscular,
      series: ej.series,
      repeticiones: ej.repeticiones,
      peso_sugerido_kg: ej.peso_sugerido_kg,
      unidad_peso: ej.unidad_peso,
      descanso_seg: ej.descanso_seg,
      notas: ej.notas,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para el ejercicio.')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateEjercicioPersonalizado(editing.id, form)
      } else {
        await createEjercicioPersonalizado(userId, form)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el ejercicio.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (ej: EjercicioPersonalizado) => {
    Alert.alert('Eliminar ejercicio', `¿Eliminar "${ej.nombre}"? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: () => {
          deleteEjercicioPersonalizado(ej.id)
            .then(() => setEjercicios((prev) => prev.filter((e) => e.id !== ej.id)))
            .catch(() => Alert.alert('Error', 'No se pudo eliminar el ejercicio.'))
        },
      },
    ])
  }

  const handleMarcarUsado = (ej: EjercicioPersonalizado) => {
    const ahora = new Date().toISOString()
    setEjercicios((prev) => prev.map((e) => (e.id === ej.id ? { ...e, ultima_vez_usado: ahora } : e)))
    marcarEjercicioPersonalizadoUsado(ej.id).catch(() => load())
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={s.infoBanner}>
        <Ionicons name="person-outline" size={22} color={COLORS.primary} />
        <Text style={{ flex: 1, fontSize: 13, color: COLORS.text }}>
          Ejercicios que tú creas, solo visibles para ti.
        </Text>
      </View>

      <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.85}>
        <Ionicons name="add-circle" size={20} color={COLORS.white} />
        <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>Agregar ejercicio</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : ejercicios.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 }}>
          <View style={s.emptyIcon}>
            <Ionicons name="barbell-outline" size={28} color={COLORS.primary} />
          </View>
          <Text style={{ fontWeight: '700', fontSize: 15, color: COLORS.text, textAlign: 'center', marginTop: 14 }}>
            Aún no agregaste ningún ejercicio propio
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
            Usa el botón &quot;+ Agregar ejercicio&quot; para crear el primero.
          </Text>
        </View>
      ) : (
        ejercicios.map((ej) => (
          <View key={ej.id} style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{ej.nombre}</Text>
                {ej.grupo_muscular && <Text style={s.cardMeta}>{ej.grupo_muscular}</Text>}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => openEdit(ej)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="pencil" size={18} color={COLORS.muted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(ej)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash" size={18} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.tagsRow}>
              {ej.series != null && <View style={s.tag}><Text style={s.tagText}>{ej.series} series</Text></View>}
              {ej.repeticiones && <View style={s.tag}><Text style={s.tagText}>{ej.repeticiones}</Text></View>}
              {ej.peso_sugerido_kg != null && (
                <View style={[s.tag, { backgroundColor: COLORS.completed }]}>
                  <Text style={[s.tagText, { color: COLORS.completedText }]}>{ej.peso_sugerido_kg} {ej.unidad_peso}</Text>
                </View>
              )}
              {ej.descanso_seg != null && <View style={s.tag}><Text style={s.tagText}>⏱ {ej.descanso_seg}s</Text></View>}
            </View>

            {ej.notas && <Text style={s.notas}>{ej.notas}</Text>}

            <View style={s.cardFooter}>
              <Text style={{ fontSize: 11, color: COLORS.muted }}>Último uso: {haceTiempo(ej.ultima_vez_usado)}</Text>
              <TouchableOpacity style={s.usarBtn} onPress={() => handleMarcarUsado(ej)} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.primary }}>Marcar como hecho</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <View style={m.header}>
            <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={m.headerTitle}>{editing ? 'Editar ejercicio' : 'Nuevo ejercicio'}</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={m.label}>Nombre *</Text>
              <TextInput style={m.input} value={form.nombre} onChangeText={(v) => setForm((f) => ({ ...f, nombre: v }))}
                placeholder="Ej. Curl de bíceps" placeholderTextColor={COLORS.muted} />
            </View>
            <View>
              <Text style={m.label}>Grupo muscular</Text>
              <TextInput style={m.input} value={form.grupo_muscular ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, grupo_muscular: v || null }))}
                placeholder="Ej. Brazos" placeholderTextColor={COLORS.muted} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={m.label}>Series</Text>
                <TextInput style={m.input} value={form.series != null ? String(form.series) : ''} keyboardType="numeric"
                  onChangeText={(v) => setForm((f) => ({ ...f, series: v ? parseInt(v, 10) : null }))}
                  placeholder="4" placeholderTextColor={COLORS.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={m.label}>Repeticiones</Text>
                <TextInput style={m.input} value={form.repeticiones ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, repeticiones: v || null }))}
                  placeholder="10-12" placeholderTextColor={COLORS.muted} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={m.label}>Peso sugerido</Text>
                <TextInput style={m.input} value={form.peso_sugerido_kg != null ? String(form.peso_sugerido_kg) : ''} keyboardType="numeric"
                  onChangeText={(v) => setForm((f) => ({ ...f, peso_sugerido_kg: v ? parseFloat(v) : null }))}
                  placeholder="20" placeholderTextColor={COLORS.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={m.label}>Descanso (seg)</Text>
                <TextInput style={m.input} value={form.descanso_seg != null ? String(form.descanso_seg) : ''} keyboardType="numeric"
                  onChangeText={(v) => setForm((f) => ({ ...f, descanso_seg: v ? parseInt(v, 10) : null }))}
                  placeholder="60" placeholderTextColor={COLORS.muted} />
              </View>
            </View>
            <View>
              <Text style={m.label}>Notas</Text>
              <TextInput style={[m.input, { height: 80, textAlignVertical: 'top' }]} value={form.notas ?? ''}
                onChangeText={(v) => setForm((f) => ({ ...f, notas: v || null }))} multiline
                placeholder="Opcional" placeholderTextColor={COLORS.muted} />
            </View>

            <TouchableOpacity style={[s.addBtn, { marginTop: 8 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              <Ionicons name="save-outline" size={18} color={COLORS.white} />
              <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  infoBanner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#C8EDE3',
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 16, height: 48,
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 16, gap: 10,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardName: { fontWeight: '700', fontSize: 15, color: COLORS.text },
  cardMeta: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#F1F5F9' },
  tagText: { fontSize: 11, color: '#374151', fontWeight: '600' },
  notas: { fontSize: 12, color: COLORS.muted, fontStyle: 'italic' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 2,
  },
  usarBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
})

const m = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  headerTitle: { fontWeight: '700', fontSize: 16, color: COLORS.text },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: {
    height: 48, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.white,
  },
})
