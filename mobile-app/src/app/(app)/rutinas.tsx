import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, Linking, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { COLORS } from '@/constants/colors'
import { useAuthStore } from '@/store/auth'
import { fetchMiRutina, type RutinaCompleta, type SerieDetalle } from '@/lib/api/rutinas'
import { fetchEjercicioLogs, fetchAllEjercicioLogs, createEjercicioLog, type EjercicioLog } from '@/lib/api/ejercicio_logs'

// ─── Tipos ───────────────────────────────────────────────────────────────────
type DayStatus = 'completado' | 'pendiente' | 'descanso'
interface Exercise {
  id: string; ejercicio_id: string; name: string; emoji: string
  series: string; series_count: number; reps: string; weight?: string; rest: string
  rir?: string; rpe?: string
  grupo_muscular?: string; grupos_secundarios?: string[]
  descripcion?: string; video_url?: string
  series_detalle: SerieDetalle[] | null
}
interface Day {
  num: number; name: string; status: DayStatus; isRest: boolean; exercises: Exercise[]
}

function mapRutinaToDays(rutina: RutinaCompleta): Day[] {
  return rutina.rutina_dias.map((dia) => ({
    num: dia.numero_dia,
    name: dia.nombre_dia,
    status: dia.es_descanso ? 'descanso' : 'pendiente',
    isRest: dia.es_descanso,
    exercises: dia.rutina_ejercicios.map((ej) => ({
      id: ej.id,
      ejercicio_id: ej.ejercicio_id,
      name: ej.ejercicios?.nombre ?? 'Ejercicio',
      emoji: ej.ejercicios?.emoji ?? '🏋️',
      series: ej.series != null ? `${ej.series} series` : '',
      series_count: ej.series ?? 0,
      reps: ej.repeticiones ?? '',
      weight: ej.peso_sugerido_kg != null ? `${ej.peso_sugerido_kg} kg` : undefined,
      rest: ej.descanso_seg != null ? `${ej.descanso_seg} s` : '60 s',
      rir: ej.rir != null ? String(ej.rir) : undefined,
      rpe: ej.rpe != null ? String(ej.rpe) : undefined,
      series_detalle: ej.series_detalle ?? null,
      grupo_muscular: ej.ejercicios?.grupo_muscular ?? undefined,
      grupos_secundarios: ej.ejercicios?.grupos_secundarios ?? undefined,
      descripcion: ej.ejercicios?.descripcion ?? undefined,
      video_url: ej.ejercicios?.video_url ?? undefined,
    })),
  }))
}

type ProgressExercise = {
  ejercicio_id: string
  name: string
  emoji: string
  reps: string
  actual: string
  best: string
  history: { peso: number; fecha: string }[]
}

function buildProgressList(days: Day[], allLogs: EjercicioLog[]): ProgressExercise[] {
  const seen = new Set<string>()
  return days
    .filter((d) => !d.isRest)
    .flatMap((d) => d.exercises)
    .filter((ex) => { if (seen.has(ex.ejercicio_id)) return false; seen.add(ex.ejercicio_id); return true })
    .map((ex) => {
      const logs = allLogs.filter((l) => l.ejercicio_id === ex.ejercicio_id)
      const best = logs.length > 0 ? Math.max(...logs.map((l) => l.peso_kg)) : null
      return {
        ejercicio_id: ex.ejercicio_id,
        name: ex.name,
        emoji: ex.emoji,
        reps: `${ex.reps} • ${ex.series}`,
        actual: ex.weight ?? 'PC',
        best: best != null ? `${best} kg` : ex.weight ?? '—',
        history: logs.slice(-8).map((l) => ({ peso: l.peso_kg, fecha: l.fecha })),
      }
    })
}

// ─── YouTube helper ──────────────────────────────────────────────────────────
function getYouTubeEmbedId(url: string): string | null {
  const patterns = [
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  ]
  for (const re of patterns) {
    const match = url.match(re)
    if (match) return match[1]
  }
  return null
}

function isYouTubeShort(url: string): boolean {
  return /youtube\.com\/shorts\//.test(url)
}

// ─── Modal de detalle del ejercicio ─────────────────────────────────────────
function ExerciseDetailModal({ exercise, userId, onClose }: { exercise: Exercise; userId: string; onClose: () => void }) {
  const ytId = exercise.video_url ? getYouTubeEmbedId(exercise.video_url) : null
  const isShort = exercise.video_url ? isYouTubeShort(exercise.video_url) : false

  const [savingPeso, setSavingPeso] = useState(false)
  const [logs, setLogs] = useState<EjercicioLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  // Build series rows from series_detalle or fallback
  const seriesRows: SerieDetalle[] = exercise.series_detalle?.length
    ? exercise.series_detalle
    : Array.from({ length: Math.max(exercise.series_count, 1) }, () => ({
        reps: exercise.reps || null,
        peso: null,
      }))

  const [serieInputs, setSerieInputs] = useState<string[]>(
    seriesRows.map((s) => (s.peso != null ? String(s.peso) : ''))
  )

  useEffect(() => {
    fetchEjercicioLogs(userId, exercise.ejercicio_id)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoadingLogs(false))
  }, [userId, exercise.ejercicio_id])

  const handleSaveSeries = async () => {
    const entries = serieInputs
      .map((v, i) => ({ serie: i + 1, peso: parseFloat(v) }))
      .filter((e) => e.peso > 0)
    if (entries.length === 0) {
      Alert.alert('Error', 'Ingresa al menos un peso válido mayor a 0.')
      return
    }
    setSavingPeso(true)
    try {
      await Promise.all(entries.map((e) => createEjercicioLog(userId, exercise.ejercicio_id, e.peso)))
      const updated = await fetchEjercicioLogs(userId, exercise.ejercicio_id)
      setLogs(updated)
      Alert.alert('Registrado', `${entries.length} serie${entries.length > 1 ? 's' : ''} guardada${entries.length > 1 ? 's' : ''} correctamente.`)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally { setSavingPeso(false) }
  }

  const bestWeight = logs.length > 0 ? Math.max(...logs.map((l) => l.peso_kg)) : null

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {/* Header */}
        <View style={ed.header}>
          <TouchableOpacity style={ed.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={ed.headerTitle} numberOfLines={1}>{exercise.name}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Video / placeholder */}
          {ytId ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => Linking.openURL(exercise.video_url!)}
              style={{ height: isShort ? 320 : 220, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}
            >
              <Image
                source={{ uri: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
                style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.6 }}
                resizeMode="cover"
              />
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,0,0,0.9)', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}>
                <Ionicons name="logo-youtube" size={32} color="#fff" />
              </View>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 10 }}>Ver video en YouTube</Text>
            </TouchableOpacity>
          ) : (
            <View style={ed.noVideo}>
              <Text style={{ fontSize: 48 }}>{exercise.emoji}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 13, marginTop: 8 }}>
                Aún no se ha cargado video
              </Text>
            </View>
          )}

          <View style={{ padding: 20, gap: 16 }}>
            {/* Nombre + emoji */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={ed.emojiBox}>
                <Text style={{ fontSize: 28 }}>{exercise.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontSize: 18, color: COLORS.text }}>{exercise.name}</Text>
                {exercise.grupo_muscular && (
                  <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 }}>
                    {exercise.grupo_muscular}
                  </Text>
                )}
              </View>
            </View>

            {/* Grupos secundarios */}
            {exercise.grupos_secundarios && exercise.grupos_secundarios.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {exercise.grupos_secundarios.map((g) => (
                  <View key={g} style={ed.secBadge}>
                    <Text style={ed.secBadgeText}>{g}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Detalles generales */}
            <View style={ed.detailCard}>
              <Text style={ed.detailTitle}>Detalles del ejercicio</Text>
              <View style={ed.detailGrid}>
                {[
                  { label: 'Series', value: exercise.series || '—', icon: '🔁' },
                  { label: 'Descanso', value: exercise.rest || '—', icon: '⏱' },
                  ...(exercise.rir ? [{ label: 'RIR', value: exercise.rir, icon: '💪' }] : []),
                  ...(exercise.rpe ? [{ label: 'RPE', value: exercise.rpe, icon: '⚡' }] : []),
                ].map((d) => (
                  <View key={d.label} style={ed.detailItem}>
                    <Text style={{ fontSize: 18 }}>{d.icon}</Text>
                    <Text style={ed.detailValue}>{d.value}</Text>
                    <Text style={ed.detailLabel}>{d.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Series con reps, peso plan y registro */}
            <View style={ed.detailCard}>
              <Text style={ed.detailTitle}>Series — registrar peso de hoy</Text>
              {/* Cabecera */}
              <View style={ed.serieHeader}>
                <Text style={[ed.serieHeaderCell, { flex: 0.6 }]}>Serie</Text>
                <Text style={ed.serieHeaderCell}>Reps</Text>
                <Text style={ed.serieHeaderCell}>Plan (kg)</Text>
                <Text style={ed.serieHeaderCell}>Tu peso</Text>
              </View>
              {seriesRows.map((sr, i) => (
                <View key={i} style={[ed.serieRow, i % 2 === 0 && { backgroundColor: '#F9FAFB' }]}>
                  <View style={[ed.serieCell, { flex: 0.6, alignItems: 'center' }]}>
                    <View style={ed.serieBadge}>
                      <Text style={ed.serieBadgeText}>S{i + 1}</Text>
                    </View>
                  </View>
                  <Text style={ed.serieCell}>{sr.reps ?? '—'}</Text>
                  <Text style={ed.serieCell}>{sr.peso != null ? `${sr.peso}` : '—'}</Text>
                  <View style={{ flex: 1, paddingHorizontal: 4 }}>
                    <TextInput
                      value={serieInputs[i]}
                      onChangeText={(v) => setSerieInputs((prev) => prev.map((x, j) => (j === i ? v : x)))}
                      keyboardType="numeric"
                      placeholder="—"
                      placeholderTextColor={COLORS.muted}
                      style={ed.serieInput}
                    />
                  </View>
                </View>
              ))}
              {bestWeight != null && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                  <Text style={{ fontSize: 12, color: COLORS.muted }}>Mejor peso registrado</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.primary }}>{bestWeight} kg 🏆</Text>
                </View>
              )}
              <TouchableOpacity onPress={handleSaveSeries} disabled={savingPeso} activeOpacity={0.85}
                style={{ height: 44, borderRadius: 10, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 12 }}>
                <Ionicons name="save-outline" size={16} color={COLORS.white} />
                <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>
                  {savingPeso ? 'Guardando...' : 'Guardar series'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Historial de pesos */}
            <View style={ed.detailCard}>
              <Text style={ed.detailTitle}>Historial de pesos</Text>
              {loadingLogs ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : logs.length === 0 ? (
                <Text style={{ fontSize: 12, color: COLORS.muted, textAlign: 'center', paddingVertical: 12 }}>
                  Aún no hay registros. Guarda tus primeras series arriba.
                </Text>
              ) : (
                <View style={{ gap: 0 }}>
                  {[...logs].reverse().map((log) => {
                    const [y, m, d] = log.fecha.split('-').map(Number)
                    const isBest = log.peso_kg === bestWeight
                    return (
                      <View key={log.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                        <Text style={{ fontSize: 13, color: COLORS.muted }}>{d}/{m}/{y}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: isBest ? COLORS.primary : COLORS.text }}>{log.peso_kg} kg</Text>
                          {isBest && <Text style={{ fontSize: 10 }}>🏆</Text>}
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>

            {/* Descripción */}
            {exercise.descripcion && (
              <View style={ed.descCard}>
                <Text style={{ fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>📋 Descripción</Text>
                <Text style={{ fontSize: 14, color: COLORS.text, lineHeight: 22 }}>{exercise.descripcion}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const ed = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16, color: COLORS.text },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  noVideo: {
    height: 180, backgroundColor: COLORS.cardBg, justifyContent: 'center', alignItems: 'center',
  },
  emojiBox: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: COLORS.cardBg,
    justifyContent: 'center', alignItems: 'center',
  },
  secBadge: {
    backgroundColor: COLORS.cardBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  secBadgeText: { fontSize: 12, color: COLORS.muted, fontWeight: '500' },
  detailCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  detailTitle: { fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailItem: {
    width: '30%', backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 10, alignItems: 'center', gap: 2,
  },
  detailValue: { fontWeight: '800', fontSize: 14, color: COLORS.text },
  detailLabel: { fontSize: 10, color: COLORS.muted },
  descCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  serieHeader: {
    flexDirection: 'row', backgroundColor: '#F0FAF5',
    paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, marginBottom: 4,
  },
  serieHeaderCell: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.primary },
  serieRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderRadius: 6 },
  serieCell: { flex: 1, textAlign: 'center', fontSize: 13, color: COLORS.text },
  serieBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  serieBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  serieInput: {
    height: 36, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 8, fontSize: 14, color: COLORS.text,
    textAlign: 'center',
  },
})

// ─── Progress bar ────────────────────────────────────────────────────────────
function WeekProgressBar({ days }: { days: Day[] }) {
  const workoutDays = days.filter((d) => !d.isRest)
  const completedCnt = workoutDays.filter((d) => d.status === 'completado').length
  const total = workoutDays.length
  const pct = total === 0 ? 0 : completedCnt / total

  return (
    <View style={pb.wrapper}>
      <View style={pb.topRow}>
        <Text style={pb.label}>Progreso de la semana</Text>
        <Text style={pb.fraction}>
          <Text style={pb.fractionBold}>{completedCnt}</Text>/{total} días
        </Text>
      </View>
      <View style={pb.track}>
        <View style={[pb.fill, { width: `${pct * 100}%` }]} />
      </View>
      <View style={pb.daysRow}>
        {days.map((d) => (
          <View key={d.num} style={pb.dayDot}>
            <View style={[pb.dot, d.isRest && pb.dotRest, d.status === 'completado' && pb.dotDone]} />
            <Text style={pb.dayLetter}>{d.name.charAt(0)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ─── Tarjeta de ejercicio ────────────────────────────────────────────────────
function ExerciseCard({ ex, index, onPress }: { ex: Exercise; index: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.exerciseCard} onPress={onPress} activeOpacity={0.7}>
      <View style={s.exerciseImg}>
        <Text style={{ fontSize: 26 }}>{ex.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <View style={s.numBadge}><Text style={s.numBadgeText}>{index + 1}</Text></View>
          <Text style={s.exName} numberOfLines={1}>{ex.name}</Text>
        </View>
        <View style={s.exTagsRow}>
          {ex.series ? <View style={s.exTag}><Text style={s.exTagText}>{ex.series}</Text></View> : null}
          {ex.reps ? <View style={s.exTag}><Text style={s.exTagText}>{ex.reps}</Text></View> : null}
          {ex.weight && <View style={[s.exTag, s.exTagWeight]}><Text style={[s.exTagText, { color: COLORS.primary }]}>{ex.weight}</Text></View>}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 3 }}>
          <Text style={s.exMeta}>⏱ {ex.rest}</Text>
          {ex.rir && <Text style={s.exMeta}>RIR {ex.rir}</Text>}
          {ex.rpe && <Text style={s.exMeta}>RPE {ex.rpe}</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
    </TouchableOpacity>
  )
}

// ─── Pantalla principal ─────────────────────────────────────────────────────
export default function RutinasScreen() {
  const { user } = useAuthStore()
  const userId = user?.id ?? ''

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rutinaNombre, setRutinaNombre] = useState('')
  const [activeTab, setActiveTab] = useState<'rutinas' | 'progreso'>('rutinas')
  const [days, setDays] = useState<Day[]>([])
  const [expanded, setExpanded] = useState<number[]>([])
  const [allExercises, setAllExercises] = useState<ProgressExercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)

  const loadData = useCallback((isRefresh = false) => {
    if (!userId) return
    if (isRefresh) setRefreshing(true); else setLoading(true)
    Promise.all([fetchMiRutina(userId), fetchAllEjercicioLogs(userId)])
      .then(([rutina, logs]) => {
        if (rutina) {
          const mapped = mapRutinaToDays(rutina)
          setDays(mapped)
          setRutinaNombre(rutina.nombre)
          setAllExercises(buildProgressList(mapped, logs))
          const firstWorkout = mapped.find((d) => !d.isRest)
          if (firstWorkout) setExpanded([firstWorkout.num])
        } else {
          setDays([])
          setAllExercises([])
        }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [userId])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const toggleDay = (num: number) =>
    setExpanded((prev) => prev.includes(num) ? prev.filter((d) => d !== num) : [...prev, num])

  const markComplete = (dayNum: number) =>
    setDays((prev) => prev.map((d) => d.num === dayNum ? { ...d, status: 'completado' } : d))

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerContent}>
          <TouchableOpacity><Ionicons name="menu" size={26} color={COLORS.white} /></TouchableOpacity>
          <Text style={s.headerTitle}>Rutinas</Text>
          <TouchableOpacity><Ionicons name="notifications-outline" size={24} color={COLORS.white} /></TouchableOpacity>
        </View>
        <View style={s.tabs}>
          {(['rutinas', 'progreso'] as const).map((tab) => (
            <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab === 'rutinas' ? 'Rutinas' : 'Progreso'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : days.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🏋️</Text>
          <Text style={{ fontWeight: '700', fontSize: 16, color: COLORS.text, textAlign: 'center' }}>
            Tu coach aún no ha asignado una rutina
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            Cuando la cree desde la plataforma, aparecerá aquí automáticamente.
          </Text>
        </View>
      ) : (
        <ScrollView style={s.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[COLORS.primary]} tintColor={COLORS.primary} />}>
          {/* ── TAB RUTINAS ─────────────────────────────────────────────── */}
          {activeTab === 'rutinas' && (
            <View style={{ padding: 16, gap: 12 }}>
              <View style={s.infoBanner}>
                <Ionicons name="clipboard-outline" size={22} color={COLORS.primary} />
                <Text style={{ flex: 1, fontSize: 13, color: COLORS.text }}>
                  Tu coach crea tu rutina y la va actualizando{'\n'}para que sigas progresando.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontWeight: '800', fontSize: 18, color: COLORS.text }}>{rutinaNombre || 'Mi Rutina'}</Text>
              </View>

              <WeekProgressBar days={days} />

              {days.map((day) => (
                <View key={day.num} style={s.dayCard}>
                  <TouchableOpacity
                    style={s.dayHeader}
                    onPress={() => !day.isRest && toggleDay(day.num)}
                    activeOpacity={day.isRest ? 1 : 0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons
                        name={day.isRest ? 'bed-outline' : 'barbell-outline'}
                        size={20}
                        color={day.isRest ? COLORS.muted : COLORS.primary}
                      />
                      <View>
                        <Text style={{ fontWeight: '700', fontSize: 15, color: COLORS.text }}>
                          Día {day.num}
                          {day.exercises.length > 0 && (
                            <Text style={{ fontWeight: '400', color: COLORS.muted, fontSize: 13 }}>
                              {' '}· {day.exercises.length} ejercicios
                            </Text>
                          )}
                        </Text>
                        <Text style={{ fontSize: 12, color: COLORS.muted }}>{day.name}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[
                        s.badge,
                        day.status === 'completado' && s.badgeCompleted,
                        day.status === 'pendiente' && s.badgePending,
                        day.status === 'descanso' && s.badgeRest,
                      ]}>
                        <Text style={[s.badgeText, {
                          color: day.status === 'completado' ? COLORS.completedText
                               : day.status === 'pendiente' ? COLORS.pendingText
                               : COLORS.muted,
                        }]}>
                          {day.status === 'completado' ? '✓ Completado'
                         : day.status === 'pendiente' ? '⏱ Pendiente'
                         : '😴 Descanso'}
                        </Text>
                      </View>
                      {!day.isRest && (
                        <Ionicons
                          name={expanded.includes(day.num) ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={COLORS.muted}
                        />
                      )}
                    </View>
                  </TouchableOpacity>

                  {!day.isRest && expanded.includes(day.num) && (
                    <View style={{ marginTop: 14, gap: 10 }}>
                      {day.exercises.map((ex, i) => (
                        <ExerciseCard key={ex.id} ex={ex} index={i} onPress={() => setSelectedExercise(ex)} />
                      ))}
                      {day.status === 'pendiente' && (
                        <TouchableOpacity style={s.completeBtn} onPress={() => markComplete(day.num)} activeOpacity={0.85}>
                          <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                          <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>
                            Marcar día como completado
                          </Text>
                        </TouchableOpacity>
                      )}
                      {day.status === 'completado' && (
                        <View style={s.doneNote}>
                          <Ionicons name="checkmark-circle" size={16} color={COLORS.completedText} />
                          <Text style={{ fontSize: 13, color: COLORS.completedText, fontWeight: '600' }}>
                            ¡Día completado! Buen trabajo
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* ── TAB PROGRESO ─────────────────────────────────────────── */}
          {activeTab === 'progreso' && (
            <View style={{ padding: 16 }}>
              <Text style={{ fontWeight: '700', fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>
                {allExercises.length} ejercicios en tu rutina
              </Text>
              {allExercises.map((ex) => (
                <View key={ex.ejercicio_id} style={s.progressCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <View style={s.progressImg}>
                      <Text style={{ fontSize: 22 }}>{ex.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 15, color: COLORS.text }}>{ex.name}</Text>
                      <Text style={{ fontSize: 12, color: COLORS.muted }}>{ex.reps}</Text>
                    </View>
                    <View style={s.progressBadge}>
                      <Text style={{ fontSize: 11, color: COLORS.muted }}>Mejor</Text>
                      <Text style={{ fontWeight: '800', fontSize: 15, color: COLORS.primary }}>{ex.best}</Text>
                    </View>
                  </View>

                  {ex.history.length > 0 ? (
                    <View style={s.historyRow}>
                      {ex.history.map((h, vi) => {
                        const maxV = Math.max(...ex.history.map((x) => x.peso))
                        const barH = Math.max(4, Math.round((h.peso / maxV) * 44))
                        const isLast = vi === ex.history.length - 1
                        const [, m, d] = h.fecha.split('-').map(Number)
                        return (
                          <View key={vi} style={{ alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                            <Text style={{ fontSize: 8, color: isLast ? COLORS.primary : COLORS.muted, fontWeight: isLast ? '700' : '400', marginBottom: 2 }}>
                              {h.peso}
                            </Text>
                            <View style={{ width: 12, height: barH, backgroundColor: isLast ? COLORS.primary : COLORS.border, borderRadius: 4 }} />
                            <Text style={{ fontSize: 7, color: COLORS.muted, marginTop: 3 }}>{d}/{m}</Text>
                          </View>
                        )
                      })}
                    </View>
                  ) : (
                    <View style={[s.historyRow, { justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ fontSize: 11, color: COLORS.muted }}>Sin registros aún — toca un ejercicio para registrar peso</Text>
                    </View>
                  )}

                  <View style={s.progressFooter}>
                    <Text style={{ fontSize: 12, color: COLORS.muted }}>Peso sugerido:</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>{ex.actual}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
      {selectedExercise && (
        <ExerciseDetailModal exercise={selectedExercise} userId={userId} onClose={() => setSelectedExercise(null)} />
      )}
    </View>
  )
}

// ─── Estilos ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary },
  headerContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.white, width: '100%', borderRadius: 0, padding: 3, marginBottom: 0 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, color: COLORS.muted, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },
  body: { flex: 1, backgroundColor: COLORS.background },

  infoBanner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 12,
  },

  dayCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeCompleted: { backgroundColor: COLORS.completed },
  badgePending: { backgroundColor: COLORS.pending },
  badgeRest: { backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 11, fontWeight: '600' },

  exerciseCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 10,
  },
  exerciseImg: {
    width: 56, height: 56, backgroundColor: '#E5E7EB', borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  exName: { fontWeight: '700', fontSize: 14, color: COLORS.text, flexShrink: 1 },
  exTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 2 },
  exTag: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  exTagWeight: { backgroundColor: COLORS.completed },
  exTagText: { fontSize: 10, color: COLORS.text, fontWeight: '500' },
  exMeta: { fontSize: 11, color: COLORS.muted },

  numBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  numBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },

  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 10, height: 48, marginTop: 4,
  },
  doneNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.completed, borderRadius: 10, padding: 12, justifyContent: 'center',
  },

  progressCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  progressImg: {
    width: 48, height: 48, backgroundColor: COLORS.completed, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  progressBadge: { alignItems: 'flex-end' },
  historyRow: {
    flexDirection: 'row', alignItems: 'flex-end', height: 64,
    backgroundColor: COLORS.cardBg, borderRadius: 8, paddingHorizontal: 8, paddingBottom: 8,
  },
  progressFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 10,
  },
})

const pb = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  fraction: { fontSize: 13, color: COLORS.muted },
  fractionBold: { color: COLORS.primary, fontWeight: '800' },
  track: { height: 10, backgroundColor: '#E5E7EB', borderRadius: 10, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 10 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  dayDot: { alignItems: 'center', gap: 3 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' },
  dotDone: { backgroundColor: COLORS.primary },
  dotRest: { backgroundColor: '#D1D5DB' },
  dayLetter: { fontSize: 9, color: COLORS.muted },
})
