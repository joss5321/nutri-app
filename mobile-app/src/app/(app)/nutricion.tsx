import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { useNewsStore } from '@/store/news'
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
  const expandAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (expandedIdx !== null) {
      expandAnim.setValue(0)
      Animated.spring(expandAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }).start()
    }
  }, [expandedIdx])

  const loadData = useCallback(
    (isRefresh = false) => {
      if (!userId) return
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
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
        .finally(() => {
          setLoading(false)
          setRefreshing(false)
        })
    },
    [userId],
  )

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
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadData(true)}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      <View style={{ padding: 16, gap: 14 }}>
        <View style={s.objetivoCard}>
          <Text style={s.objetivoTitle}>Objetivo del mes</Text>
          <View style={s.objetivoRow}>
            <View style={s.objetivoIcon}>
              <Text style={{ fontSize: 22 }}>🎯</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: COLORS.text }}>Plan de equivalentes</Text>
              <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                Tu nutriólogo ha asignado los equivalentes por tiempo de comida para tu plan.
              </Text>
            </View>
          </View>
        </View>

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

        {expandedIdx !== null && expandedIdx < groups.length &&
          (() => {
            const g = groups[expandedIdx]
            const total = g.meals.reduce((a, b) => a + b, 0)
            return (
              <Animated.View
                style={{
                  opacity: expandAnim,
                  transform: [
                    {
                      translateY: expandAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0],
                      }),
                    },
                  ],
                }}
              >
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

                  <View
                    style={{
                      marginTop: 12,
                      borderRadius: 12,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 8 }}>
                      {MEAL_LABELS.map((h) => (
                        <Text
                          key={h}
                          style={{ flex: 1, fontSize: 10, fontWeight: '700', textAlign: 'center', color: COLORS.muted }}
                        >
                          {h}
                        </Text>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', padding: 10 }}>
                      {g.meals.map((v, mi) => (
                        <Text
                          key={mi}
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            fontSize: 18,
                            fontWeight: '800',
                            color: v === 0 ? COLORS.border : COLORS.text,
                          }}
                        >
                          {v}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
              </Animated.View>
            )
          })()}
      </View>
    </ScrollView>
  )
}

// ─── RECETAS ──────────────────────────────────────────────────────────────────
import { fetchMisRecetas, type RecetaCompleta } from '@/lib/api/recetas'

type RecipeIngredient = { text: string; grupo?: string | null }

type Recipe = {
  id: string
  emoji: string
  name: string
  tags: string
  time: string
  level: string
  calories: string
  servings: string
  ingredients: RecipeIngredient[]
  steps: string[]
  mealTime: string | null
}

const MEAL_SECTIONS = [
  { key: 'desayuno', label: 'Desayuno', emoji: '🌅' },
  { key: 'colacion_1', label: 'Colación 1', emoji: '🍎' },
  { key: 'comida', label: 'Comida', emoji: '🍽️' },
  { key: 'colacion_2', label: 'Colación PM', emoji: '🥑' },
  { key: 'cena', label: 'Cena', emoji: '🌙' },
]

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
    ingredients: r.ingredientes.map((i) => ({ text: i.descripcion, grupo: i.grupo ?? null })),
    steps: r.pasos.map((p) => p.descripcion),
    mealTime: r.tiempo_comida ?? null,
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
          <Text style={rm.headerTitle} numberOfLines={1}>
            {recipe.name}
          </Text>
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
                    <Text style={rm.ingredientText}>{ing.text}</Text>
                    {ing.grupo ? (
                      <View style={rm.grupoTag}>
                        <Text style={rm.grupoTagText}>{ing.grupo}</Text>
                      </View>
                    ) : null}
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

function RecipeCard({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.recipeListCard} onPress={onPress} activeOpacity={0.8}>
      <View style={s.recipeListEmoji}>
        <Text style={{ fontSize: 36 }}>{recipe.emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: COLORS.text }}>{recipe.name}</Text>
        {recipe.tags ? (
          <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {recipe.tags.split(' • ').map((t, ti) => (
              <View key={ti} style={s.recipeTagInline}>
                <Text style={s.recipeTagInlineText}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontSize: 11, color: COLORS.muted }}>⏱ {recipe.time}</Text>
          <Text style={{ fontSize: 11, color: COLORS.muted }}>🔥 {recipe.calories}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
    </TouchableOpacity>
  )
}

function RecetasTab() {
  const { user } = useAuthStore()
  const userId = user?.id ?? ''

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [search, setSearch] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)

  const loadData = useCallback(
    (isRefresh = false) => {
      if (!userId) return
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      fetchMisRecetas(userId)
        .then((data) => setRecipes(data.map(mapReceta)))
        .catch(() => {})
        .finally(() => {
          setLoading(false)
          setRefreshing(false)
        })
    },
    [userId],
  )

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const filtered = recipes.filter(
    (r) =>
      search === '' ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.tags.toLowerCase().includes(search.toLowerCase()),
  )

  const sections = MEAL_SECTIONS.map((sec) => ({
    ...sec,
    recipes: filtered.filter((r) => r.mealTime === sec.key),
  })).filter((sec) => sec.recipes.length > 0)

  const unclassified = filtered.filter(
    (r) => !r.mealTime || !MEAL_SECTIONS.find((sec) => sec.key === r.mealTime),
  )

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={{ padding: 16, gap: 14 }}>
          <View style={s.searchBar}>
            <Ionicons name="search" size={18} color={COLORS.muted} />
            <TextInput
              style={s.searchInput}
              placeholder="Buscar recetas..."
              placeholderTextColor={COLORS.muted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <Text style={{ fontSize: 12, color: COLORS.muted }}>
            {filtered.length} receta{filtered.length !== 1 ? 's' : ''} disponible
            {filtered.length !== 1 ? 's' : ''}
          </Text>

          {sections.map((sec) => (
            <View key={sec.key} style={{ gap: 10 }}>
              <View style={s.mealSectionHeader}>
                <Text style={{ fontSize: 18 }}>{sec.emoji}</Text>
                <Text style={s.mealSectionTitle}>{sec.label}</Text>
                <View style={s.mealCountBadge}>
                  <Text style={s.mealCountText}>{sec.recipes.length}</Text>
                </View>
              </View>
              {sec.recipes.map((r, i) => (
                <RecipeCard key={i} recipe={r} onPress={() => setSelectedRecipe(r)} />
              ))}
            </View>
          ))}

          {unclassified.length > 0 && (
            <View style={{ gap: 10 }}>
              <View style={s.mealSectionHeader}>
                <Text style={{ fontSize: 18 }}>🍽️</Text>
                <Text style={s.mealSectionTitle}>Otras recetas</Text>
                <View style={s.mealCountBadge}>
                  <Text style={s.mealCountText}>{unclassified.length}</Text>
                </View>
              </View>
              {unclassified.map((r, i) => (
                <RecipeCard key={i} recipe={r} onPress={() => setSelectedRecipe(r)} />
              ))}
            </View>
          )}

          {filtered.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 36 }}>🔍</Text>
              <Text style={{ color: COLORS.muted, marginTop: 8 }}>
                Sin resultados para "{search}"
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  )
}

// ─── SUPLEMENTACIÓN ───────────────────────────────────────────────────────────
import {
  fetchMisSuplementos,
  updateSuplementoHora,
  updateSuplementoMomento,
  updateSuplementoNotas,
  MOMENTOS_CONSUMO,
  type SuplementoAsignado,
} from '@/lib/api/suplementacion'
import * as Notifications from 'expo-notifications'

function fmtHora(hora: string | null): string {
  if (!hora) return '—'
  const [h, m] = hora.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function SuplementacionTab() {
  const { user } = useAuthStore()
  const userId = user?.id ?? ''

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [suplementos, setSuplementos] = useState<SuplementoAsignado[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [showNotifPicker, setShowNotifPicker] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHora, setEditHora] = useState('')
  const [savingHora, setSavingHora] = useState(false)

  const [momentoEditId, setMomentoEditId] = useState<string | null>(null)
  const [savingMomento, setSavingMomento] = useState(false)

  const [notasEditId, setNotasEditId] = useState<string | null>(null)
  const [editNotas, setEditNotas] = useState('')
  const [savingNotas, setSavingNotas] = useState(false)

  const loadData = useCallback(
    (isRefresh = false) => {
      if (!userId) return
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      fetchMisSuplementos(userId)
        .then(setSuplementos)
        .catch(() => {})
        .finally(() => {
          setLoading(false)
          setRefreshing(false)
        })
    },
    [userId],
  )

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const startEditHora = (item: SuplementoAsignado) => {
    setMomentoEditId(null)
    setNotasEditId(null)
    setEditingId(item.id)
    setEditHora(item.hora ?? '')
  }

  const handleSaveHora = async () => {
    if (!editingId) return
    const trimmed = editHora.trim()
    if (!/^\d{1,2}:\d{2}$/.test(trimmed)) {
      Alert.alert('Formato inválido', 'Ingresa la hora en formato HH:MM (ej. 08:30)')
      return
    }
    setSavingHora(true)
    try {
      await updateSuplementoHora(editingId, trimmed)
      setSuplementos((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, hora: trimmed } : s)),
      )
      setEditingId(null)
      setNotificationsEnabled(false)
    } catch {
      Alert.alert('Error', 'No se pudo guardar la hora.')
    } finally {
      setSavingHora(false)
    }
  }

  const handleSaveMomento = async (id: string, momento: string) => {
    setSavingMomento(true)
    try {
      await updateSuplementoMomento(id, momento)
      setSuplementos((prev) => prev.map((s) => (s.id === id ? { ...s, momento } : s)))
      setMomentoEditId(null)
    } catch {
      Alert.alert('Error', 'No se pudo guardar el momento.')
    } finally {
      setSavingMomento(false)
    }
  }

  const handleSaveNotas = async () => {
    if (!notasEditId) return
    setSavingNotas(true)
    try {
      const notas = editNotas.trim() || null
      await updateSuplementoNotas(notasEditId, notas)
      setSuplementos((prev) =>
        prev.map((s) => (s.id === notasEditId ? { ...s, notas } : s)),
      )
      setNotasEditId(null)
    } catch {
      Alert.alert('Error', 'No se pudo guardar la nota.')
    } finally {
      setSavingNotas(false)
    }
  }

  const handleActivateNotifications = async () => {
    setShowNotifPicker(false)
    const existing = await Notifications.getPermissionsAsync()
    let granted = (existing as { granted: boolean }).granted
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync()
      granted = (requested as { granted: boolean }).granted
    }
    if (granted) {
      await Notifications.cancelAllScheduledNotificationsAsync()
      for (const sup of suplementos) {
        if (sup.hora) {
          const [h, m] = sup.hora.split(':').map(Number)
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `💊 ${sup.suplementos.nombre}`,
              body: sup.dosis
                ? `${sup.dosis}${sup.momento ? ` — ${sup.momento}` : ''}`
                : 'Es hora de tu suplemento',
              sound: true,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: h,
              minute: m,
            },
          })
        }
      }
      setNotificationsEnabled(true)
    }
  }

  const handleDeactivateNotifications = async () => {
    setShowNotifPicker(false)
    await Notifications.cancelAllScheduledNotificationsAsync()
    setNotificationsEnabled(false)
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  if (suplementos.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>💊</Text>
        <Text style={{ fontWeight: '700', fontSize: 16, color: COLORS.text, textAlign: 'center' }}>
          Tu nutriólogo aún no ha asignado suplementos
        </Text>
        <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
          Cuando los asigne desde la plataforma, aparecerán aquí automáticamente.
        </Text>
      </View>
    )
  }

  const completados = suplementos.filter((sup) => checked.has(sup.id)).length
  const total = suplementos.length
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadData(true)}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      <View style={{ padding: 16, gap: 14 }}>
        {/* Progreso */}
        <View style={s.progressCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={s.circle}>
              <Text style={s.circleNum}>{pct}%</Text>
              <Text style={s.circleSub}>Completado{'\n'}hoy</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Progreso del día</Text>
              <Text style={{ fontWeight: '800', fontSize: 22, color: COLORS.text }}>
                {completados} de {total}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.muted }}>suplementos tomados</Text>
            </View>
            <Text style={{ fontSize: 40 }}>💊</Text>
          </View>
        </View>

        {/* Recordatorios dropdown */}
        <View style={s.notifBar}>
          <Text style={s.notifBarLabel}>Recordatorios</Text>
          <TouchableOpacity
            style={s.notifDropdown}
            onPress={() => setShowNotifPicker((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={notificationsEnabled ? 'notifications' : 'notifications-off-outline'}
              size={15}
              color={notificationsEnabled ? COLORS.primary : COLORS.muted}
            />
            <Text style={[s.notifDropdownText, notificationsEnabled && { color: COLORS.primary }]}>
              {notificationsEnabled ? 'Activados' : 'Desactivados'}
            </Text>
            <Ionicons
              name={showNotifPicker ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={COLORS.muted}
            />
          </TouchableOpacity>
        </View>

        {showNotifPicker && (
          <View style={s.notifPickerPanel}>
            <TouchableOpacity style={s.notifPickerOption} onPress={handleActivateNotifications}>
              <Ionicons name="notifications" size={16} color={COLORS.primary} />
              <Text style={s.notifPickerOptionText}>Activados</Text>
              {notificationsEnabled && <Ionicons name="checkmark" size={14} color={COLORS.primary} />}
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: COLORS.border }} />
            <TouchableOpacity style={s.notifPickerOption} onPress={handleDeactivateNotifications}>
              <Ionicons name="notifications-off-outline" size={16} color={COLORS.muted} />
              <Text style={[s.notifPickerOptionText, { color: COLORS.muted }]}>Desactivados</Text>
              {!notificationsEnabled && <Ionicons name="checkmark" size={14} color={COLORS.primary} />}
            </TouchableOpacity>
          </View>
        )}

        {/* Lista de suplementos */}
        <Text style={s.sectionTitle}>Mis suplementos</Text>
        {suplementos.map((item) => {
          const done = checked.has(item.id)
          const isEditingHora = editingId === item.id
          const isEditingMomento = momentoEditId === item.id
          const isEditingNotas = notasEditId === item.id

          return (
            <View key={item.id}>
              <View style={[s.suppCard, done && s.suppCardDone]}>
                <View style={[s.suppIcon, done && { backgroundColor: '#DCFCE7' }]}>
                  <Text style={{ fontSize: 24 }}>💊</Text>
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontWeight: '700', color: COLORS.text }}>
                    {item.suplementos.nombre}
                  </Text>
                  {item.dosis ? (
                    <Text style={{ fontSize: 12, color: COLORS.muted }}>{item.dosis}</Text>
                  ) : null}
                  {item.suplementos.marca ? (
                    <Text style={{ fontSize: 10, color: COLORS.muted }}>
                      {item.suplementos.marca}
                      {item.suplementos.gramaje ? ` · ${item.suplementos.gramaje}` : ''}
                    </Text>
                  ) : null}
                  {item.notas ? (
                    <Text style={{ fontSize: 11, color: '#6366F1', fontStyle: 'italic' }} numberOfLines={1}>
                      📝 {item.notas}
                    </Text>
                  ) : null}

                  {/* Chips */}
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <TouchableOpacity
                      style={[s.suppChip, isEditingMomento && s.suppChipActive]}
                      onPress={() => {
                        setEditingId(null)
                        setNotasEditId(null)
                        setMomentoEditId((prev) => (prev === item.id ? null : item.id))
                      }}
                    >
                      <Ionicons
                        name="time-outline"
                        size={11}
                        color={isEditingMomento ? COLORS.white : COLORS.muted}
                      />
                      <Text style={[s.suppChipText, isEditingMomento && { color: COLORS.white }]}>
                        {item.momento ?? 'Momento'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.suppChip, isEditingHora && s.suppChipActive]}
                      onPress={() =>
                        isEditingHora ? setEditingId(null) : startEditHora(item)
                      }
                    >
                      <Ionicons
                        name="alarm-outline"
                        size={11}
                        color={isEditingHora ? COLORS.white : COLORS.muted}
                      />
                      <Text style={[s.suppChipText, isEditingHora && { color: COLORS.white }]}>
                        {fmtHora(item.hora)}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.suppChip, isEditingNotas && s.suppChipActive]}
                      onPress={() => {
                        setEditingId(null)
                        setMomentoEditId(null)
                        const opening = notasEditId !== item.id
                        setNotasEditId(opening ? item.id : null)
                        if (opening) setEditNotas(item.notas ?? '')
                      }}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={11}
                        color={isEditingNotas ? COLORS.white : COLORS.muted}
                      />
                      <Text style={[s.suppChipText, isEditingNotas && { color: COLORS.white }]}>
                        {item.notas ? 'Nota' : 'Añadir nota'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => toggleCheck(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <View style={[s.checkCircle, done && s.checkCircleDone]}>
                    {done && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                  </View>
                </TouchableOpacity>
              </View>

              {/* Momento picker */}
              {isEditingMomento && (
                <View style={s.suppExpandPanel}>
                  <Text style={s.suppPanelTitle}>Momento de consumo</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {MOMENTOS_CONSUMO.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[s.momentoOption, item.momento === m && s.momentoOptionActive]}
                        onPress={() => handleSaveMomento(item.id, m)}
                        disabled={savingMomento}
                      >
                        <Text
                          style={[s.momentoOptionText, item.momento === m && { color: COLORS.white }]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Hora editor */}
              {isEditingHora && (
                <View style={s.horaEditor}>
                  <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>
                    Nueva hora (24h, ej. 08:30):
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      value={editHora}
                      onChangeText={setEditHora}
                      placeholder="HH:MM"
                      placeholderTextColor={COLORS.muted}
                      keyboardType="numeric"
                      maxLength={5}
                      style={s.horaInput}
                      autoFocus
                    />
                    <TouchableOpacity
                      onPress={handleSaveHora}
                      disabled={savingHora}
                      style={s.horaGuardarBtn}
                      activeOpacity={0.85}
                    >
                      <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>
                        {savingHora ? '...' : 'Guardar'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingId(null)} style={s.horaCancelBtn}>
                      <Ionicons name="close" size={18} color={COLORS.muted} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Notas editor */}
              {isEditingNotas && (
                <View style={s.suppExpandPanel}>
                  <Text style={s.suppPanelTitle}>Nota personal</Text>
                  <TextInput
                    value={editNotas}
                    onChangeText={setEditNotas}
                    placeholder="Ej. Tomar con mucha agua..."
                    placeholderTextColor={COLORS.muted}
                    multiline
                    numberOfLines={3}
                    style={s.notasInput}
                    autoFocus
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={handleSaveNotas}
                      disabled={savingNotas}
                      style={s.horaGuardarBtn}
                      activeOpacity={0.85}
                    >
                      <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>
                        {savingNotas ? '...' : 'Guardar'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setNotasEditId(null)} style={s.horaCancelBtn}>
                      <Ionicons name="close" size={18} color={COLORS.muted} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
type TabKey = 'equivalentes' | 'recetas' | 'suplementacion'

export default function NutricionScreen() {
  const [tab, setTab] = useState<TabKey>('equivalentes')
  const { user } = useAuthStore()
  const { hasNewNutricion, markNutricionViewed } = useNewsStore()
  const [showNewBanner, setShowNewBanner] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (hasNewNutricion && user?.id) {
        setShowNewBanner(true)
        markNutricionViewed(user.id)
      }
    }, [hasNewNutricion, user?.id]),
  )

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'equivalentes', label: 'Equivalentes' },
    { key: 'recetas', label: 'Recetas' },
    { key: 'suplementacion', label: 'Suplementación' },
  ]

  return (
    <View style={s.container}>
      <AppHeader title={'Plan\nNutricional'} />

      {showNewBanner && (
        <View style={s.newsBanner}>
          <Ionicons name="sparkles" size={14} color="#1D4ED8" />
          <Text style={s.newsBannerText}>Tu nutriólogo actualizó tu plan nutricional</Text>
          <TouchableOpacity
            onPress={() => setShowNewBanner(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={14} color="#1D4ED8" />
          </TouchableOpacity>
        </View>
      )}

      <View style={s.innerTabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.innerTab, tab === t.key && s.innerTabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.innerTabText, tab === t.key && s.innerTabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'equivalentes' && <EquivalentesTab />}
      {tab === 'recetas' && <RecetasTab />}
      {tab === 'suplementacion' && <SuplementacionTab />}
    </View>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  newsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  newsBannerText: { flex: 1, fontSize: 13, color: '#1D4ED8', fontWeight: '500' },

  innerTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  innerTab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  innerTabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  innerTabText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  innerTabTextActive: { color: COLORS.primary, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, letterSpacing: -0.2 },

  // Equivalentes
  objetivoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  objetivoTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  objetivoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  objetivoIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: {
    width: '30%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  gridItemActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  gridLabel: { fontSize: 11, textAlign: 'center', color: COLORS.text, lineHeight: 15, fontWeight: '500' },
  totalBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  totalBadgeActive: { backgroundColor: COLORS.primary },
  totalBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.muted },
  expandedCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Recetas
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  mealSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  mealSectionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text, letterSpacing: -0.2 },
  mealCountBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  mealCountText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  recipeListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  recipeListEmoji: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeTagInline: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recipeTagInlineText: { fontSize: 10, color: COLORS.muted, fontWeight: '500' },

  // Suplementación
  progressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleNum: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  circleSub: { fontSize: 9, color: COLORS.muted, textAlign: 'center', lineHeight: 13 },
  notifBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifBarLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  notifDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notifDropdownText: { fontSize: 13, fontWeight: '500', color: COLORS.muted },
  notifPickerPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  notifPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  notifPickerOptionText: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  suppCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  suppCardDone: { backgroundColor: COLORS.completed, borderColor: '#BBF7D0' },
  suppIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suppChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suppChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  suppChipText: { fontSize: 11, fontWeight: '500', color: COLORS.muted },
  suppExpandPanel: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  suppPanelTitle: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  momentoOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  momentoOptionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  momentoOptionText: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  horaEditor: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  horaInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  horaGuardarBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  horaCancelBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notasInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minHeight: 80,
    textAlignVertical: 'top',
  },
})

const rm = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 160,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoChipText: { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: COLORS.completed,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontSize: 12, color: COLORS.completedText, fontWeight: '600' },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, letterSpacing: -0.2 },
  ingredientsList: { gap: 10 },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 7,
  },
  ingredientText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 20 },
  grupoTag: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  grupoTagText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepNumText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  stepText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 21 },
})
