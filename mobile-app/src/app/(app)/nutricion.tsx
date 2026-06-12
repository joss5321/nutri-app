import { useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/ui/AppHeader'
import { COLORS } from '@/constants/colors'

// ─── EQUIVALENTES ─────────────────────────────────────────────────────────────
const FOOD_GROUPS = [
  { icon: '🥣', label: 'Cereales\nsin grasa',  meals: [2, 1, 3, 1, 2] },
  { icon: '🍎', label: 'Frutas',               meals: [1, 1, 1, 1, 0] },
  { icon: '🥦', label: 'Verduras',             meals: [0, 0, 2, 0, 2] },
  { icon: '🥛', label: 'Leche\ndescremada',   meals: [1, 0, 0, 1, 0] },
  { icon: '🍗', label: 'POA muy bajo\naporte', meals: [0, 1, 2, 1, 2] },
  { icon: '🐟', label: 'POA bajo\naporte',     meals: [0, 0, 2, 0, 2] },
  { icon: '🥩', label: 'POA medio\naporte',    meals: [0, 0, 1, 0, 1] },
  { icon: '🫒', label: 'Aceites y\ngrasas',    meals: [1, 0, 2, 0, 1] },
  { icon: '🫘', label: 'AC y C\nc/Proteína',   meals: [0, 0, 1, 0, 1] },
]
const MEAL_LABELS = ['Desayuno', 'Colación 1', 'Comida', 'Colación 2', 'Cena']

function EquivalentesTab() {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0)

  const toggle = (i: number) => setExpandedIdx(prev => prev === i ? null : i)

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

        {/* Grid de grupos con total */}
        <View style={s.grid}>
          {FOOD_GROUPS.map((g, i) => {
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
        {expandedIdx !== null && (() => {
          const g = FOOD_GROUPS[expandedIdx]
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
                  {MEAL_LABELS.map(h => (
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
const RECIPES = [
  {
    emoji: '🥣', name: 'Avena con frutas frescas',
    tags: 'Cereales • Frutas', time: '15 min', level: 'Fácil',
    calories: '320 kcal', servings: '1 porción',
    ingredients: ['1 taza de avena', '200 ml de leche descremada', '1 plátano', '1 puñado de fresas', '1 cdta de miel'],
    steps: [
      'Calienta la leche en una olla a fuego medio.',
      'Agrega la avena y mezcla constantemente durante 5-7 minutos hasta que espese.',
      'Retira del fuego y sirve en un tazón.',
      'Corta el plátano en rodajas y las fresas a la mitad.',
      'Coloca las frutas sobre la avena y añade la miel al gusto.',
    ],
  },
  {
    emoji: '🥗', name: 'Ensalada de pollo con vegetales',
    tags: 'POA medio • Verduras', time: '20 min', level: 'Fácil',
    calories: '280 kcal', servings: '1 porción',
    ingredients: ['150 g de pechuga de pollo', '2 tazas de lechuga', '1 tomate', '½ pepino', '1 cdta de aceite de oliva', 'Sal y pimienta'],
    steps: [
      'Sazona el pollo con sal y pimienta por ambos lados.',
      'Cocina a la plancha a fuego medio-alto durante 8-10 minutos por lado.',
      'Deja reposar 5 minutos y córtalo en tiras.',
      'Lava y pica la lechuga, el tomate y el pepino.',
      'Mezcla todos los vegetales en un tazón grande.',
      'Agrega el pollo y aliña con aceite de oliva.',
    ],
  },
  {
    emoji: '🥤', name: 'Batido de frutas con leche',
    tags: 'Frutas • Leche descremada', time: '10 min', level: 'Fácil',
    calories: '210 kcal', servings: '1 vaso',
    ingredients: ['1 taza de leche descremada', '1 plátano', '½ taza de fresas', '½ taza de mango', 'Hielo al gusto'],
    steps: [
      'Lava y corta todas las frutas en trozos medianos.',
      'Coloca las frutas en la licuadora junto con la leche.',
      'Agrega hielo al gusto.',
      'Licúa durante 1 minuto hasta obtener una mezcla homogénea.',
      'Sirve inmediatamente en un vaso alto.',
    ],
  },
  {
    emoji: '🫘', name: 'Bowl de lentejas con verduras',
    tags: 'AC y C c/Proteína • Verduras', time: '30 min', level: 'Medio',
    calories: '380 kcal', servings: '1 porción',
    ingredients: ['½ taza de lentejas cocidas', '¼ cebolla', '2 jitomates', '1 zanahoria', 'Comino y ajo', '1 cdta de aceite'],
    steps: [
      'Sofríe la cebolla y el ajo en el aceite a fuego medio durante 2 minutos.',
      'Agrega el jitomate picado y cocina 5 minutos más.',
      'Incorpora la zanahoria en cubos y las lentejas cocidas.',
      'Sazona con comino, sal y pimienta al gusto.',
      'Cocina 10 minutos más hasta integrar todos los sabores.',
      'Sirve caliente.',
    ],
  },
  {
    emoji: '🍳', name: 'Omelette de claras con espinacas',
    tags: 'POA muy bajo aporte • Verduras', time: '12 min', level: 'Fácil',
    calories: '190 kcal', servings: '1 porción',
    ingredients: ['4 claras de huevo', '1 taza de espinacas', '¼ cebolla morada', '1 cdta de aceite', 'Sal y pimienta'],
    steps: [
      'Bate las claras con una pizca de sal hasta que estén espumosas.',
      'Calienta el aceite en una sartén antiadherente a fuego medio.',
      'Saltea la cebolla durante 2 minutos hasta que transparente.',
      'Agrega las espinacas y cocina 1 minuto más.',
      'Vierte las claras sobre las verduras y distribuye bien.',
      'Dobla el omelette a la mitad cuando los bordes estén cocidos y sirve.',
    ],
  },
  {
    emoji: '🫐', name: 'Yogurt griego con berries',
    tags: 'Leche descremada • Frutas', time: '5 min', level: 'Fácil',
    calories: '175 kcal', servings: '1 porción',
    ingredients: ['200 g de yogurt griego sin azúcar', '½ taza de moras azules', '¼ taza de frambuesas', '1 cdta de miel', '1 cda de granola'],
    steps: [
      'Coloca el yogurt en un tazón o vaso.',
      'Agrega las moras y frambuesas por encima.',
      'Añade la granola para dar textura crujiente.',
      'Rocía la miel al gusto.',
      'Sirve inmediatamente para que la granola no se ablande.',
    ],
  },
  {
    emoji: '🐟', name: 'Atún con aguacate y tostadas',
    tags: 'POA bajo aporte • Cereales', time: '10 min', level: 'Fácil',
    calories: '290 kcal', servings: '1 porción',
    ingredients: ['1 lata de atún en agua', '½ aguacate', '2 tostadas integrales', '1 cdta de limón', 'Sal y cilantro'],
    steps: [
      'Escurre bien el atún y colócalo en un tazón.',
      'Aplasta el aguacate con un tenedor hasta obtener una pasta.',
      'Mezcla el aguacate con el atún, el limón, sal y cilantro.',
      'Tuesta las tostadas o caliéntalas en el comal.',
      'Sirve la mezcla de atún sobre las tostadas.',
    ],
  },
  {
    emoji: '🥑', name: 'Tostadas con huevo estrellado',
    tags: 'Cereales sin grasa • POA muy bajo', time: '10 min', level: 'Fácil',
    calories: '240 kcal', servings: '1 porción',
    ingredients: ['2 rebanadas de pan integral', '2 huevos', '½ aguacate', '1 cdta de aceite', 'Chile en polvo y limón'],
    steps: [
      'Tuesta el pan en la tostadora o comal.',
      'Calienta el aceite en una sartén a fuego medio.',
      'Estrella los huevos con cuidado, sin romper las yemas.',
      'Cocina 2-3 minutos hasta que la clara esté bien cocida.',
      'Unta aguacate sobre el pan tostado.',
      'Coloca un huevo en cada tostada y sazona con chile y limón.',
    ],
  },
]

type Recipe = typeof RECIPES[number]

function RecipeDetailModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {/* Header del modal */}
        <View style={rm.header}>
          <TouchableOpacity style={rm.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={rm.headerTitle} numberOfLines={1}>{recipe.name}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Imagen / emoji hero */}
          <View style={rm.hero}>
            <Text style={{ fontSize: 72 }}>{recipe.emoji}</Text>
          </View>

          <View style={{ padding: 20, gap: 16 }}>
            {/* Info rápida */}
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

            {/* Tags */}
            <View style={rm.tagRow}>
              {recipe.tags.split(' • ').map((t, i) => (
                <View key={i} style={rm.tag}>
                  <Text style={rm.tagText}>{t}</Text>
                </View>
              ))}
            </View>

            {/* Ingredientes */}
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

            {/* Preparación */}
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
  const [search, setSearch]               = useState('')
  const [activeFilter, setActiveFilter]   = useState('Todos')
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)

  const filters = ['Todos', 'Cereales', 'Frutas', 'Verduras', 'Leche', 'Proteína']

  const filtered = RECIPES.filter(r => {
    const matchFilter = activeFilter === 'Todos' || r.tags.toLowerCase().includes(activeFilter.toLowerCase())
    const matchSearch = search === '' || r.name.toLowerCase().includes(search.toLowerCase()) || r.tags.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <>
      {selectedRecipe && (
        <RecipeDetailModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
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
