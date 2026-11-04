# Separación de entornos test/live (Stripe) — MyFitTrack

Documento para el issue #29 (hallazgo de la auditoría de producción, Fase
3). Cubre los 3 puntos del criterio de aceptación con evidencia real
verificada contra el proyecto de Supabase vinculado (`fitness-app`,
`uvfdbvzydbogfkntfuix`), no solo lectura de código.

## 1. Claves test/live nunca mezcladas en el mismo archivo o deploy

**Verificado en el repo:** ningún archivo de código contiene una clave de
Stripe hardcodeada (`grep` de `sk_test_`/`sk_live_`/`whsec_` en todo el
repo, sin resultados fuera de comentarios de documentación que explican el
formato). Las 4 Edge Functions que usan Stripe
(`crear-checkout`, `crear-portal-sesion`, `stripe-webhook`,
`eliminar-cuenta`) leen un único secreto, `STRIPE_SECRET_KEY`, solo desde
`Deno.env.get(...)` — nunca hay una variante `_TEST`/`_LIVE` separada que
pueda quedar desincronizada o mezclada en el mismo deploy.

**Verificado en producción (`supabase secrets list`):** el proyecto tiene
exactamente un secreto `STRIPE_SECRET_KEY`, un `STRIPE_WEBHOOK_SECRET`, y
los 3 Price IDs (`STRIPE_PRICE_BASICO/PREMIUM/PRO`) — ninguna clave
duplicada ni con sufijo de modo. Esto significa que **"mezclar" claves no
es posible a nivel de código** (no hay dos constantes que puedan apuntar a
modos distintos a la vez), pero sí existe un riesgo operativo real,
documentado en la sección 3.

## 2. Variable de entorno que determina el modo, visible en logs de arranque

**Implementado en este PR:** como no hay una variable de modo separada (ver
sección 1 — y agregar una sería una segunda fuente de verdad que podría
desincronizarse de la clave real), se agregó
`supabase/functions/_shared/stripe-mode.ts`, que deriva el modo
directamente del prefijo de la clave activa (`sk_test_` / `sk_live_`) y lo
imprime una vez al arrancar (cold start) en las 4 Edge Functions que usan
Stripe:

```
[stripe-mode] crear-checkout: modo TEST
[stripe-mode] stripe-webhook: modo LIVE
```

Si la clave no tiene ninguno de los dos prefijos esperados, se loguea como
error explícito (`STRIPE_SECRET_KEY ausente o con prefijo inesperado`) en
vez de asumir silenciosamente un modo — nunca se asume "live" por
defecto. Con esto, **cualquier persona con acceso a Logs → Edge Functions
del dashboard de Supabase puede confirmar en segundos en qué modo está
corriendo cada función**, sin tener que leer el valor de la clave.

**Pendiente tras el merge:** desplegar estas 4 funciones
(`supabase functions deploy <nombre>`, manual, como el resto de Edge
Functions de este proyecto — ver `WORKFLOW.md`) para que el log empiece a
aparecer. No se despliega automáticamente desde el PR.

## 3. Qué proyecto de Supabase (y qué Edge Functions) sirve a cada modo

**Hallazgo verificado (`supabase projects list`): existe un único proyecto
de Supabase**, `fitness-app` (`uvfdbvzydbogfkntfuix`, región us-east-2),
marcado como `production`. **No existe un proyecto separado para modo
test/staging.** Las 10 Edge Functions del proyecto (incluidas las 4 que
tocan Stripe) corren todas sobre este mismo proyecto, sirviendo tanto el
desarrollo/pruebas actuales como lo que eventualmente sea tráfico real.

**Consecuencia real, no solo teórica:** hoy, "modo test" y "modo live" no
son dos entornos aislados — son el mismo proyecto de Supabase, la misma
base de datos, el mismo deploy de Edge Functions, diferenciados
**únicamente** por qué valor tiene el secreto `STRIPE_SECRET_KEY` en un
momento dado. Esto significa:

- Cambiar de test a live (issue #16) es **reemplazar el valor de un
  secreto en el proyecto de producción**, no desplegar a un proyecto
  distinto — no hay aislamiento técnico que impida correr código de
  prueba contra una clave live por error, más allá de la guardia que ya
  tiene `scripts/test-stripe-renewal.mjs` (se niega a correr si la clave
  no empieza con `sk_test_`) y el logging de modo agregado en este PR.
- **No existe hoy un proyecto de staging real** — esto es directamente
  relevante para el issue #30 (backup/restore), cuyo criterio de
  aceptación pide "restauración de prueba ejecutada en un proyecto de
  staging": ese proyecto todavía no existe, hay que crearlo.

## Checklist a seguir antes de habilitar Stripe Live (issue #16)

No se ejecuta nada de esto en este PR — queda como procedimiento
verificado para cuando se decida avanzar con #16, después de que #28 (test
de renovación) haya pasado:

1. Confirmar en el Dashboard de Stripe (toggle "Live mode") los 3 Price
   IDs **live** reales de los planes Básico/Premium/Pro — son objetos
   distintos de los Price IDs de test, no el mismo ID reutilizado.
2. Reemplazar en Supabase secrets (`supabase secrets set`, manual, un
   proyecto a la vez, nunca vía CI — ver `WORKFLOW.md`):
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (el webhook live tiene su
   propio secreto de firma, distinto del de test) y los 3
   `STRIPE_PRICE_*`.
3. Redesplegar las 4 Edge Functions afectadas y confirmar en sus logs de
   arranque que ahora dicen `modo LIVE` (la confirmación visible que pide
   este issue).
4. Hacer una compra real de prueba de bajo monto y confirmar en el
   Dashboard de Stripe (Live) y en `perfiles`/`suscripciones` que el flujo
   completo funciona — criterio de aceptación explícito del issue #16.

## Qué NO cubre este documento

- No crea un proyecto de staging en Supabase (queda para el issue #30,
  que además lo necesita para su propio criterio de aceptación).
- No cambia ningún secreto de Supabase ni activa Stripe Live — issue #16
  requiere autorización explícita y separada del usuario, según
  `WORKFLOW.md`.
- No confirma en qué modo está la clave actualmente activa en producción —
  deliberado: este documento no imprime ni describe el valor de ningún
  secreto real; una vez desplegado el logging de este PR, esa confirmación
  se obtiene leyendo los logs de Supabase, no este archivo.
