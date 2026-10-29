// No hay dominio propio comprado todavía (issue #34) — se usa el alias
// estable de producción de Vercel para el proyecto "nutri-app" (equipo
// "my-fit-track"), confirmado contra la API de GitHub Deployments como el
// que corresponde al último deploy de main. No es la URL con hash por
// despliegue (esa cambia en cada deploy); verificar en el dashboard de
// Vercel (Settings → Domains) que este sea el dominio marcado como
// producción antes de enviar la app a revisión.
const ADMIN_WEB_URL = 'https://nutri-app-my-fit-track.vercel.app'

export const PRIVACY_POLICY_URL = `${ADMIN_WEB_URL}/privacidad`
