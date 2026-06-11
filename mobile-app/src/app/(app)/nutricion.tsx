import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/ui/AppHeader'
import { COLORS } from '@/constants/colors'

// ─── EQUIVALENTES ────────────────────────────────────────────────────────────
const FOOD_GROUPS = [
  { icon: '🥣', label: 'Cereales\nsin grasa', num: 8 },
  { icon: '🍎', label: 'Frutas', num: 2 },
  { icon: '🥦', label: 'Verduras', num: 3 },
  { icon: '🥛', label: 'Leche\ndescremada', num: 1 },
  { icon: '🍗', label: 'POA muy bajo\naporte', num: 9 },
  { icon: '🐟', label: 'POA bajo\naporte', num: 4 },
  { icon: '🥩', label: 'POA medio\naporte', num: 2 },
  { icon: '🫒', label: 'Aceites y\ngrasas', num: 3 },
  { icon: '🫘', label: 'AC y C\nc/Proteina', num: 2 },
]

function EquivalentesTab() {
  const [expanded, setExpanded] = useState<string | null>('Cereales sin grasa')
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, gap: 14 }}>
        {/* Objetivo del mes */}
        <View style={s.objetivoCard}>
          <Text style={s.objetivoTitle}>Objetivo del mes</Text>
          <View style={s.objetivoRow}>
            <View style={s.objetivoIcon}><Text style={{ fontSize: 22 }}>🎯</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: COLORS.text }}>Déficit calórico</Text>
              <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                Consumir menos calorías de las que tu cuerpo gasta para favorecer la pérdida de grasa.
              </Text>
            </View>
          </View>
        </View>

        {/* Grid de grupos */}
        <View style={s.grid}>
          {FOOD_GROUPS.map((g, i) => (
            <TouchableOpacity
              key={i}
              style={s.gridItem}
              onPress={() => setExpanded(expanded === g.label.replace('\n', ' ') ? null : g.label.replace('\n', ' '))}
            >
              <Text style={{ fontSize: 36 }}>{g.icon}</Text>
              <Text style={s.gridLabel}>{g.label}</Text>
              <View style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: '700' }}>{g.num}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tabla expandida */}
        {expanded && (
          <View style={s.expandedCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 24 }}>🥣</Text>
                <Text style={{ fontWeight: '700', color: COLORS.text }}>{expanded}</Text>
              </View>
              <TouchableOpacity onPress={() => setExpanded(null)}>
                <Ionicons name="chevron-up" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
              <View style={{ flexDirection: 'row', backgroundColor: '#F0FAF5', padding: 8 }}>
                {['Desayuno', 'Colación 1', 'Comida', 'Colación 2', 'Cena'].map(h => (
                  <Text key={h} style={{ flex: 1, fontSize: 10, fontWeight: '700', textAlign: 'center', color: COLORS.primary }}>{h}</Text>
                ))}
              </View>
              <View style={{ flexDirection: 'row', padding: 10 }}>
                {['2', '1', '3', '1', '2'].map((v, i) => (
                  <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text }}>{v}</Text>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

// ─── RECETAS ─────────────────────────────────────────────────────────────────
const RECIPE_CATEGORIES = [
  { icon: '🌾', label: 'Cereales\nsin grasa' }, { icon: '🍎', label: 'Frutas' },
  { icon: '🥦', label: 'Verduras' }, { icon: '🥛', label: 'Leche\ndescremada' },
]

const FEATURED_RECIPES = [
  { emoji: '🥣', name: 'Avena con frutas frescas', tags: 'Cereales sin grasa • Frutas', time: '15 min', level: 'Fácil' },
  { emoji: '🥗', name: 'Ensalada de pollo con vegetales', tags: 'POA medio aporte • Verduras', time: '20 min', level: 'Fácil' },
  { emoji: '🥤', name: 'Batido de frutas con leche descremada', tags: 'Frutas • Leche descremada', time: '10 min', level: 'Fácil' },
]

const FOOD_GROUP_CARDS = [
  { emoji: '🥚', label: 'POA muy bajo aporte', sub: 'Opciones ligeras y bajas en grasa' },
  { emoji: '🐟', label: 'POA bajo aporte', sub: 'Proteínas magras para tu día a día' },
  { emoji: '🍗', label: 'POA medio aporte', sub: 'Proteínas para más energía y saciedad' },
  { emoji: '🫒', label: 'Aceites y grasas', sub: 'Usos saludables en tu alimentación' },
  { emoji: '🫘', label: 'AC y C C/Proteína', sub: 'Combinaciones completas y balanceadas' },
]

function RecetasTab() {
  const [activeFilter, setActiveFilter] = useState('Todos')
  const filters = ['Todos', ...RECIPE_CATEGORIES.map(r => r.label.replace('\n', ' '))]
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, gap: 16 }}>
        {/* Buscador */}
        <View style={s.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.muted} />
          <TextInput style={s.searchInput} placeholder="Buscar recetas o ingredientes..." placeholderTextColor={COLORS.muted} />
        </View>

        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['Todos', 'Cereales', 'Frutas', 'Verduras', 'Leche'].map(f => (
              <TouchableOpacity
                key={f}
                style={[s.filterChip, activeFilter === f && s.filterChipActive]}
                onPress={() => setActiveFilter(f)}
              >
                {f === 'Todos' && <Text style={{ fontSize: 16 }}>🌿</Text>}
                <Text style={[s.filterChipText, activeFilter === f && { color: COLORS.white }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Grupos */}
        <Text style={s.sectionTitle}>Explorar por grupo de alimentos</Text>
        <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: -10 }}>Elige un grupo para ver recetas deliciosas y balanceadas</Text>
        <View style={{ gap: 10 }}>
          {FOOD_GROUP_CARDS.map((g, i) => (
            <TouchableOpacity key={i} style={s.groupCard}>
              <View style={s.groupIcon}><Text style={{ fontSize: 24 }}>{g.emoji}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: COLORS.text }}>{g.label}</Text>
                <Text style={{ fontSize: 12, color: COLORS.muted }}>{g.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Recetas destacadas */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.sectionTitle}>Recetas destacadas</Text>
          <TouchableOpacity><Text style={{ color: COLORS.primary, fontSize: 13 }}>Ver todas</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {FEATURED_RECIPES.map((r, i) => (
              <View key={i} style={s.recipeCard}>
                <View style={s.recipeImage}><Text style={{ fontSize: 40 }}>{r.emoji}</Text></View>
                <TouchableOpacity style={s.heartBtn}><Ionicons name="heart-outline" size={16} color={COLORS.white} /></TouchableOpacity>
                <View style={{ padding: 10 }}>
                  <Text style={{ fontWeight: '600', fontSize: 13, color: COLORS.text }}>{r.name}</Text>
                  <View style={s.recipeTag}><Text style={s.recipeTagText}>{r.tags}</Text></View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <Text style={{ fontSize: 10, color: COLORS.muted }}>⏱ {r.time}</Text>
                    <Text style={{ fontSize: 10, color: COLORS.muted }}>📊 {r.level}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  )
}

// ─── SUPLEMENTACIÓN ──────────────────────────────────────────────────────────
const SUPPLEMENTS = [
  { icon: '🧴', name: 'Proteína en polvo', dose: '1 medida (30 g) con 250 ml de agua', time: '12:00 PM', when: 'Post entrenamiento', done: true },
  { icon: '⚗️', name: 'Aminoácidos (BCAA)', dose: '1 medida (5 g) con 250 ml de agua', time: '17:00 PM', when: 'Durante entrenamiento', done: false },
  { icon: '💊', name: 'Multivitamínico', dose: '1 cápsula con el desayuno', time: '08:00 AM', when: 'Con alimentos', done: true },
  { icon: '🐟', name: 'Omega 3', dose: '1 cápsula con la comida', time: '13:30 PM', when: 'Con alimentos', done: false },
]

function SuplementacionTab() {
  const [water, setWater] = useState(6)
  const [supp, setSupp] = useState(SUPPLEMENTS)

  const toggleSupp = (i: number) => {
    setSupp(prev => prev.map((s, idx) => idx === i ? { ...s, done: !s.done } : s))
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, gap: 14 }}>
        {/* Progress card */}
        <View style={s.progressCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View>
              <View style={s.circle}>
                <Text style={s.circleNum}>85%</Text>
                <Text style={s.circleSub}>Constancia{'\n'}semanal</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Tu racha</Text>
              <Text style={{ fontWeight: '800', fontSize: 22, color: COLORS.text }}>🔥 12 días</Text>
              <Text style={{ fontSize: 12, color: COLORS.muted }}>Seguidos tomando tus{'\n'}suplementos y agua</Text>
            </View>
            <Text style={{ fontSize: 40 }}>🥤</Text>
          </View>
        </View>

        {/* Suplementos de hoy */}
        <Text style={s.sectionTitle}>Suplementos de hoy</Text>
        {supp.map((item, i) => (
          <TouchableOpacity key={i} style={s.suppCard} onPress={() => toggleSupp(i)} activeOpacity={0.8}>
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

        {/* Agua */}
        <View style={s.waterCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View>
              <Text style={{ fontWeight: '700', color: COLORS.text }}>💧 Recordatorio de agua</Text>
              <Text style={{ fontSize: 12, color: COLORS.muted }}>¡No olvides mantenerte hidratado!</Text>
            </View>
            <TouchableOpacity style={s.addWaterBtn} onPress={() => setWater(w => Math.min(8, w + 1))}>
              <Text style={s.addWaterText}>+ Registrar vaso</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontWeight: '800', fontSize: 18, color: COLORS.text }}>{water} / 8</Text>
          <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>vasos de agua hoy</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setWater(i + 1)}>
                <Text style={{ fontSize: 22 }}>{i < water ? '🥛' : '🫙'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 8 }}>Meta diaria: 8 vasos (2L)</Text>
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
    { key: 'equivalentes', label: 'Equivalentes' },
    { key: 'recetas', label: 'Recetas' },
    { key: 'suplementacion', label: 'Suplementación' },
  ]

  return (
    <View style={s.container}>
      <AppHeader title={'Plan\nNutricional'} />
      {/* Tabs internos */}
      <View style={s.innerTabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.innerTab, tab === t.key && s.innerTabActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.innerTabText, tab === t.key && s.innerTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'equivalentes' && <EquivalentesTab />}
      {tab === 'recetas' && <RecetasTab />}
      {tab === 'suplementacion' && <SuplementacionTab />}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  innerTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white },
  innerTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  innerTabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  innerTabText: { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  innerTabTextActive: { color: COLORS.primary, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
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
    borderWidth: 1, borderColor: COLORS.border,
    padding: 10, alignItems: 'center', gap: 4,
  },
  gridLabel: { fontSize: 11, textAlign: 'center', color: COLORS.text, lineHeight: 15 },
  expandedCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white, borderRadius: 30, paddingHorizontal: 16, height: 46,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, color: COLORS.text },
  groupCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  groupIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.cardBg, justifyContent: 'center', alignItems: 'center',
  },
  recipeCard: { width: 180, backgroundColor: COLORS.white, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  recipeImage: { height: 110, backgroundColor: COLORS.cardBg, justifyContent: 'center', alignItems: 'center' },
  heartBtn: {
    position: 'absolute', top: 82, right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 4,
  },
  recipeTag: {
    backgroundColor: COLORS.cardBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4, alignSelf: 'flex-start',
  },
  recipeTagText: { fontSize: 9, color: COLORS.primary },
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
  waterCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
  },
  addWaterBtn: {
    backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  addWaterText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },
})
