import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { AppHeader } from '@/components/ui/AppHeader'
import { COLORS } from '@/constants/colors'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const TABLE_DATA = [
  { mes: 'Ene', peso: '65 kg', altura: '155 cm', masa: '57%', cintura: '70 cm', cadera: '90 cm' },
  { mes: 'Feb', peso: '90 kg', altura: '175 cm', masa: '60%', cintura: '118 cm', cadera: '135 cm' },
  { mes: 'Mar', peso: '65 kg', altura: '155 cm', masa: '57%', cintura: '70 cm', cadera: '90 cm' },
  { mes: 'Abr', peso: '65 kg', altura: '155 cm', masa: '57%', cintura: '70 cm', cadera: '90 cm' },
  { mes: 'May', peso: '90 kg', altura: '175 cm', masa: '60%', cintura: '118 cm', cadera: '135 cm' },
  { mes: 'Jun', peso: '65 kg', altura: '155 cm', masa: '57%', cintura: '70 cm', cadera: '90 cm' },
  { mes: 'Jul', peso: '65 kg', altura: '155 cm', masa: '57%', cintura: '70 cm', cadera: '90 cm' },
  { mes: 'Ago', peso: '90 kg', altura: '175 cm', masa: '60%', cintura: '118 cm', cadera: '135 cm' },
  { mes: 'Sep', peso: '65 kg', altura: '155 cm', masa: '57%', cintura: '70 cm', cadera: '90 cm' },
  { mes: 'Oct', peso: '65 kg', altura: '155 cm', masa: '57%', cintura: '70 cm', cadera: '90 cm' },
  { mes: 'Nov', peso: '90 kg', altura: '175 cm', masa: '60%', cintura: '118 cm', cadera: '135 cm' },
]

function FormField({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.fieldLabel}>
        {label} {required && <Text style={{ color: COLORS.error }}>*</Text>}
      </Text>
      <TextInput style={s.fieldInput} keyboardType="numeric" />
    </View>
  )
}

function SimpleChart() {
  const values = [86.7, 85.2, 83.6]
  const max = 90
  return (
    <View style={{ height: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 40, paddingHorizontal: 20 }}>
      {values.map((v, i) => (
        <View key={i} style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: 11, color: COLORS.primary, marginBottom: 4 }}>{v}</Text>
          <View style={{
            width: 8, height: (v / max) * 60,
            backgroundColor: COLORS.primary, borderRadius: 4,
          }} />
          <Text style={{ fontSize: 10, color: COLORS.muted, marginTop: 4 }}>Mes {i + 1}</Text>
        </View>
      ))}
    </View>
  )
}

export default function ProgresoScreen() {
  const [hasData, setHasData] = useState(false)

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

  return (
    <View style={s.container}>
      <AppHeader title="Mi Progreso" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={s.tableNote}>Aquí puedes ver el resumen de tus datos mes a mes del monitoreo de tu progreso.</Text>

        {/* Filtro */}
        <View style={{ paddingHorizontal: 16 }}>
          <TouchableOpacity style={s.filterBtn}>
            <Text style={{ color: COLORS.primary, fontSize: 13 }}>📅  Todos los meses  ▾</Text>
          </TouchableOpacity>
        </View>

        {/* Tabla */}
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 12 }}>
          <View>
            <View style={s.tableHeader}>
              {['Mes', 'Peso (Kg)', 'Altura (Cm)', 'Masa Musc. %', 'Cintura (Cm)', 'Cadera (Cm)'].map(h => (
                <Text key={h} style={s.th}>{h}</Text>
              ))}
            </View>
            {TABLE_DATA.map((row, i) => (
              <View key={i} style={[s.tableRow, i % 2 === 0 && { backgroundColor: '#F0FAF5' }]}>
                <Text style={[s.td, { color: COLORS.primary, fontWeight: '700' }]}>{row.mes}</Text>
                <Text style={s.td}>{row.peso}</Text>
                <Text style={s.td}>{row.altura}</Text>
                <Text style={s.td}>{row.masa}</Text>
                <Text style={s.td}>{row.cintura}</Text>
                <Text style={s.td}>{row.cadera}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Card motivacional */}
        <View style={s.motivCard}>
          <Text style={{ fontSize: 18 }}>📈</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: COLORS.text }}>¡Sigue así!</Text>
            <Text style={{ fontSize: 12, color: COLORS.muted }}>Vas por buen camino. La constancia y una buena alimentación son clave para lograr tus objetivos.</Text>
          </View>
        </View>

        {/* Filtro gráfica */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, marginTop: 16 }}>
          <TouchableOpacity style={s.filterBtn}>
            <Text style={{ color: COLORS.primary, fontSize: 13 }}>📅  Últimos 3 meses  ▾</Text>
          </TouchableOpacity>
        </View>

        {/* Gráfica */}
        <View style={[s.card, { marginHorizontal: 16, marginBottom: 32 }]}>
          <Text style={{ fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>Evolución de medidas</Text>
          <Text style={{ fontSize: 11, color: COLORS.muted, marginBottom: 12 }}>Consulta cómo han cambiado tus principales medidas.</Text>
          <SimpleChart />
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            {[{ label: 'Peso (kg)', color: COLORS.primary }, { label: 'Talla (cm)', color: '#86EFAC' }, { label: 'IMM (%)', color: '#D1FAE5' }].map(l => (
              <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 12, height: 3, backgroundColor: l.color, borderRadius: 2 }} />
                <Text style={{ fontSize: 10, color: COLORS.muted }}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
    margin: 16,
  },
  cardNote: { color: COLORS.primary, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 8 },
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
  tableNote: { color: COLORS.muted, textAlign: 'center', fontSize: 13, marginTop: 12, marginBottom: 8, paddingHorizontal: 16 },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, alignSelf: 'flex-start',
    backgroundColor: COLORS.white,
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
    backgroundColor: '#F0FAF5', borderRadius: 12, padding: 14, marginHorizontal: 16, marginTop: 16,
  },
})
