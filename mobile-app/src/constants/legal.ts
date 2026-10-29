// No hay dominio propio comprado todavía (issue #34) — se usa el dominio
// de producción real de Vercel que el usuario confirmó en su dashboard
// (Settings → Domains). Verificado en vivo (2026-10-29): "/" redirige a
// "/login" (el login propio de admin-web, no el de Vercel) — sin
// protección de Vercel Authentication por delante. No es la URL con hash
// por despliegue (esa cambia en cada deploy).
const ADMIN_WEB_URL = 'https://nutri-app-three-ashy.vercel.app'

export const PRIVACY_POLICY_URL = `${ADMIN_WEB_URL}/privacidad`
