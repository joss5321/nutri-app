import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/ui/AppHeader'
import { COLORS } from '@/constants/colors'
import { useAuthStore } from '@/store/auth'
import { fetchMisEquivalentes, type Equivalente } from '@/lib/api/nutricion'

// ─── EQUIVALENTES ─────────────────────────────────────────────────────────────
const MEAL_LABELS = ['Desayuno', 'Colación 1', 'Comida', 'Colación 2', 'Cena']

const LABEL_MAP: Record<string, string> = {
  'Cereales sin grasa': 'Cereales\nsin grasa',
  'Leche descremada': 'Leche\ndescremada',
  'POA muy bajo aporte': 'POA muy bajo\naporte',
  'POA bajo aporte': 'POA bajo\naporte',
  'POA medio aporte': 'POA medio\naporte',
  'Aceites y grasas': 'Aceites y\ngrasas',
  'AC y C c/Proteína': 'AC y C\nc/Proteína',
}

type FoodGroupRow = { icon: string; label: string; meals: number[] }

function mapEquivalentesToGroups(equivalentes: Equivalente[]): FoodGroupRow[] {
  return equivalentes.map((eq) => ({
    icon: eq.icono ?? '🍽',
    label: LABEL_MAP[eq.grupo] ?? eq.grupo,
    meals: [eq.desayuno, eq.colacion_1, eq.comida, eq.colacion_2, eq.cena],
  }))
}

function EquivalentesTab() {
  const { user } = useAuthStore()
  const userId = user?.id ?? ''

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [groups, setGroups] = useState<FoodGroupRow[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const loadData = useCallback((isRefresh = false) => {
    if (!userId) return
    if (isRefresh) setRefreshing(true); else setLoading(true)
    fetchMisEquivalentes(userId)
      .then((result) => {
        if (result && result.equivalentes.length > 0) {
          setGroups(mapEquivalentesToGroups(result.equivalentes))
          setExpandedIdx(0)
        } else {
          setGroups([])
        }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [userId])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const toggle = (i: number) => setExpandedIdx((prev) => (prev === i ? null : i))

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  if (groups.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🥗</Text>
        <Text style={{ fontWeight: '700', fontSize: 16, color: COLORS.text, textAlign: 'center' }}>
          Tu nutriólogo aún no ha asignado un plan de equivalentes
        </Text>
        <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
          Cuando lo cree desde la plataforma, aparecerá aquí automáticamente.
        </Text>
      </View>
    )
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[COLORS.primary]} tintColor={COLORS.primary} />}>
      <View style={{ padding: 16, gap: 14 }}>
        {/* Objetivo del mes */}
        <View style={s.objetivoCard}>
          <Text style={s.objetivoTitle}>Objetivo del mes</Text>
          <View style={s.objetivoRow}>
            <View style={s.objetivoIcon}><Text style={{ fontSize: 22 }}>🎯</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: COLORS.text }}>Plan de equivalentes</Text>
              <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                Tu nutriólogo ha asignado los equivalentes por tiempo de comida para tu plan.
              </Text>
            </View>
          </View>
        </View>

        {/* Grid de grupos con total */}
        <View style={s.grid}>
          {groups.map((g, i) => {
            const total = g.meals.reduce((a, b) => a + b, 0)
            const isOpen = expandedIdx === i
            return (
              <TouchableOpacity
                key={i}
                style={[s.gridItem, isOpen && s.gridItemActive]}
                onPress={() => toggle(i)}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 32 }}>{g.icon}</Text>
                <Text style={[s.gridLabel, isOpen && { color: COLORS.primary }]}>{g.label}</Text>
                <View style={[s.totalBadge, isOpen && s.totalBadgeActive]}>
                  <Text style={[s.totalBadgeText, isOpen && { color: COLORS.white }]}>
                    {total} equiv.
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Tabla expandida del grupo seleccionado */}
        {expandedIdx !== null && expandedIdx < groups.length && (() => {
          const g = groups[expandedIdx]
          const total = g.meals.reduce((a, b) => a + b, 0)
          return (
            <View style={s.expandedCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 24 }}>{g.icon}</Text>
                  <View>
                    <Text style={{ fontWeight: '700', color: COLORS.text }}>
                      {g.label.replace('\n', ' ')}
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '600' }}>
                      Total diario: {total} equivalente{total !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setExpandedIdx(null)}>
                  <Ionicons name="chevron-up" size={18} color={COLORS.muted} />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#F0FAF5', padding: 8 }}>
                  {MEAL_LABELS.map((h) => (
                    <Text key={h} style={{ flex: 1, fontSize: 10, fontWeight: '700', textAlign: 'center', color: COLORS.primary }}>
                      {h}
                    </Text>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', padding: 10 }}>
                  {g.meals.map((v, mi) => (
                    <Text key={mi} style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: v === 0 ? COLORS.border : COLORS.text }}>
                      {v}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          )
        })()}
      </View>
    </ScrollView>
  )
}

// ─── RECETAS ──────────────────────────────────────────────────────────────────
import { fetchMisRecetas, type RecetaCompleta } from '@/lib/api/recetas'

type Recipe = {
  id: string; emoji: string; name: string; tags: string
  time: string; level: string; calories: string; servings: string
  ingredients: string[]; steps: string[]
}

function mapReceta(r: RecetaCompleta): Recipe {
  const tiempo = r.tiempo_min ?? r.tiempo_prep_min ?? null
  return {
    id: r.id,
    emoji: r.emoji ?? '🍽',
    name: r.nombre,
    tags: r.tags ?? r.categoria_nutricional ?? '',
    time: tiempo != null ? `${tiempo} min` : '—',
    level: r.nivel ?? '—',
    calories: r.calorias != null ? `${r.calorias} kcal` : '—',
    servings: r.porciones ?? '1 porción',
    ingredients: r.ingredientes.map((i) => i.descripcion),
    steps: r.pasos.map((p) => p.descripcion),
  }
}

function RecipeDetailModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={rm.header}>
          <TouchableOpacity style={rm.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={rm.headerTitle} numberOfLines={1}>{recipe.name}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={rm.hero}>
            <Text style={{ fontSize: 72 }}>{recipe.emoji}</Text>
          </View>

          <View style={{ padding: 20, gap: 16 }}>
            <View style={rm.infoRow}>
              <View style={rm.infoChip}>
                <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                <Text style={rm.infoChipText}>{recipe.time}</Text>
              </View>
              <View style={rm.infoChip}>
                <Ionicons name="bar-chart-outline" size={14} color={COLORS.primary} />
                <Text style={rm.infoChipText}>{recipe.level}</Text>
              </View>
              <View style={rm.infoChip}>
                <Ionicons name="flame-outline" size={14} color={COLORS.primary} />
                <Text style={rm.infoChipText}>{recipe.calories}</Text>
              </View>
              <View style={rm.infoChip}>
                <Ionicons name="person-outline" size={14} color={COLORS.primary} />
                <Text style={rm.infoChipText}>{recipe.servings}</Text>
              </View>
            </View>

            {recipe.tags ? (
              <View style={rm.tagRow}>
                {recipe.tags.split(' • ').map((t, i) => (
                  <View key={i} style={rm.tag}>
                    <Text style={rm.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={rm.section}>
              <Text style={rm.sectionTitle}>🛒 Ingredientes</Text>
              <View style={rm.ingredientsList}>
                {recipe.ingredients.map((ing, i) => (
                  <View key={i} style={rm.ingredientRow}>
                    <View style={rm.bullet} />
                    <Text style={rm.ingredientText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={rm.section}>
              <Text style={rm.sectionTitle}>👨‍🍳 Preparación</Text>
              <View style={{ gap: 12 }}>
                {recipe.steps.map((step, i) => (
                  <View key={i} style={rm.stepRow}>
                    <View style={rm.stepNum}>
                      <Text style={rm.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={rm.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

function RecetasTab() {
  const { user } = useAuthStore()
  const userId = user?.id ?? ''

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Todos')
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)

  const loadData = useCallback((isRefresh = false) => {
    if (!userId) return
    if (isRefresh) setRefreshing(true); else setLoading(true)
    fetchMisRecetas(userId)
      .then((data) => setRecipes(data.map(mapReceta)))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [userId])

  useFocusEffect(useCallback(() => { loadData() }, [loadData])
  )

  const filters = ['Todos', 'Cereales', 'Frutas', 'Verduras', 'Leche', 'Proteína']

  const filtered = recipes.filter((r) => {
    const matchFilter = activeFilter === 'Todos' || r.tags.toLowerCase().includes(activeFilter.toLowerCase())
    const matchSearch = search === '' || r.name.toLowerCase().includes(search.toLowerCase()) || r.tags.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  if (recipes.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🍽</Text>
        <Text style={{ fontWeight: '700', fontSize: 16, color: COLORS.text, textAlign: 'center' }}>
          Tu nutriólogo aún no ha asignado recetas
        </Text>
        <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
          Cuando las asigne desde la plataforma, aparecerán aquí automáticamente.
        </Text>
      </View>
    )
  }

  return (
    <>
      {selectedRecipe && (
        <RecipeDetailModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
      )}
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[COLORS.primary]} tintColor={COLORS.primary} />}>
        <View style={{ padding: 16, gap: 14 }}>
          {/* Buscador */}
          <View style={s.searchBar}>
            <Ionicons name="search" size={18} color={COLORS.muted} />
            <TextInput
              style={s.searchInput}
              placeholder="Buscar recetas o ingredientes..."
              placeholderTextColor={COLORS.muted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Filtros */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {filters.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[s.filterChip, activeFilter === f && s.filterChipActive]}
                  onPress={() => setActiveFilter(f)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.filterChipText, activeFilter === f && { color: COLORS.white }]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Conteo */}
          <Text style={{ fontSize: 12, color: COLORS.muted }}>
            {filtered.length} receta{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}
          </Text>

          {/* Lista de recetas */}
          <View style={{ gap: 12 }}>
            {filtered.map((r, i) => (
              <TouchableOpacity key={i} style={s.recipeListCard} onPress={() => setSelectedRecipe(r)} activeOpacity={0.8}>
                <View style={s.recipeListEmoji}>
                  <Text style={{ fontSize: 36 }}>{r.emoji}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: COLORS.text }}>{r.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                    {r.tags.split(' • ').map((t, ti) => (
                      <View key={ti} style={s.recipeTagInline}>
                        <Text style={s.recipeTagInlineText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Text style={{ fontSize: 11, color: COLORS.muted }}>⏱ {r.time}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.muted }}>🔥 {r.calories}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.muted }}>📊 {r.level}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ fontSize: 36 }}>🔍</Text>
                <Text style={{ color: COLORS.muted, marginTop: 8 }}>Sin resultados para "{search}"</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </>
  )
}

// ─── SUPLEMENTACIÓN ───────────────────────────────────────────────────────────
const SUPPLEMENTS = [
  { icon: '🧴', name: 'Proteína en polvo',    dose: '1 medida (30 g) con 250 ml de agua', time: '12:00 PM', when: 'Post entrenamiento',     done: true  },
  { icon: '⚗️', name: 'Aminoácidos (BCAA)',   dose: '1 medida (5 g) con 250 ml de agua',  time: '17:00 PM', when: 'Durante entrenamiento',   done: false },
  { icon: '💊', name: 'Multivitamínico',       dose: '1 cápsula con el desayuno',          time: '08:00 AM', when: 'Con alimentos',           done: true  },
  { icon: '🐟', name: 'Omega 3',              dose: '1 cápsula con la comida',             time: '13:30 PM', when: 'Con alimentos',           done: false },
]

function SuplementacionTab() {
  const [supp, setSupp]             = useState(SUPPLEMENTS)
  const [reminderOn, setReminderOn] = useState(false)
  const [reminderH, setReminderH]   = useState(8)
  const [reminderM, setReminderM]   = useState(0)

  const toggleSupp = (i: number) =>
    setSupp(prev => prev.map((s, idx) => idx === i ? { ...s, done: !s.done } : s))

  const fmtTime = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, gap: 14 }}>
        {/* Progress card */}
        <View style={s.progressCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={s.circle}>
              <Text style={s.circleNum}>85%</Text>
              <Text style={s.circleSub}>Constancia{'\n'}semanal</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Tu racha</Text>
              <Text style={{ fontWeight: '800', fontSize: 22, color: COLORS.text }}>🔥 12 días</Text>
              <Text style={{ fontSize: 12, color: COLORS.muted }}>
                Seguidos tomando{'\n'}tus suplementos
              </Text>
            </View>
            <Text style={{ fontSize: 40 }}>💊</Text>
          </View>
        </View>

        {/* Suplementos de hoy */}
        <Text style={s.sectionTitle}>Suplementos de hoy</Text>
        {supp.map((item, i) => (
          <TouchableOpacity key={i} style={[s.suppCard, item.done && s.suppCardDone]} onPress={() => toggleSupp(i)} activeOpacity={0.8}>
            <View style={s.suppIcon}><Text style={{ fontSize: 24 }}>{item.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', color: COLORS.text }}>{item.name}</Text>
              <Text style={{ fontSize: 12, color: COLORS.muted }}>{item.dose}</Text>
              <Text style={{ fontSize: 11, color: COLORS.muted }}>⏱ {item.when}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={{ fontSize: 12, color: COLORS.muted }}>{item.time}</Text>
              <View style={[s.checkCircle, item.done && s.checkCircleDone]}>
                {item.done && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.viewPlanBtn}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
          <Text style={s.viewPlanText}>Ver plan completo de suplementación</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
        </TouchableOpacity>

        {/* Recordatorio de hidratación (notificación programable) */}
        <View style={s.reminderCard}>
          <View style={s.reminderHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.reminderIconBox}>
                <Text style={{ fontSize: 22 }}>💧</Text>
              </View>
              <View>
                <Text style={{ fontWeight: '700', color: COLORS.text }}>Recordatorio de agua</Text>
                <Text style={{ fontSize: 12, color: COLORS.muted }}>Notificación programada</Text>
              </View>
            </View>
            {/* Toggle */}
            <TouchableOpacity
              style={[s.toggle, reminderOn && s.toggleOn]}
              onPress={() => setReminderOn(v => !v)}
              activeOpacity={0.8}
            >
              <View style={[s.toggleThumb, reminderOn && s.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          {reminderOn && (
            <View style={s.reminderBody}>
              <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', marginBottom: 12 }}>
                Selecciona la hora del recordatorio
              </Text>

              {/* Selector de hora */}
              <View style={s.timePicker}>
                {/* Horas */}
                <View style={s.timeColumn}>
                  <TouchableOpacity onPress={() => setReminderH(h => (h + 1) % 24)} style={s.timeArrow}>
                    <Ionicons name="chevron-up" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={s.timeValue}>{String(reminderH).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => setReminderH(h => (h - 1 + 24) % 24)} style={s.timeArrow}>
                    <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                <Text style={s.timeSep}>:</Text>

                {/* Minutos */}
                <View style={s.timeColumn}>
                  <TouchableOpacity onPress={() => setReminderM(m => (m + 15) % 60)} style={s.timeArrow}>
                    <Ionicons name="chevron-up" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={s.timeValue}>{String(reminderM).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => setReminderM(m => (m - 15 + 60) % 60)} style={s.timeArrow}>
                    <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={{ textAlign: 'center', fontSize: 13, color: COLORS.muted, marginTop: 8 }}>
                Recordatorio diario a las{' '}
                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
                  {fmtTime(reminderH, reminderM)}
                </Text>
              </Text>

              <TouchableOpacity style={s.scheduleBtn} activeOpacity={0.85}>
                <Ionicons name="notifications" size={16} color={COLORS.white} />
                <Text style={s.scheduleBtnText}>Programar notificación</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </View>
    </ScrollView>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
type TabKey = 'equivalentes' | 'recetas' | 'suplementacion'

export default function NutricionScreen() {
  const [tab, setTab] = useState<TabKey>('equivalentes')
  const TABS: { key: TabKey; label: string }[] = [
    { key: 'equivalentes',   label: 'Equivalentes' },
    { key: 'recetas',        label: 'Recetas' },
    { key: 'suplementacion', label: 'Suplementación' },
  ]

  return (
    <View style={s.container}>
      <AppHeader title={'Plan\nNutricional'} />
      <View style={s.innerTabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.innerTab, tab === t.key && s.innerTabActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.innerTabText, tab === t.key && s.innerTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'equivalentes'   && <EquivalentesTab />}
      {tab === 'recetas'        && <RecetasTab />}
      {tab === 'suplementacion' && <SuplementacionTab />}
    </View>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  innerTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white },
  innerTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  innerTabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  innerTabText: { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  innerTabTextActive: { color: COLORS.primary, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  // Equivalentes
  objetivoCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, gap: 10,
  },
  objetivoTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  objetivoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  objetivoIcon: {
    width: 48, height: 48, borderRadius: 10,
    backgroundColor: COLORS.cardBg, justifyContent: 'center', alignItems: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: {
    width: '30%', backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: 10, alignItems: 'center', gap: 4,
  },
  gridItemActive: { borderColor: COLORS.primary, backgroundColor: '#F0FAF5' },
  gridLabel: { fontSize: 11, textAlign: 'center', color: COLORS.text, lineHeight: 15 },
  totalBadge: {
    backgroundColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2, marginTop: 2,
  },
  totalBadgeActive: { backgroundColor: COLORS.primary },
  totalBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.muted },
  expandedCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },

  // Recetas
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white, borderRadius: 30, paddingHorizontal: 16, height: 46,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, color: COLORS.text },
  recipeListCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  recipeListEmoji: {
    width: 64, height: 64, borderRadius: 12,
    backgroundColor: COLORS.cardBg, justifyContent: 'center', alignItems: 'center',
  },
  recipeTagInline: {
    backgroundColor: COLORS.cardBg, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  recipeTagInlineText: { fontSize: 10, color: COLORS.primary },

  // Suplementación
  progressCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  circle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 6, borderColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  circleNum: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  circleSub: { fontSize: 9, color: COLORS.muted, textAlign: 'center' },
  suppCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: COLORS.white, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  suppCardDone: { backgroundColor: '#F0FAF5', borderColor: COLORS.border },
  suppIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.cardBg, justifyContent: 'center', alignItems: 'center' },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkCircleDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  viewPlanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 12,
  },
  viewPlanText: { flex: 1, color: COLORS.primary, fontWeight: '600', fontSize: 13 },

  // Recordatorio de agua
  reminderCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 0,
  },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderIconBox: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  reminderBody: { marginTop: 16, gap: 4 },
  toggle: {
    width: 48, height: 26, borderRadius: 13,
    backgroundColor: '#D1D5DB', justifyContent: 'center', padding: 2,
  },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.white,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  timePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 12, gap: 8,
  },
  timeColumn: { alignItems: 'center', gap: 4 },
  timeArrow: { padding: 4 },
  timeValue: { fontSize: 36, fontWeight: '800', color: COLORS.text, minWidth: 56, textAlign: 'center' },
  timeSep: { fontSize: 36, fontWeight: '800', color: COLORS.primary, marginTop: -8 },
  scheduleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 10, height: 48, marginTop: 12,
  },
  scheduleBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
})

// Estilos del modal de receta
const rm = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16, color: COLORS.text },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  hero: {
    height: 160, backgroundColor: COLORS.cardBg,
    justifyContent: 'center', alignItems: 'center',
  },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.cardBg, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  infoChipText: { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: COLORS.completed, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tagText: { fontSize: 12, color: COLORS.completedText, fontWeight: '600' },
  section: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  ingredientsList: { gap: 8 },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 6 },
  ingredientText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  stepNumText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  stepText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 21 },
})
