# Monitoreo y alertas básicas — propuesta

Documento generado para el issue #31 (hallazgo de la auditoría de
producción, Fase 3). Según lo acordado en el comentario de alcance del
issue, esta pasada **no configura ninguna cuenta ni servicio externo real**
(requeriría credenciales que este flujo automático no tiene) — es solo la
guía de qué servicio usar, qué alertas crear y por qué, para que una
persona con acceso a los dashboards la aplique manualmente.

Cubre los tres frentes que pide el criterio de aceptación del issue:

1. Fallos del webhook de Stripe (eventos no procesados en
   `stripe_webhook_events`).
2. Errores 5xx de Edge Functions.
3. Caídas/crashes de la app (mobile-app y admin-web).

## 1. Fallos del webhook de Stripe

**Qué ya existe en el código:** `supabase/functions/stripe-webhook/index.ts`
registra cada evento recibido en la tabla `stripe_webhook_events`
(`event_id`, `event_type`, `created_at`) antes de procesarlo, como mecanismo
de idempotencia (ver Sección 89 de `supabase_schema.sql`). Esa tabla es la
fuente de verdad para detectar fallos: si Stripe reporta un evento enviado
(visible en el dashboard de Stripe → Developers → Webhooks → intentos) pero
no aparece un `event_id` correspondiente en esa tabla, el webhook falló
antes de completar el insert (firma inválida, error 500, timeout, etc.).

**Servicio recomendado: Stripe Dashboard (nativo, sin costo extra).**
Stripe ya trae alertas de webhook listas para usar y no requiere ninguna
cuenta nueva:

- Dashboard de Stripe → **Developers → Webhooks** → seleccionar el
  endpoint de `stripe-webhook` → pestaña **Alerts**. Activar la alerta
  nativa "Webhook endpoint is failing" (se dispara cuando Stripe detecta
  una racha de respuestas no-2xx del endpoint) y configurar el email/canal
  de notificación.
- Motivo de elegir esto en vez de un servicio externo: Stripe ya tiene la
  visibilidad completa de cada intento de entrega (incluye reintentos,
  códigos de respuesta y backoff), así que es la fuente más directa y no
  depende de instrumentar nada adicional en el código.

**Complemento recomendado: Supabase Database Webhooks / Cron + consulta
SQL.** La alerta de Stripe cubre "el endpoint respondió error", pero no
cubre el caso silencioso de un evento que Stripe marca como entregado con
éxito y que, sin embargo, no quedó en `stripe_webhook_events` por algún
error posterior no relacionado con la firma. Para ese caso:

- Programar una Supabase **Cron Job** (extensión `pg_cron`, disponible en
  el proyecto Supabase) que corra cada 15-30 minutos una consulta como:

  ```sql
  select count(*) from stripe_webhook_events
  where created_at > now() - interval '30 minutes';
  ```

  y, si el conteo es 0 durante una ventana en la que se espera actividad
  (o comparando contra el volumen histórico), dispare una notificación.
- Dado que `pg_cron` no envía notificaciones por sí mismo, la forma más
  simple de conectar esa consulta a una alerta real es un **Supabase
  Database Webhook** sobre un `INSERT` en una tabla de "log de errores" que
  el propio `stripe-webhook` ya debería escribir en su rama `catch` (hoy
  solo hace `console.error`, ver más abajo en la Sección 2) — ese webhook
  puede apuntar a un canal de Slack/Discord vía su URL de webhook entrante,
  sin necesidad de ningún servicio de pago.

## 2. Errores 5xx de Edge Functions

**Qué ya existe:** cada Edge Function (`stripe-webhook`,
`revenuecat-webhook`, `crear-checkout`, `crear-portal-sesion`,
`eliminar-cuenta`, `cambiar-nutriologo`, `invitar-usuario`,
`translate-exercises`, `match-exercise-gifs`, `migrate-gifs`,
`import-workoutx`) corre en el runtime de Supabase Edge Functions (Deno) y
ya emite logs vía `console.error`/`console.log` en sus rutas de error, que
Supabase captura automáticamente en **Logs → Edge Functions** del
dashboard del proyecto.

**Corrección importante (verificado contra la documentación oficial de
Supabase antes de recomendar esto): Supabase NO tiene un botón nativo de
"alertas por tasa de error de Edge Functions".** El dashboard
(`Logs → Edge Functions` y `Reports → Edge Functions`,
[supabase.com/docs/guides/observability/reports](https://supabase.com/docs/guides/observability/reports))
solo permite *ver* las métricas y filtrar por `status_code >= 500` — es
observabilidad de lectura, no alerting configurable. No existe ninguna
sección "Project Settings → Alerts" para esto (confirmado también contra
[supabase.com/docs/guides/telemetry/metrics](https://supabase.com/docs/guides/telemetry/metrics),
la guía oficial de métricas).

Las dos rutas reales, sin asumir una función que no existe:

1. **Exportar métricas vía la Metrics API de Supabase** (compatible con
   Prometheus) hacia una herramienta externa que sí sepa alertar sobre
   ellas — ej. Grafana Cloud (plan gratuito disponible) o cualquier stack
   de Prometheus/Alertmanager ya existente. No toca código de las
   funciones, solo requiere configurar el scraper externo — pero sí da de
   alta una pieza de infraestructura nueva a mantener.
2. **Saltar directo a Sentry** (ver abajo) — en la práctica es la ruta más
   simple si no hay ya un stack de Prometheus/Grafana corriendo, porque la
   opción 1 implica levantar infraestructura nueva solo para esta alerta.

Dado que ambas rutas reales requieren algo fuera del dashboard de Supabase
(un stack externo de métricas, o el SDK de Sentry), **hoy no existe forma
de tener una alerta automática de errores 5xx de Edge Functions sin tocar
código o dar de alta un servicio externo**. Mientras tanto, el único
monitoreo disponible sin cambios es manual: revisar
`Logs → Edge Functions` filtrando por `status_code >= 500` periódicamente.

**Opción real recomendada: Sentry (plan gratuito disponible).** Para
trazar el error hasta la línea de código exacta, agrupar errores
repetidos, y alertar con reglas como "N errores en M minutos" sin levantar
infraestructura propia, la opción estándar para proyectos Deno/Node es
Sentry:

- Se integraría agregando el SDK de Sentry (`@sentry/deno` o, para Edge
  Functions, el wrapper HTTP recomendado por Supabase en su guía de
  integración con Sentry) dentro de cada función, capturando excepciones en
  el bloque `catch` existente antes de responder con el status 5xx.
- No se agrega en esta pasada: instalar un SDK nuevo en diez Edge Functions
  es un cambio de código que excede el alcance de este issue (que pide
  "configurar monitoreo y alertas", no reescribir el manejo de errores de
  cada función) y, además, requeriría una cuenta de Sentry y su DSN, que
  este flujo automático no tiene. Queda documentado como la ruta a seguir
  si el monitoreo nativo de Supabase resulta insuficiente.

## 3. Caídas/crashes de la app

Esto se separa en dos superficies con naturaleza distinta:

### 3.1 admin-web (Next.js en Vercel)

**Servicio recomendado: Vercel Monitoring (nativo) + Vercel Log Drains.**

- Dashboard de Vercel → proyecto `admin-web` → pestaña **Observability /
  Monitoring**: Vercel ya reporta automáticamente errores 5xx de rutas y
  fallos de build/runtime del proyecto desplegado, sin configuración
  adicional de código.
- Activar notificaciones: **Project Settings → Notifications**, habilitar
  alertas de "Deployment failed" y, si el plan del proyecto lo incluye,
  las alertas de errores en runtime.
- Motivo: el deploy ya está gobernado por la integración Git de Vercel
  (confirmado en `docs/plan-rollback.md`, Sección 1), así que usar su
  monitoreo nativo no agrega ninguna pieza nueva a mantener.

### 3.2 mobile-app (Expo / React Native)

**Servicio recomendado: Sentry (plan gratuito) vía el SDK oficial de
Expo.**

- A diferencia de admin-web, un crash de la app corre en el dispositivo del
  usuario final, no en un servidor — no hay ningún log centralizado nativo
  que lo capture hoy. Expo documenta una integración directa con Sentry
  (`sentry-expo` / `@sentry/react-native` + el plugin de Expo) pensada
  exactamente para este caso: reporta crashes nativos y errores de JS no
  capturados, con stack trace simbolicado para builds hechos vía EAS.
- No se agrega el SDK en esta pasada: es un cambio de código en
  `mobile-app` (nueva dependencia, inicialización en el entrypoint, y una
  cuenta de Sentry con su DSN) que excede lo que pide este issue
  puntualmente y requiere una credencial que este flujo no tiene. Queda
  documentada como la recomendación concreta a implementar en un issue de
  seguimiento.
- Alternativa más liviana si no se quiere adoptar Sentry todavía: EAS ya
  expone en su propio dashboard (`expo.dev` → proyecto → **Builds** /
  **Updates**) las fallas de build y de publicación de updates OTA, que
  cubren una parte (no toda) de "caídas" en el sentido de "la app no llega
  a arrancar por un build roto".

## Resumen de la propuesta

| Frente | Servicio recomendado | Costo | Requiere cambio de código |
|---|---|---|---|
| Webhook de Stripe sin procesar | Alertas nativas de Stripe Dashboard | Incluido | No |
| Webhook de Stripe — fallo silencioso | `pg_cron` + Database Webhook de Supabase | Incluido | No (usa logging ya existente) |
| Edge Functions 5xx | Sentry (Supabase NO tiene alertas nativas para esto — verificado) | Plan gratuito disponible | Sí (fuera de alcance de este issue) |
| admin-web caídas | Vercel Monitoring nativo | Incluido | No |
| mobile-app crashes | Sentry vía SDK de Expo | Plan gratuito disponible | Sí (fuera de alcance de este issue, ver issue de seguimiento) |

## Qué falta para cerrar el criterio de aceptación completo

El criterio de aceptación del issue pide, además de tener las alertas
configuradas, **"al menos una alerta de prueba disparada y recibida"**.
Esa verificación requiere entrar con credenciales reales a los dashboards
de Stripe, Supabase y Vercel (y, para Edge Functions 5xx y mobile-app,
publicar un build/deploy con el SDK de Sentry integrado) — nada de eso
está disponible en este flujo automático. Los pasos manuales que
quedarían pendientes para quien aplique esta guía:

1. Activar la alerta nativa de webhook fallido en Stripe, y la de
   "Deployment failed" en Vercel — estas dos sí son configuración pura de
   dashboard, sin tocar código.
2. Programar el `pg_cron` + Database Webhook en Supabase para el caso de
   fallo silencioso del webhook de Stripe (Sección 1) — es código SQL,
   pero no toca las Edge Functions existentes.
3. Disparar una alerta de prueba en cada una (Stripe permite reenviar un
   evento de prueba desde su dashboard; Vercel notifica automáticamente en
   el próximo deploy fallido) y confirmar que el canal elegido
   (email/Slack/Discord) la recibe.
4. Abrir el issue de seguimiento para integrar Sentry en `mobile-app` y en
   las Edge Functions (Sección 2) — sin este paso, Edge Functions 5xx y
   mobile-app crashes se quedan sin ninguna alerta automática real, solo
   con la revisión manual de logs.
