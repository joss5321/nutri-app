import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AUTH_COLORS as PALETTE } from '@/constants/colors'
import { fetchNutricionistas, type Nutricionista } from '@/lib/api/nutricionistas'
import { fetchNutriologosDirectorio, type NutriologoDirectorio } from '@/lib/api/nutriologo-perfil'
import { NutriologoCard } from './NutriologoCard'
import { NutriologoProfileModal } from './NutriologoProfileModal'

interface NutriologoPickerModalProps {
  visible: boolean
  onClose: () => void
  onSeleccionar: (n: Nutricionista) => void
  currentNutricionistaId?: string | null
  guardando?: boolean
}

/** Reutiliza las mismas tarjetas/perfil del registro (NutriologoCard /
 * NutriologoProfileModal) para que un paciente ya logueado pueda elegir o
 * cambiar de nutriólogo desde Perfil, no solo durante el registro. */
export function NutriologoPickerModal({ visible, onClose, onSeleccionar, currentNutricionistaId, guardando }: NutriologoPickerModalProps) {
  const [nutricionistas, setNutricionistas] = useState<Nutricionista[]>([])
  const [loading, setLoading] = useState(true)
  const [directorio, setDirectorio] = useState<Map<string, NutriologoDirectorio>>(new Map())
  const [perfilAbierto, setPerfilAbierto] = useState<Nutricionista | null>(null)

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    fetchNutricionistas().then(setNutricionistas).catch(() => {}).finally(() => setLoading(false))
    fetchNutriologosDirectorio().then((rows) => setDirectorio(new Map(rows.map((r) => [r.id, r])))).catch(() => {})
  }, [visible])

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: PALETTE.bg }}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} disabled={guardando}>
              <Ionicons name="close" size={24} color={PALETTE.warmWhite} />
            </TouchableOpacity>
            <Text style={s.title}>Elegir nutriólogo</Text>
            <View style={{ width: 24 }} />
          </View>

          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={PALETTE.mint} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
              {guardando && (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={PALETTE.mint} />
                </View>
              )}
              {nutricionistas.map((n) => (
                <NutriologoCard
                  key={n.id}
                  nutricionista={n}
                  enriquecido={directorio.get(n.id)}
                  selected={n.id === currentNutricionistaId}
                  onSelect={() => !guardando && onSeleccionar(n)}
                  onVerPerfil={() => setPerfilAbierto(n)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      <NutriologoProfileModal
        visible={!!perfilAbierto}
        nutricionista={perfilAbierto}
        enriquecido={perfilAbierto ? directorio.get(perfilAbierto.id) : undefined}
        onClose={() => setPerfilAbierto(null)}
        onSeleccionar={() => {
          if (perfilAbierto) onSeleccionar(perfilAbierto)
          setPerfilAbierto(null)
        }}
      />
    </>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: PALETTE.hairline,
  },
  title: { fontWeight: '700', fontSize: 16, color: PALETTE.warmWhite },
})
