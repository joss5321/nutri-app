import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { AppHeader } from '@/components/ui/AppHeader'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '@/constants/colors'

const DAYS = [
  {
    num: 1, name: 'Lunes', status: 'completado',
    exercises: [
      { id: 1, name: 'Press Militar', reps: '15 Reps', series: '4 series', hasAnimation: true },
      { id: 2, name: 'Bench Press', reps: '10 Reps', weight: '40 kg', rest: '2 minutos', rir: '2' },
    ],
  },
  {
    num: 2, name: 'Martes', status: 'pendiente',
    exercises: [
      { id: 1, name: 'Press Militar', reps: '15 Reps', series: '4 series', hasAnimation: true },
      { id: 2, name: 'Bench Press', reps: '10 Reps', weight: '40 kg', rest: '2 minutos', rir: '2' },
    ],
  },
  {
    num: 3, name: 'Miércoles', status: 'pendiente',
    exercises: [
      { id: 1, name: 'Sentadilla', reps: '12 Reps', series: '4 series', hasAnimation: true },
      { id: 2, name: 'Peso muerto', reps: '8 Reps', weight: '60 kg', rest: '3 minutos', rir: '1' },
    ],
  },
]

const PROGRESS_DATA = [
  { name: 'Press Militar', reps: '15 Reps • 4 series', actual: '22.5 kg', best: '25 kg', date: '10 May 2024' },
  { name: 'Bench Press', reps: '10 Reps • 4 series', actual: '40 kg', best: '45 kg', date: '8 May 2024' },
]

export default function RutinasScreen() {
  const [activeTab, setActiveTab] = useState<'rutinas' | 'progreso'>('rutinas')
  const [expandedDays, setExpandedDays] = useState<number[]>([1, 2])

  const toggleDay = (num: number) => {
    setExpandedDays(prev => prev.includes(num) ? prev.filter(d => d !== num) : [...prev, num])
  }

  return (
    <View style={s.container}>
      {/* Header verde */}
      <View style={s.header}>
        <View style={s.headerContent}>
          <TouchableOpacity><Ionicons name="menu" size={26} color={COLORS.white} /></TouchableOpacity>
          <Text style={s.headerTitle}>Rutinas</Text>
          <TouchableOpacity><Ionicons name="notifications-outline" size={24} color={COLORS.white} /></TouchableOpacity>
        </View>
        {/* Tabs */}
        <View style={s.tabs}>
          {(['rutinas', 'progreso'] as const).map(tab => (
            <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab === 'rutinas' ? 'Rutinas' : 'Progreso'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={s.body} showsVerticalScrollIndicator={false}>

        {activeTab === 'rutinas' && (
          <View style={{ padding: 16, gap: 12 }}>
            {/* Info banner */}
            <View style={s.infoBanner}>
              <Ionicons name="clipboard-outline" size={22} color={COLORS.primary} />
              <Text style={{ flex: 1, fontSize: 13, color: COLORS.text }}>
                Tu coach crea tu rutina y la va actualizando{'\n'}para que sigas progresando.
              </Text>
            </View>

            {/* Semana */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontWeight: '800', fontSize: 18, color: COLORS.text }}>Semana 1</Text>
              <TouchableOpacity style={s.weekBtn}>
                <Text style={{ color: COLORS.primary, fontSize: 13 }}>📅  1 - 7 May  ▾</Text>
              </TouchableOpacity>
            </View>

            {/* Días */}
            {DAYS.map(day => (
              <View key={day.num} style={s.dayCard}>
                <TouchableOpacity style={s.dayHeader} onPress={() => toggleDay(day.num)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                    <View>
                      <Text style={{ fontWeight: '700', fontSize: 15, color: COLORS.text }}>Día {day.num}</Text>
                      <Text style={{ fontSize: 12, color: COLORS.muted }}>{day.name}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[s.badge, day.status === 'completado' ? s.badgeCompleted : s.badgePending]}>
                      <Text style={[s.badgeText, { color: day.status === 'completado' ? COLORS.completedText : COLORS.pendingText }]}>
                        {day.status === 'completado' ? 'Completado ✓' : 'Pendiente ⏱'}
                      </Text>
                    </View>
                    <Ionicons name={expandedDays.includes(day.num) ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.muted} />
                  </View>
                </TouchableOpacity>

                {expandedDays.includes(day.num) && (
                  <View style={{ gap: 10, marginTop: 12 }}>
                    {day.exercises.map((ex, i) => (
                      <View key={i} style={s.exerciseCard}>
                        <View style={s.exerciseImg}>
                          <Text style={{ fontSize: 24 }}>💪</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={s.numBadge}><Text style={s.numBadgeText}>{i + 1}</Text></View>
                            <Text style={{ fontWeight: '700', fontSize: 14, color: COLORS.text }}>{ex.name}</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                            {ex.reps}{ex.series ? `  •  ${ex.series}` : ''}{ex.weight ? `  •  ${ex.weight}` : ''}
                          </Text>
                          {'rest' in ex && (
                            <Text style={{ fontSize: 12, color: COLORS.muted }}>
                              Descanso: {ex.rest}  •  RIR: {ex.rir}
                            </Text>
                          )}
                          {ex.hasAnimation && (
                            <TouchableOpacity style={s.animBtn}>
                              <Ionicons name="play" size={12} color={COLORS.primary} />
                              <Text style={s.animBtnText}>Ver animación</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
                    {day.status === 'pendiente' && (
                      <TouchableOpacity style={s.completeBtn}>
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                        <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 14 }}>Marcar día como completado</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'progreso' && (
          <View style={{ padding: 16 }}>
            <Text style={{ fontWeight: '800', fontSize: 18, color: COLORS.text, marginBottom: 4 }}>Semana 1</Text>
            {[1, 2].map(dayNum => (
              <View key={dayNum} style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                  <View>
                    <Text style={{ fontWeight: '700', color: COLORS.primary }}>Día {dayNum}</Text>
                    <Text style={{ fontSize: 12, color: COLORS.muted }}>{dayNum === 1 ? 'Lunes' : 'Martes'}</Text>
                  </View>
                </View>
                <View style={s.progressTable}>
                  <View style={s.progressHeader}>
                    {['Ejercicio', 'Peso actual', 'Mejor peso', 'Historial'].map(h => (
                      <Text key={h} style={s.pth}>{h}</Text>
                    ))}
                  </View>
                  {PROGRESS_DATA.map((ex, i) => (
                    <View key={i} style={s.progressRow}>
                      <View style={{ width: 90 }}>
                        <View style={{ width: 40, height: 40, backgroundColor: '#E5E7EB', borderRadius: 8, marginBottom: 4, justifyContent: 'center', alignItems: 'center' }}>
                          <Text>💪</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.text }}>{ex.name}</Text>
                        <Text style={{ fontSize: 10, color: COLORS.muted }}>{ex.reps}</Text>
                      </View>
                      <Text style={[s.ptd, { color: COLORS.primary, fontWeight: '700' }]}>{ex.actual}</Text>
                      <View style={{ width: 80 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text }}>{ex.best}</Text>
                        <Text style={{ fontSize: 10, color: COLORS.muted }}>{ex.date}</Text>
                      </View>
                      <View style={{ width: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
                        {[20, 20, 22, 23, 25].map((v, vi) => (
                          <View key={vi} style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 7, color: COLORS.primary }}>{v}</Text>
                            <View style={{ width: 6, height: v - 16, backgroundColor: COLORS.primary, borderRadius: 2 }} />
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { backgroundColor: COLORS.primary, paddingBottom: 0 },
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
  body: { flex: 1, backgroundColor: COLORS.white },
  infoBanner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 12,
  },
  weekBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  dayCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeCompleted: { backgroundColor: COLORS.completed },
  badgePending: { backgroundColor: COLORS.pending },
  badgeText: { fontSize: 11, fontWeight: '600' },
  exerciseCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  exerciseImg: {
    width: 72, height: 72, backgroundColor: '#E5E7EB', borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  numBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  numBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  animBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 6, alignSelf: 'flex-start',
  },
  animBtnText: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 10, height: 46,
  },
  progressTable: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  progressHeader: {
    flexDirection: 'row', backgroundColor: '#F9FAFB', padding: 10,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  pth: { flex: 1, fontSize: 11, fontWeight: '700', color: COLORS.primary, textAlign: 'center' },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  ptd: { flex: 1, textAlign: 'center', fontSize: 13 },
})
