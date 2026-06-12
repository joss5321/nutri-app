import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { AppHeader } from '@/components/ui/AppHeader'
import { COLORS } from '@/constants/colors'

// ─── Dummy data por período ───────────────────────────────────────────────────
const DUMMY_DATA = {
  dias: {
    labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    peso:    [72.5, 72.3, 72.1, 71.8, 71.6, 71.4, 71.2],
    cintura: [88.0, 87.5, 87.2, 87.0, 86.8, 86.5, 86.2],
    cadera:  [98.0, 97.8, 97.5, 97.3, 97.0, 96.8, 96.5],
    imc:     [26.6, 26.6, 26.5, 26.4, 26.3, 26.2, 26.2],
  },
  semanas: {
    labels: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'],
    peso:    [75.0, 74.5, 74.0, 73.5, 73.0, 72.5, 72.0, 71.5],
    cintura: [92.0, 91.0, 90.0, 89.5, 89.0, 88.5, 87.5, 86.5],
    cadera:  [101.0, 100.5, 100.0, 99.5, 99.0, 98.5, 97.5, 97.0],
    imc:     [27.6, 27.4, 27.2, 27.0, 26.8, 26.6, 26.5, 26.3],
  },
  meses: {
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    peso:    [80.0, 78.5, 77.0, 75.5, 73.5, 71.5],
    cintura: [98.0, 96.0, 94.0, 92.0, 90.0, 86.5],
    cadera:  [108.0, 106.0, 104.0, 102.0, 100.0, 97.0],
    imc:     [29.4, 28.8, 28.3, 27.7, 27.0, 26.3],
  },
}

type TimePeriod = keyof typeof DUMMY_DATA
type MetricKey = 'peso' | 'cintura' | 'cadera' | 'imc'

const METRICS: { key: MetricKey; label: string; unit: string; color: string }[] = [
  { key: 'peso',    label: 'Peso',    unit: 'kg',    color: COLORS.primary },
  { key: 'cintura', label: 'Cintura', unit: 'cm',    color: '#60A5FA' },
  { key: 'cadera',  label: 'Cadera',  unit: 'cm',    color: '#F472B6' },
  { key: 'imc',     label: 'IMC',     unit: 'kg/m²', color: '#FBBF24' },
]

const TIME_PERIODS: { key: TimePeriod; label: string }[] = [
  { key: 'dias',    label: 'Días' },
  { key: 'semanas', label: 'Semanas' },
  { key: 'meses',   label: 'Meses' },
]

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const TABLE_DATA = [
  { mes: 'Ene', peso: '80.0', altura: '165', cintura: '98.0', cadera: '108.0', imc: '29.4' },
  { mes: 'Feb', peso: '78.5', altura: '165', cintura: '96.0', cadera: '106.0', imc: '28.8' },
  { mes: 'Mar', peso: '77.0', altura: '165', cintura: '94.0', cadera: '104.0', imc: '28.3' },
  { mes: 'Abr', peso: '75.5', altura: '165', cintura: '92.0', cadera: '102.0', imc: '27.7' },
  { mes: 'May', peso: '73.5', altura: '165', cintura: '90.0', cadera: '100.0', imc: '27.0' },
  { mes: 'Jun', peso: '71.5', altura: '165', cintura: '86.5', cadera: '97.0',  imc: '26.3' },
]

// ─── Componente LineChart (sin librerías externas) ────────────────────────────
function LineChart({
  values,
  labels,
  color,
  unit,
  width,
}: {
  values: number[]
  labels: string[]
  color: string
  unit: string
  width: number
}) {
  const CHART_H = 140
  const PAD_L   = 46
  const PAD_R   = 8
  const PAD_B   = 22
  const PAD_T   = 10

  const plotW = width - PAD_L - PAD_R
  const plotH = CHART_H - PAD_T - PAD_B

  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const pad    = (rawMax - rawMin) * 0.15 || 1
  const dMin   = rawMin - pad
  const dMax   = rawMax + pad
  const dRange = dMax - dMin

  const getY = (v: number) => PAD_T + (1 - (v - dMin) / dRange) * plotH
  const getX = (i: number) =>
    PAD_L + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW)

  const points = values.map((v, i) => ({ x: getX(i), y: getY(v), v }))
  const yTicks = [dMax, (dMax + dMin) / 2, dMin]

  return (
    <View style={{ height: CHART_H, position: 'relative' }}>
      {/* Y-axis labels */}
      {yTicks.map((t, i) => (
        <Text key={i} style={{
          position: 'absolute',
          left: 0,
          top: getY(t) - 7,
          width: PAD_L - 6,
          textAlign: 'right',
          fontSize: 9,
          color: COLORS.muted,
        }}>
          {Number.isInteger(t) ? t : t.toFixed(1)}
        </Text>
      ))}

      {/* Horizontal grid lines */}
      {yTicks.map((t, i) => (
        <View key={i} style={{
          position: 'absolute',
          left: PAD_L,
          right: PAD_R,
          top: getY(t),
          height: 1,
          backgroundColor: '#E5E7EB',
        }} />
      ))}

      {/* Área sombreada bajo la línea (relleno con tiras verticales) */}
      {points.map((pt, i) => (
        <View key={`fill-${i}`} style={{
          position: 'absolute',
          left: pt.x - (plotW / (values.length * 2)),
          top: pt.y,
          width: plotW / values.length,
          height: CHART_H - PAD_B - pt.y,
          backgroundColor: color,
          opacity: 0.08,
        }} />
      ))}

      {/* Líneas conectoras */}
      {points.slice(0, -1).map((pt, i) => {
        const nx = points[i + 1].x
        const ny = points[i + 1].y
        const dx = nx - pt.x
        const dy = ny - pt.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)
        return (
          <View key={`line-${i}`} style={{
            position: 'absolute',
            left: (pt.x + nx) / 2 - len / 2,
            top:  (pt.y + ny) / 2 - 1.5,
            width: len,
            height: 3,
            backgroundColor: color,
            borderRadius: 2,
            transform: [{ rotateZ: `${angle}deg` }],
          }} />
        )
      })}

      {/* Puntos */}
      {points.map((pt, i) => (
        <View key={`dot-${i}`} style={{
          position: 'absolute',
          left: pt.x - 5,
          top: pt.y - 5,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: COLORS.white,
          elevation: 2,
          shadowColor: color,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 3,
        }}>
          {/* Tooltip con valor */}
          <Text style={{
            position: 'absolute',
            top: -16,
            left: -12,
            width: 34,
            textAlign: 'center',
            fontSize: 8,
            color,
            fontWeight: '700',
          }}>
            {pt.v % 1 === 0 ? pt.v : pt.v.toFixed(1)}
          </Text>
        </View>
      ))}

      {/* X-axis labels */}
      {points.map((pt, i) => (
        <Text key={`xl-${i}`} style={{
          position: 'absolute',
          left: pt.x - 16,
          top: CHART_H - PAD_B + 5,
          width: 32,
          textAlign: 'center',
          fontSize: 9,
          color: COLORS.muted,
        }}>
          {labels[i]}
        </Text>
      ))}
    </View>
  )
}

// ─── Campo del formulario ─────────────────────────────────────────────────────
function FormField({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.fieldLabel}>
        {label}{required && <Text style={{ color: COLORS.error }}> *</Text>}
      </Text>
      <TextInput style={s.fieldInput} keyboardType="numeric" />
    </View>
  )
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function ProgresoScreen() {
  const [hasData, setHasData]       = useState(false)
  const [period, setPeriod]         = useState<TimePeriod>('semanas')
  const [metric, setMetric]         = useState<MetricKey>('peso')
  const [chartWidth, setChartWidth] = useState(0)

  const data      = DUMMY_DATA[period]
  const metricCfg = METRICS.find(m => m.key === metric)!
  const values    = data[metric] as number[]
  const latest    = values[values.length - 1]
  const first     = values[0]
  const delta     = latest - first

  // ── Vista: sin datos (formulario inicial) ───────────────────────────────────
  if (!hasData) {
    return (
      <View style={s.container}>
        <AppHeader title="Mi Progreso" />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <View style={s.card}>
            <Text style={s.cardNote}>
              Antes de comenzar es necesario que proporciones los siguientes datos para poder monitorear mejor tu progreso.
            </Text>

            <View style={[s.row,{ alignItems: 'flex-end' }]}>
              <FormField label="Sexo" required />
              <FormField label="Edad" required />
              <FormField label="Peso" required />
            </View>
            <View style={[s.row2,{ alignItems: 'flex-end' }]}>
              <FormField label="Circunferencia de cintura" required />
              <FormField label="Circunferencia de cadera" required />
            </View>
            <View style={[s.row2,{ alignItems: 'flex-end' }]}>
              <FormField label="Porcentaje de Masa Muscular" />
              <FormField label="Altura" required />
            </View>
            <View style={[s.row2,{ alignItems: 'flex-end' }]}>
              <FormField label="Porcentaje de Grasa" />
              <FormField label="Circunferencia de Brazo" />
            </View>
            <View style={[s.row2,{ alignItems: 'flex-end' }]}>
              <FormField label="Circunferencia de Pantorrilla" />
              <View style={{ flex: 1 }} />
            </View>

            <TouchableOpacity style={s.sendBtn} onPress={() => setHasData(true)} activeOpacity={0.85}>
              <Text style={s.sendBtnText}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    )
  }

  // ── Vista: con datos (tabla + gráfica) ─────────────────────────────────────
  return (
    <View style={s.container}>
      <AppHeader title="Mi Progreso" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        <Text style={s.tableNote}>
          Aquí puedes ver el resumen de tus datos mes a mes del{'\n'}monitoreo de tu progreso.
        </Text>

        {/* Tabla */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <View>
            <View style={s.tableHeader}>
              {['Mes', 'Peso (kg)', 'Altura (cm)', 'Cintura (cm)', 'Cadera (cm)', 'IMC'].map(h => (
                <Text key={h} style={s.th}>{h}</Text>
              ))}
            </View>
            {TABLE_DATA.map((row, i) => (
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

        {/* ─── Gráfica ─────────────────────────────────────────────────────── */}
        <View style={[s.card, { marginTop: 20 }]}>
          <Text style={s.chartTitle}>Evolución de medidas</Text>

          {/* Selector de métrica (eje Y) */}
          <View style={s.metricRow}>
            {METRICS.map(m => (
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

          {/* Selector de período (eje X) */}
          <View style={s.periodSelector}>
            {TIME_PERIODS.map(tp => (
              <TouchableOpacity
                key={tp.key}
                style={[s.periodBtn, period === tp.key && s.periodBtnActive]}
                onPress={() => setPeriod(tp.key)}
                activeOpacity={0.75}
              >
                <Text style={[s.periodBtnText, period === tp.key && s.periodBtnTextActive]}>
                  {tp.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Resumen del período */}
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>{latest.toFixed(1)}</Text>
              <Text style={s.summaryLabel}>Actual ({metricCfg.unit})</Text>
            </View>
            <View style={[s.summaryDivider]} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryValue, { color: delta <= 0 ? '#10B981' : COLORS.error }]}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
              </Text>
              <Text style={s.summaryLabel}>Cambio total</Text>
            </View>
            <View style={[s.summaryDivider]} />
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>{first.toFixed(1)}</Text>
              <Text style={s.summaryLabel}>Inicio ({metricCfg.unit})</Text>
            </View>
          </View>

          {/* Gráfica */}
          <View
            style={s.chartArea}
            onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
          >
            {chartWidth > 0 && (
              <LineChart
                values={values}
                labels={data.labels}
                color={metricCfg.color}
                unit={metricCfg.unit}
                width={chartWidth}
              />
            )}
          </View>

          {/* Unidad */}
          <Text style={s.unitLabel}>Unidad: {metricCfg.unit}</Text>
        </View>

      </ScrollView>
    </View>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
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

  row:  { flexDirection: 'row', gap: 8 },
  row2: { flexDirection: 'row', gap: 8 },

  fieldLabel: { fontSize: 11, color: COLORS.text, marginBottom: 4 },
  fieldInput: {
    height: 40, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 8, fontSize: 14, color: COLORS.text,
  },

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

  // Gráfica
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

  periodSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    padding: 3,
  },
  periodBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: COLORS.white, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 2,
  },
  periodBtnText: { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  periodBtnTextActive: { color: COLORS.primary, fontWeight: '700' },

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
