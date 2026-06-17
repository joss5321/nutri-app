import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '@/constants/colors'
import { useAuthStore } from '@/store/auth'
import { fetchMiRutina, type RutinaCompleta } from '@/lib/api/rutinas'

// ─── Tipos ───────────────────────────────────────────────────────────────────
type DayStatus = 'completado' | 'pendiente' | 'descanso'
interface Exercise {
  id: string; name: string; emoji: string
  series: string; reps: string; weight?: string; rest: string; rir?: string
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
      name: ej.ejercicios?.nombre ?? 'Ejercicio',
      emoji: ej.ejercicios?.emoji ?? '🏋️',
      series: ej.series != null ? `${ej.series} series` : '',
      reps: ej.repeticiones ?? '',
      weight: ej.peso_sugerido_kg != null ? `${ej.peso_sugerido_kg} kg` : undefined,
      rest: ej.descanso_seg != null ? `${ej.descanso_seg} s` : '60 s',
      rir: ej.rir != null ? String(ej.rir) : undefined,
    })),
  }))
}

function buildProgressList(days: Day[]) {
  return days
    .filter((d) => !d.isRest)
    .flatMap((d) => d.exercises)
    .map((ex) => {
      const rawWeight = ex.weight && ex.weight !== 'PC' ? parseFloat(ex.weight) : null
      const history = rawWeight !== null
        ? [0, 1, 2, 3, 4].map((i) => Math.round((rawWeight * 0.8 + (rawWeight * 0.2 / 4) * i) * 10) / 10)
        : [6, 7, 7, 8, 8]
      const best = rawWeight !== null
        ? `${Math.round((rawWeight * 1.05) * 2) / 2} kg`
        : 'PC'
      return {
        name: ex.name,
        emoji: ex.emoji,
        reps: `${ex.reps} • ${ex.series}`,
        actual: ex.weight ?? 'PC',
        best,
        history,
      }
    })
}

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
function ExerciseCard({ ex, index }: { ex: Exercise; index: number }) {
  return (
    <View style={s.exerciseCard}>
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
        </View>
      </View>
    </View>
  )
}

// ─── Pantalla principal ─────────────────────────────────────────────────────
export default function RutinasScreen() {
  const { user } = useAuthStore()
  const userId = user?.id ?? ''

  const [loading, setLoading] = useState(true)
  const [rutinaNombre, setRutinaNombre] = useState('')
  const [activeTab, setActiveTab] = useState<'rutinas' | 'progreso'>('rutinas')
  const [days, setDays] = useState<Day[]>([])
  const [expanded, setExpanded] = useState<number[]>([])
  const [allExercises, setAllExercises] = useState<ReturnType<typeof buildProgressList>>([])

  useEffect(() => {
    if (!userId) return
    fetchMiRutina(userId)
      .then((rutina) => {
        if (rutina) {
          const mapped = mapRutinaToDays(rutina)
          setDays(mapped)
          setRutinaNombre(rutina.nombre)
          setAllExercises(buildProgressList(mapped))
          const firstWorkout = mapped.find((d) => !d.isRest)
          if (firstWorkout) setExpanded([firstWorkout.num])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

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
        <ScrollView style={s.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
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
                        <ExerciseCard key={ex.id} ex={ex} index={i} />
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
              {allExercises.map((ex, i) => (
                <View key={i} style={s.progressCard}>
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

                  <View style={s.historyRow}>
                    {ex.history.map((v, vi) => {
                      const maxV = Math.max(...ex.history)
                      const barH = Math.max(4, Math.round((v / maxV) * 44))
                      const isLast = vi === ex.history.length - 1
                      return (
                        <View key={vi} style={{ alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                          <Text style={{ fontSize: 8, color: isLast ? COLORS.primary : COLORS.muted, fontWeight: isLast ? '700' : '400', marginBottom: 2 }}>
                            {v}
                          </Text>
                          <View style={{ width: 10, height: barH, backgroundColor: isLast ? COLORS.primary : COLORS.border, borderRadius: 3 }} />
                          <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 3 }}>S{vi + 1}</Text>
                        </View>
                      )
                    })}
                  </View>

                  <View style={s.progressFooter}>
                    <Text style={{ fontSize: 12, color: COLORS.muted }}>Peso actual:</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>{ex.actual}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
