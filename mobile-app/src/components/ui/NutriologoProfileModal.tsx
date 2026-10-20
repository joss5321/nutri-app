import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '@/constants/colors'
import type { Nutricionista } from '@/lib/api/nutricionistas'
import {
  fetchNutriologoDetalle,
  type NutriologoDirectorio,
  type NutriologoDetalle,
} from '@/lib/api/nutriologo-perfil'

const MODALIDAD_LABEL: Record<string, string> = {
  presencial: 'Presencial',
  online: 'En línea',
  ambas: 'Presencial / En línea',
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
function fmtFecha(iso: string | null): string {
  if (!iso) return ''
  const [y, m] = iso.split('-').map(Number)
  return `${MESES[m - 1]} ${y}`
}

interface NutriologoProfileModalProps {
  visible: boolean
  nutricionista: Nutricionista | null
  enriquecido?: NutriologoDirectorio
  onClose: () => void
  onSeleccionar: () => void
}

export function NutriologoProfileModal({ visible, nutricionista, enriquecido, onClose, onSeleccionar }: NutriologoProfileModalProps) {
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState<NutriologoDetalle | null>(null)

  useEffect(() => {
    if (!visible || !nutricionista) return
    setLoading(true)
    setDetalle(null)
    fetchNutriologoDetalle(nutricionista.id)
      .then(setDetalle)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [visible, nutricionista?.id])

  if (!nutricionista) return null

  const fotoUrl = enriquecido?.foto_portada_url ?? nutricionista.avatar_url
  const modalidadLabel = enriquecido?.modalidad ? MODALIDAD_LABEL[enriquecido.modalidad] : null

  const redes = [
    enriquecido?.instagram_url && { icon: 'logo-instagram' as const, url: enriquecido.instagram_url },
    enriquecido?.facebook_url && { icon: 'logo-facebook' as const, url: enriquecido.facebook_url },
    enriquecido?.tiktok_url && { icon: 'logo-tiktok' as const, url: enriquecido.tiktok_url },
    enriquecido?.sitio_web_url && { icon: 'globe-outline' as const, url: enriquecido.sitio_web_url },
  ].filter((r): r is { icon: 'logo-instagram' | 'logo-facebook' | 'logo-tiktok' | 'globe-outline'; url: string } => !!r)

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{nutricionista.nombre_completo ?? 'Nutriólogo'}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          {fotoUrl ? (
            <Image source={{ uri: fotoUrl }} style={s.hero} contentFit="cover" />
          ) : (
            <View style={[s.hero, s.heroPlaceholder]}>
              <Ionicons name="person" size={48} color={COLORS.primary} />
            </View>
          )}

          <View style={{ padding: 20, gap: 16 }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontWeight: '800', fontSize: 20, color: COLORS.text }}>
                  {nutricionista.nombre_completo ?? 'Nutriólogo'}
                </Text>
                {enriquecido?.verificado && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
              </View>
              {enriquecido?.titulo_profesional && (
                <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: '600', marginTop: 2 }}>
                  {enriquecido.titulo_profesional}
                </Text>
              )}
              {enriquecido?.universidad && (
                <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{enriquecido.universidad}</Text>
              )}
            </View>

            {enriquecido?.especialidades && enriquecido.especialidades.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {enriquecido.especialidades.map((esp) => (
                  <View key={esp} style={s.tag}><Text style={s.tagText}>{esp}</Text></View>
                ))}
              </View>
            )}

            {(modalidadLabel || enriquecido?.anos_experiencia != null || enriquecido?.precio_desde != null) && (
              <View style={s.infoRow}>
                {enriquecido?.anos_experiencia != null && (
                  <View style={s.infoChip}>
                    <Ionicons name="ribbon-outline" size={14} color={COLORS.primary} />
                    <Text style={s.infoChipText}>{enriquecido.anos_experiencia} años exp.</Text>
                  </View>
                )}
                {modalidadLabel && (
                  <View style={s.infoChip}>
                    <Ionicons name="location-outline" size={14} color={COLORS.primary} />
                    <Text style={s.infoChipText}>{modalidadLabel}</Text>
                  </View>
                )}
                {enriquecido?.precio_desde != null && (
                  <View style={s.infoChip}>
                    <Ionicons name="pricetag-outline" size={14} color={COLORS.primary} />
                    <Text style={s.infoChipText}>Desde ${enriquecido.precio_desde} MXN</Text>
                  </View>
                )}
              </View>
            )}

            {enriquecido?.biografia && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Sobre mí</Text>
                <Text style={s.sectionBody}>{enriquecido.biografia}</Text>
              </View>
            )}

            {loading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : (
              <>
                {detalle && detalle.servicios.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>Servicios</Text>
                    <View style={{ gap: 10 }}>
                      {detalle.servicios.map((sv) => (
                        <View key={sv.id} style={s.serviceRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.serviceName}>{sv.nombre}</Text>
                            {sv.descripcion && <Text style={s.serviceDesc}>{sv.descripcion}</Text>}
                          </View>
                          <Text style={s.servicePrice}>${sv.precio} {sv.moneda}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {detalle && detalle.experiencia.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>Experiencia</Text>
                    <View style={{ gap: 10 }}>
                      {detalle.experiencia.map((ex) => (
                        <View key={ex.id} style={{ gap: 2 }}>
                          <Text style={s.serviceName}>{ex.puesto}</Text>
                          <Text style={s.serviceDesc}>{ex.institucion}</Text>
                          <Text style={s.metaText}>
                            {fmtFecha(ex.fecha_inicio)} — {ex.actualidad ? 'Actualidad' : fmtFecha(ex.fecha_fin)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {detalle && detalle.certificaciones.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>Certificaciones</Text>
                    <View style={{ gap: 10 }}>
                      {detalle.certificaciones.map((c) => (
                        <View key={c.id} style={{ gap: 2 }}>
                          <Text style={s.serviceName}>{c.nombre}</Text>
                          <Text style={s.serviceDesc}>
                            {c.institucion}{c.anio ? ` · ${c.anio}` : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {detalle && detalle.consultorios.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>Ubicación</Text>
                    <View style={{ gap: 10 }}>
                      {detalle.consultorios.map((c) => (
                        <View key={c.id} style={{ gap: 2 }}>
                          {c.nombre && <Text style={s.serviceName}>{c.nombre}</Text>}
                          <Text style={s.serviceDesc}>
                            {[c.direccion, c.colonia, c.ciudad, c.estado].filter(Boolean).join(', ')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}

            {enriquecido?.idiomas && enriquecido.idiomas.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Idiomas</Text>
                <Text style={s.sectionBody}>{enriquecido.idiomas.join(', ')}</Text>
              </View>
            )}

            {redes.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 4 }}>
                {redes.map((r) => (
                  <TouchableOpacity key={r.url} onPress={() => Linking.openURL(r.url)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={r.icon} size={24} color={COLORS.muted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity style={s.selectBtn} onPress={onSeleccionar} activeOpacity={0.85}>
            <Text style={s.selectBtnText}>Seleccionar nutriólogo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16, color: COLORS.text, letterSpacing: -0.2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', height: 180, backgroundColor: '#F1F5F9' },
  heroPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  tag: { backgroundColor: COLORS.primaryLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F8FAFC', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: COLORS.border,
  },
  infoChipText: { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  section: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sectionBody: { fontSize: 14, color: COLORS.text, lineHeight: 21 },
  serviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  serviceName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  serviceDesc: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  servicePrice: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  metaText: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, paddingBottom: 28, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  selectBtn: {
    height: 52, borderRadius: 16, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  selectBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
})
