// ─── Paleta MyFitTrack ────────────────────────────────────────────────────────
// Construida a partir del isotipo oficial (admin-web/public/branding/isotipo-myfittrack.svg):
// tinta navy #192C31, cinta métrica amarilla #FFF824, y el verde esmeralda ya
// oficial en app.json (splash #2EBD8C / adaptive icon #144333). `primary` ya
// evolucionaba correctamente esa dirección — se conserva. Se agregan `ink`
// (navy del logo, para acentos de alto contraste) y `highlight` (amarillo,
// reservado para logros/progreso — nunca como color base).
export const COLORS = {
  // Brand
  primary:     '#4CAF8D',
  primaryDark: '#2F8F73',
  primaryLight:'#E8F7F2',

  // Brand — acentos del isotipo
  ink:           '#192C31',
  highlight:     '#FFF824',
  highlightText: '#192C31',

  // Backgrounds
  background:  '#F8FAFC',
  white:       '#FFFFFF',
  cardBg:      '#F8FAFC',
  inputBg:     '#F1F5F9',
  surfaceElevated: '#FFFFFF',
  divider:     '#F1F5F9',
  overlay:     'rgba(15, 23, 42, 0.45)',

  // Text
  text:        '#111827',
  muted:       '#6B7280',

  // Border
  border:      '#E5E7EB',

  // Tab bar
  tabBar:      '#FFFFFF',

  // Semantic
  error:       '#EF4444',

  // Status — completed (green)
  completed:     '#F0FDF4',
  completedText: '#15803D',

  // Status — pending (amber)
  pending:     '#FFFBEB',
  pendingText: '#B45309',

  // Status — info (tinte de marca; sustituye azules genéricos usados antes
  // para "novedades" en Rutinas/Nutrición)
  info:        '#EAF7F1',
  infoText:    '#136E4F',
  infoBorder:  '#C8EDE3',
} as const

// ─── Paleta Auth (Welcome, Login, Register, recuperación) ─────────────────────
// Modo oscuro premium: verde esmeralda profundo + menta brillante. Es la
// evolución del par oficial splash/adaptive-icon (#144333/#2EBD8C) hacia una
// identidad de marca completa. Único origen para las 5 pantallas de Auth.
export const AUTH_COLORS = {
  bg:          '#0B2B22',
  bgElevated:  '#123D30',
  mint:        '#3DDC97',
  mintSoft:    'rgba(61, 220, 151, 0.16)',
  mintDim:     'rgba(61, 220, 151, 0.45)',
  hairline:    'rgba(247, 245, 240, 0.10)',
  warmWhite:   '#F7F5F0',
  mutedMint:   '#AFD3C6',
  onMint:      '#0B2B22',
  error:       '#FF9B8F',
  errorBg:     'rgba(255, 155, 143, 0.12)',
} as const
