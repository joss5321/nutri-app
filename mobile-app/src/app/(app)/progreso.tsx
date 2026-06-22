import { useCallback, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { AppHeader } from '@/components/ui/AppHeader'
import { COLORS } from '@/constants/colors'
import { useAuthStore } from '@/store/auth'
import { updateMiPerfil } from '@/lib/api/perfiles'
import { fetchUltimaMedida, fetchMedidasHistorial, createMedida, type Medida } from '@/lib/api/medidas'

// ─── Helpers ─────────────────────────────────────────────────────────────────
type MetricKey = 'peso' | 'cintura' | 'cadera' | 'imc'

const METRICS: { key: MetricKey; label: string; unit: string; color: string }[] = [
  { key: 'peso',    label: 'Peso',    unit: 'kg',    color: COLORS.primary },
  { key: 'cintura', label: 'Cintura', unit: 'cm',    color: '#60A5FA' },
  { key: 'cadera',  label: 'Cadera',  unit: 'cm',    color: '#F472B6' },
  { key: 'imc',     label: 'IMC',     unit: 'kg/m²', color: '#FBBF24' },
]

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function metricsFromHistorial(historial: Medida[]) {
  const labels = historial.map((m) => {
    const [, month] = m.fecha.split('-').map(Number)
    return MONTH_SHORT[month - 1]
  })
  return {
    labels,
    peso: historial.map((m) => m.peso_kg ?? 0),
    cintura: historial.map((m) => m.cintura_cm ?? 0),
    cadera: historial.map((m) => m.cadera_cm ?? 0),
    imc: historial.map((m) => m.imc ?? 0),
  }
}

function tableFromHistorial(historial: Medida[], alturaCm: number | null) {
  return historial.map((m) => {
    const [, month] = m.fecha.split('-').map(Number)
    return {
      mes: MONTH_SHORT[month - 1],
      peso: m.peso_kg?.toFixed(1) ?? '—',
      altura: alturaCm != null ? String(alturaCm) : '—',
      cintura: m.cintura_cm?.toFixed(1) ?? '—',
      cadera: m.cadera_cm?.toFixed(1) ?? '—',
      imc: m.imc?.toFixed(1) ?? '—',
    }
  })
}

const SEXO_OPTIONS = ['Femenino', 'Masculino', 'Otro'] as const
const SEXO_MAP: Record<string, string> = {
  Femenino: 'femenino',
  Masculino: 'masculino',
  Otro: 'otro',
}

// ─── LineChart ───────────────────────────────────────────────────────────────
function LineChart({
  values,
  labels,
  color,
  width,
}: {
  values: number[]
  labels: string[]
  color: string
  unit: string
  width: number
}) {
  if (values.length === 0) return null
  const CHART_H = 140
  const PAD_L = 46, PAD_R = 8, PAD_B = 22, PAD_T = 10
  const plotW = width - PAD_L - PAD_R
  const plotH = CHART_H - PAD_T - PAD_B

  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const pad = (rawMax - rawMin) * 0.15 || 1
  const dMin = rawMin - pad, dMax = rawMax + pad, dRange = dMax - dMin

  const getY = (v: number) => PAD_T + (1 - (v - dMin) / dRange) * plotH
  const getX = (i: number) => PAD_L + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW)
  const points = values.map((v, i) => ({ x: getX(i), y: getY(v), v }))
  const yTicks = [dMax, (dMax + dMin) / 2, dMin]

  return (
    <View style={{ height: CHART_H, position: 'relative' }}>
      {yTicks.map((t, i) => (
        <Text key={i} style={{ position: 'absolute', left: 0, top: getY(t) - 7, width: PAD_L - 6, textAlign: 'right', fontSize: 9, color: COLORS.muted }}>
          {Number.isInteger(t) ? t : t.toFixed(1)}
        </Text>
      ))}
      {yTicks.map((t, i) => (
        <View key={`g${i}`} style={{ position: 'absolute', left: PAD_L, right: PAD_R, top: getY(t), height: 1, backgroundColor: '#E5E7EB' }} />
      ))}
      {points.map((pt, i) => (
        <View key={`f${i}`} style={{ position: 'absolute', left: pt.x - (plotW / (values.length * 2)), top: pt.y, width: plotW / values.length, height: CHART_H - PAD_B - pt.y, backgroundColor: color, opacity: 0.08 }} />
      ))}
      {points.slice(0, -1).map((pt, i) => {
        const nx = points[i + 1].x, ny = points[i + 1].y
        const dx = nx - pt.x, dy = ny - pt.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)
        return (
          <View key={`l${i}`} style={{ position: 'absolute', left: (pt.x + nx) / 2 - len / 2, top: (pt.y + ny) / 2 - 1.5, width: len, height: 3, backgroundColor: color, borderRadius: 2, transform: [{ rotateZ: `${angle}deg` }] }} />
        )
      })}
      {points.map((pt, i) => (
        <View key={`d${i}`} style={{ position: 'absolute', left: pt.x - 5, top: pt.y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: color, borderWidth: 2, borderColor: COLORS.white, elevation: 2, shadowColor: color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 3 }}>
          <Text style={{ position: 'absolute', top: -16, left: -12, width: 34, textAlign: 'center', fontSize: 8, color, fontWeight: '700' }}>
            {pt.v % 1 === 0 ? pt.v : pt.v.toFixed(1)}
          </Text>
        </View>
      ))}
      {points.map((pt, i) => (
        <Text key={`xl${i}`} style={{ position: 'absolute', left: pt.x - 16, top: CHART_H - PAD_B + 5, width: 32, textAlign: 'center', fontSize: 9, color: COLORS.muted }}>
          {labels[i]}
        </Text>
      ))}
    </View>
  )
}

// ─── FormField ───────────────────────────────────────────────────────────────
function FormField({
  label,
  required = false,
  value,
  onChangeText,
}: {
  label: string
  required?: boolean
  value: string
  onChangeText: (t: string) => void
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.fieldLabel}>
        {label}{required && <Text style={{ color: COLORS.error }}> *</Text>}
      </Text>
      <TextInput
        style={s.fieldInput}
        keyboardType="numeric"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  )
}

// ─── Pantalla principal ─────────────────────────────────────────────────────
export default function ProgresoScreen() {
  const { user } = useAuthStore()
  const userId = user?.id ?? ''

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasData, setHasData] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [historial, setHistorial] = useState<Medida[]>([])
  const [alturaCm, setAlturaCm] = useState<number | null>(null)

  // Form state
  const [sexo, setSexo] = useState('Femenino')
  const [edad, setEdad] = useState('')
  const [peso, setPeso] = useState('')
  const [altura, setAltura] = useState('')
  const [cintura, setCintura] = useState('')
  const [cadera, setCadera] = useState('')
  const [masaMuscular, setMasaMuscular] = useState('')
  const [grasa, setGrasa] = useState('')
  const [brazo, setBrazo] = useState('')
  const [pantorrilla, setPantorrilla] = useState('')

  // Chart state
  const [metric, setMetric] = useState<MetricKey>('peso')
  const [chartWidth, setChartWidth] = useState(0)

  const loadData = useCallback((isRefresh = false) => {
    if (!userId) return
    if (isRefresh) setRefreshing(true); else setLoading(true)
    fetchUltimaMedida(userId)
      .then((medida) => {
        if (medida) {
          setHasData(true)
          setAlturaCm(null)
          fetchMedidasHistorial(userId).then(setHistorial)
        }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [userId])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const handleSubmit = async () => {
    if (!userId) return
    setSaving(true)
    setError(null)
    try {
      const pesoNum = parseFloat(peso)
      const alturaNum = parseFloat(altura)
      const imcVal = pesoNum > 0 && alturaNum > 0 ? pesoNum / Math.pow(alturaNum / 100, 2) : null

      const birthYear = new Date().getFullYear() - (parseInt(edad) || 0)
      const fechaNacimiento = edad.trim() ? `${birthYear}-01-01` : null

      await updateMiPerfil(userId, {
        sexo: SEXO_MAP[sexo] ?? 'otro',
        fecha_nacimiento: fechaNacimiento,
        altura_cm: alturaNum > 0 ? alturaNum : null,
      })

      await createMedida(userId, {
        fecha: new Date().toISOString().slice(0, 10),
        peso_kg: pesoNum > 0 ? pesoNum : null,
        cintura_cm: cintura.trim() ? Number(cintura) : null,
        cadera_cm: cadera.trim() ? Number(cadera) : null,
        masa_muscular_pct: masaMuscular.trim() ? Number(masaMuscular) : null,
        grasa_pct: grasa.trim() ? Number(grasa) : null,
        brazo_cm: brazo.trim() ? Number(brazo) : null,
        pantorrilla_cm: pantorrilla.trim() ? Number(pantorrilla) : null,
        imc: imcVal != null ? Number(imcVal.toFixed(2)) : null,
      })

      setAlturaCm(alturaNum > 0 ? alturaNum : null)
      const h = await fetchMedidasHistorial(userId)
      setHistorial(h)
      setHasData(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la información.')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.container}>
        <AppHeader title="Mi Progreso" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    )
  }

  // ── Vista: sin datos (formulario inicial) ─────────────────────────────────
  if (!hasData) {
    return (
      <View style={s.container}>
        <AppHeader title="Mi Progreso" />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <View style={s.card}>
            <Text style={s.cardNote}>
              Antes de comenzar es necesario que proporciones los siguientes datos para poder monitorear mejor tu progreso.
            </Text>

            {/* Sexo selector */}
            <View>
              <Text style={s.fieldLabel}>
                Sexo<Text style={{ color: COLORS.error }}> *</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {SEXO_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.sexoBtn, sexo === opt && s.sexoBtnActive]}
                    onPress={() => setSexo(opt)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.sexoBtnText, sexo === opt && s.sexoBtnTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[s.row, { alignItems: 'flex-end' }]}>
              <FormField label="Edad" required value={edad} onChangeText={setEdad} />
              <FormField label="Peso (kg)" required value={peso} onChangeText={setPeso} />
            </View>
            <View style={[s.row, { alignItems: 'flex-end' }]}>
              <FormField label="Altura (cm)" required value={altura} onChangeText={setAltura} />
              <FormField label="Cintura (cm)" required value={cintura} onChangeText={setCintura} />
            </View>
            <View style={[s.row, { alignItems: 'flex-end' }]}>
              <FormField label="Cadera (cm)" required value={cadera} onChangeText={setCadera} />
              <FormField label="% Masa Muscular" value={masaMuscular} onChangeText={setMasaMuscular} />
            </View>
            <View style={[s.row, { alignItems: 'flex-end' }]}>
              <FormField label="% Grasa" value={grasa} onChangeText={setGrasa} />
              <FormField label="Brazo (cm)" value={brazo} onChangeText={setBrazo} />
            </View>
            <View style={[s.row, { alignItems: 'flex-end' }]}>
              <FormField label="Pantorrilla (cm)" value={pantorrilla} onChangeText={setPantorrilla} />
              <View style={{ flex: 1 }} />
            </View>

            {error && <Text style={{ color: COLORS.error, fontSize: 13, textAlign: 'center' }}>{error}</Text>}

            <TouchableOpacity
              style={[s.sendBtn, saving && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={s.sendBtnText}>{saving ? 'Guardando...' : 'Enviar'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    )
  }

  // ── Vista: con datos (tabla + gráfica) ────────────────────────────────────
  const chartData = metricsFromHistorial(historial)
  const values = chartData[metric] as number[]
  const metricCfg = METRICS.find((m) => m.key === metric)!
  const latest = values.length > 0 ? values[values.length - 1] : 0
  const first = values.length > 0 ? values[0] : 0
  const delta = latest - first
  const tableData = tableFromHistorial(historial, alturaCm)

  return (
    <View style={s.container}>
      <AppHeader title="Mi Progreso" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[COLORS.primary]} tintColor={COLORS.primary} />}>
        <Text style={s.tableNote}>
          Aquí puedes ver el resumen de tus datos del{'\n'}monitoreo de tu progreso.
        </Text>

        {/* Tabla */}
        {tableData.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View>
              <View style={s.tableHeader}>
                {['Mes', 'Peso (kg)', 'Altura (cm)', 'Cintura (cm)', 'Cadera (cm)', 'IMC'].map((h) => (
                  <Text key={h} style={s.th}>{h}</Text>
                ))}
              </View>
              {tableData.map((row, i) => (
                <View key={i} style={[s.tableRow, i % 2 === 0 && { backgroundColor: '#F0FAF5' }]}>
                  <Text style={[s.td, { color: COLORS.primary, fontWeight: '700' }]}>{row.mes}</Text>
                  <Text style={s.td}>{row.peso}</Text>
                  <Text style={s.td}>{row.altura}</Text>
                  <Text style={s.td}>{row.cintura}</Text>
                  <Text style={s.td}>{row.cadera}</Text>
                  <Text style={s.td}>{row.imc}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Card motivacional */}
        <View style={s.motivCard}>
          <Text style={{ fontSize: 18 }}>📈</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: COLORS.text }}>¡Sigue así!</Text>
            <Text style={{ fontSize: 12, color: COLORS.muted }}>
              Vas por buen camino. La constancia y una buena alimentación son clave.
            </Text>
          </View>
        </View>

        {/* ─── Gráfica ──────────────────────────────────────────────────── */}
        {values.length > 1 && (
          <View style={[s.card, { marginTop: 20 }]}>
            <Text style={s.chartTitle}>Evolución de medidas</Text>

            <View style={s.metricRow}>
              {METRICS.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[s.metricPill, metric === m.key && { backgroundColor: m.color, borderColor: m.color }]}
                  onPress={() => setMetric(m.key)}
                  activeOpacity={0.75}
                >
                  <View style={[s.metricDot, { backgroundColor: metric === m.key ? COLORS.white : m.color }]} />
                  <Text style={[s.metricLabel, metric === m.key && { color: COLORS.white, fontWeight: '700' }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={s.summaryValue}>{latest.toFixed(1)}</Text>
                <Text style={s.summaryLabel}>Actual ({metricCfg.unit})</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryValue, { color: delta <= 0 ? '#10B981' : COLORS.error }]}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                </Text>
                <Text style={s.summaryLabel}>Cambio total</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryValue}>{first.toFixed(1)}</Text>
                <Text style={s.summaryLabel}>Inicio ({metricCfg.unit})</Text>
              </View>
            </View>

            <View style={s.chartArea} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
              {chartWidth > 0 && (
                <LineChart
                  values={values}
                  labels={chartData.labels}
                  color={metricCfg.color}
                  unit={metricCfg.unit}
                  width={chartWidth}
                />
              )}
            </View>

            <Text style={s.unitLabel}>Unidad: {metricCfg.unit}</Text>
          </View>
        )}

        {values.length <= 1 && (
          <View style={[s.card, { marginTop: 20, alignItems: 'center', paddingVertical: 32 }]}>
            <Text style={{ fontSize: 32 }}>📊</Text>
            <Text style={{ color: COLORS.muted, fontSize: 13, textAlign: 'center', marginTop: 8 }}>
              Aún no hay suficientes datos para mostrar gráficas.{'\n'}Las gráficas aparecerán cuando tengas más registros.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Estilos ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
    marginHorizontal: 16,
  },
  cardNote: { color: COLORS.primary, textAlign: 'center', fontSize: 13, lineHeight: 20 },

  row: { flexDirection: 'row', gap: 8 },

  fieldLabel: { fontSize: 11, color: COLORS.text, marginBottom: 4 },
  fieldInput: {
    height: 40, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 8, fontSize: 14, color: COLORS.text,
  },

  sexoBtn: {
    flex: 1, height: 40, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white,
  },
  sexoBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sexoBtnText: { fontSize: 13, color: COLORS.text },
  sexoBtnTextActive: { color: COLORS.white, fontWeight: '700' },

  sendBtn: {
    backgroundColor: COLORS.primary, borderRadius: 50,
    height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  sendBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },

  tableNote: {
    color: COLORS.muted, textAlign: 'center', fontSize: 13,
    marginTop: 12, marginBottom: 8, paddingHorizontal: 16,
  },
  tableHeader: {
    flexDirection: 'row', backgroundColor: COLORS.primary,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  th: { width: 100, textAlign: 'center', color: COLORS.white, fontWeight: '700', fontSize: 11 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 4 },
  td: { width: 100, textAlign: 'center', fontSize: 13, color: COLORS.text },

  motivCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: '#F0FAF5', borderRadius: 12, padding: 14,
    marginHorizontal: 16, marginTop: 16,
  },

  chartTitle: { fontWeight: '800', fontSize: 15, color: COLORS.text },

  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  metricDot: { width: 8, height: 8, borderRadius: 4 },
  metricLabel: { fontSize: 12, color: COLORS.text },

  summaryRow: {
    flexDirection: 'row', backgroundColor: COLORS.cardBg,
    borderRadius: 12, padding: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  summaryLabel: { fontSize: 10, color: COLORS.muted, textAlign: 'center' },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  chartArea: { minHeight: 150 },
  unitLabel: { textAlign: 'right', fontSize: 10, color: COLORS.muted, marginTop: -4 },
})
