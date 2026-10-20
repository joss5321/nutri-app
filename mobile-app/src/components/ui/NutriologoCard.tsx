import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { AUTH_COLORS as PALETTE } from '@/constants/colors'
import type { Nutricionista } from '@/lib/api/nutricionistas'
import type { NutriologoDirectorio } from '@/lib/api/nutriologo-perfil'

const MODALIDAD_LABEL: Record<string, string> = {
  presencial: 'Presencial',
  online: 'En línea',
  ambas: 'Presencial / En línea',
}

interface NutriologoCardProps {
  nutricionista: Nutricionista
  enriquecido?: NutriologoDirectorio
  selected: boolean
  onSelect: () => void
  onVerPerfil: () => void
}

export function NutriologoCard({ nutricionista, enriquecido, selected, onSelect, onVerPerfil }: NutriologoCardProps) {
  const fotoUrl = enriquecido?.foto_portada_url ?? nutricionista.avatar_url
  const subtitulo = enriquecido?.titulo_profesional
    || (enriquecido?.especialidades && enriquecido.especialidades.length > 0 ? enriquecido.especialidades.join(' · ') : null)
  const descripcion = enriquecido?.descripcion_corta
  const modalidadLabel = enriquecido?.modalidad ? MODALIDAD_LABEL[enriquecido.modalidad] : null
  const precioDesde = enriquecido?.precio_desde

  return (
    <TouchableOpacity
      style={[s.card, selected && s.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {fotoUrl ? (
          <Image source={{ uri: fotoUrl }} style={s.avatar} contentFit="cover" />
        ) : (
          <View style={[s.avatar, s.avatarPlaceholder, selected && { backgroundColor: PALETTE.mint }]}>
            <Ionicons name="person" size={22} color={selected ? PALETTE.onMint : PALETTE.mutedMint} />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.name, selected && { color: PALETTE.mint }]} numberOfLines={1}>
              {nutricionista.nombre_completo ?? 'Nutriólogo'}
            </Text>
            {enriquecido?.verificado && (
              <Ionicons name="checkmark-circle" size={15} color={PALETTE.mint} />
            )}
          </View>
          {subtitulo && (
            <Text style={s.subtitle} numberOfLines={1}>{subtitulo}</Text>
          )}
          {!subtitulo && nutricionista.email && (
            <Text style={s.subtitle} numberOfLines={1}>{nutricionista.email}</Text>
          )}
        </View>

        <View style={[s.radioCircle, selected && s.radioCircleSelected]}>
          {selected && <View style={s.radioDot} />}
        </View>
      </View>

      {descripcion && (
        <Text style={s.description} numberOfLines={2}>{descripcion}</Text>
      )}

      {(modalidadLabel || precioDesde != null) && (
        <View style={s.metaRow}>
          {modalidadLabel && (
            <View style={s.chip}>
              <Ionicons name="location-outline" size={12} color={PALETTE.mutedMint} />
              <Text style={s.chipText}>{modalidadLabel}</Text>
            </View>
          )}
          {precioDesde != null && (
            <View style={[s.chip, s.chipPrice]}>
              <Text style={[s.chipText, { color: PALETTE.mint, fontWeight: '700' }]}>
                Consulta desde ${precioDesde} MXN
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={s.actionsRow}>
        <TouchableOpacity
          style={s.outlineBtn}
          onPress={(e) => { e.stopPropagation(); onVerPerfil() }}
          activeOpacity={0.75}
        >
          <Text style={s.outlineBtnText}>Ver perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.selectBtn, selected && { backgroundColor: PALETTE.mint }]}
          onPress={(e) => { e.stopPropagation(); onSelect() }}
          activeOpacity={0.85}
        >
          <Text style={[s.selectBtnText, selected && { color: PALETTE.onMint }]}>
            {selected ? 'Seleccionado' : 'Seleccionar'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.bgElevated, borderRadius: 16, padding: 14, gap: 10,
    borderWidth: 1, borderColor: PALETTE.hairline,
  },
  cardSelected: { borderColor: PALETTE.mint, backgroundColor: PALETTE.mintSoft },
  avatar: { width: 52, height: 52, borderRadius: 14 },
  avatarPlaceholder: {
    backgroundColor: 'rgba(247,245,240,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  name: { fontWeight: '700', fontSize: 15, color: PALETTE.warmWhite, flexShrink: 1 },
  subtitle: { fontSize: 12, color: PALETTE.mutedMint, marginTop: 2 },
  description: { fontSize: 12.5, color: PALETTE.mutedMint, lineHeight: 18 },
  radioCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: PALETTE.hairline,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  radioCircleSelected: { borderColor: PALETTE.mint },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PALETTE.mint },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(247,245,240,0.06)', borderWidth: 1, borderColor: PALETTE.hairline,
  },
  chipPrice: { backgroundColor: PALETTE.mintSoft, borderColor: PALETTE.mintDim },
  chipText: { fontSize: 11, color: PALETTE.mutedMint, fontWeight: '500' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  outlineBtn: {
    flex: 1, height: 38, borderRadius: 12, borderWidth: 1, borderColor: PALETTE.hairline,
    justifyContent: 'center', alignItems: 'center',
  },
  outlineBtnText: { color: PALETTE.warmWhite, fontWeight: '600', fontSize: 13 },
  selectBtn: {
    flex: 1, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(247,245,240,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  selectBtnText: { color: PALETTE.warmWhite, fontWeight: '700', fontSize: 13 },
})
