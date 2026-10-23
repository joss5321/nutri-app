# Plan de rollback — MyFitTrack

Documento generado para el issue #32 (hallazgo de la auditoría de producción,
Fase 3). Describe los pasos concretos para revertir, en orden de severidad
creciente:

1. Un deploy de **admin-web** en Vercel.
2. Un build de **mobile-app** publicado vía EAS.
3. Una migración SQL fallida contra el proyecto de Supabase.

No reemplaza el juicio de quien esté operando el incidente: es el punto de
partida para no perder tiempo decidiendo "¿y ahora qué comando corro?" en
medio de un rollback real.

## 1. Rollback de admin-web (Vercel)

**Contexto del proyecto:** `admin-web` es un sitio Next.js sin `vercel.json`
en el repo — el deploy está gobernado por la integración Git de Vercel
(dashboard), no por un script propio en este repositorio. Cada push a `main`
genera un deployment nuevo en Vercel.

### Pasos

1. Entrar al dashboard de Vercel → proyecto `admin-web` → pestaña
   **Deployments**.
2. Localizar el último deployment de producción que sí funcionaba (antes del
   deploy problemático). Confirmar su commit SHA contra `git log` del repo
   para no revertir al deployment equivocado.
3. Usar **Instant Rollback**: abrir el menú `...` de ese deployment anterior
   y elegir **"Promote to Production"** (o el equivalente **"Rollback"** si
   Vercel lo presenta como acción directa en esa versión del dashboard).
   Esto apunta el dominio de producción al build ya existente — no
   reconstruye nada, por lo que es casi instantáneo.
   - Alternativa por CLI (requiere `vercel` CLI autenticado con acceso al
     proyecto): `vercel rollback [url-o-deployment-id]`.
4. Confirmar en el dashboard que el deployment activo (el que recibe tráfico
   de producción) es ahora el anterior.
5. **Revertir también en Git**: el Instant Rollback cambia qué build recibe
   tráfico, pero `main` sigue teniendo el commit problemático. El siguiente
   push a `main` volvería a desplegar el código malo. Hacer
   `git revert <commit-problemático>` y pushear a `main` (o abrir PR con el
   revert) para que el HEAD de la rama vuelva a quedar consistente con lo
   que está sirviendo producción.
6. Validar manualmente las rutas afectadas en producción tras el rollback.

### Limitación conocida

Esto depende de que el deployment anterior siga disponible en el historial
de Vercel (no fue borrado) y de tener acceso al dashboard/CLI de Vercel. Esta
tarea no tenía esas credenciales disponibles, así que este procedimiento
**no se probó contra el proyecto real** — ver sección de comprobaciones más
abajo.

## 2. Rollback de un build de mobile-app (EAS)

**Contexto del proyecto:** `mobile-app/eas.json` solo define perfiles de
`build` (`development`, `preview`, `production`) y `submit` (`production`).
No hay configuración de `expo-updates` ni canal de OTA (`eas update`) — no
aparece `expo-updates` en `mobile-app/package.json` ni bloque `"updates"` en
`app.json`. Esto importa porque significa que **no existe un rollback
instantáneo tipo OTA** para esta app: cualquier rollback de un build nativo
requiere subir otro build a las tiendas.

### Caso A — El build malo todavía no se entregó ampliamente (interno / TestFlight interno / internal testing de Play)

1. En `expo.dev` → proyecto → **Builds**, localizar el build anterior bueno
   (mismo `profile`, versión/`buildNumber` previo).
2. Si todavía no se envió a revisión, simplemente no promoverlo — distribuir
   el build anterior (link o QR de EAS) a los testers en su lugar.
3. Si ya se envió a submit pero aún no fue aprobado/publicado: cancelar el
   release en App Store Connect / Play Console antes de que salga a
   producción.

### Caso B — El build malo ya está en rollout parcial (staged rollout)

1. **Android (Play Console):** ir a **Production → Releases**, abrir el
   release activo y usar **"Halt rollout"** de inmediato. Esto detiene que
   siga avanzando el porcentaje de usuarios que reciben la versión nueva,
   sin afectar a quien ya la tiene.
2. **iOS (App Store Connect):** si el release usa *phased release*, ir a la
   versión en revisión/release y pausarla desde la sección de "Phased
   Release for Automatic Updates" (disponible mientras el rollout no haya
   llegado al 100% y dentro de la ventana de 7 días).
3. Estos dos pasos **no revierten** a los usuarios que ya actualizaron — solo
   frenan que avance más. Para esos usuarios ya actualizados, se necesita el
   Caso C.

### Caso C — El build malo ya está 100% publicado

No hay forma de "deshacer" un build nativo ya instalado sin publicar uno
nuevo. Pasos:

1. Identificar el último commit/tag bueno en git (el que generó el build
   anterior conocido como estable).
2. `git checkout <tag-o-commit-bueno>` (en una rama/worktree aparte, sin
   tocar el trabajo en curso).
3. Incrementar `version`/`buildNumber`/`versionCode` según corresponda — las
   tiendas no aceptan resubir un número de build menor o igual al que ya está
   publicado.
4. `cd mobile-app && eas build --platform all --profile production`
5. `eas submit --platform all --profile production`
6. Marcar la versión nueva como release de emergencia/hotfix en las notas de
   la tienda para que el equipo sepa que es un rollback, no una feature.

### Limitación conocida

Este es el hallazgo más importante de esta documentación: como no hay EAS
Update configurado, **todo rollback de mobile-app pasa por build + submit +
revisión de tienda**, lo cual puede tardar horas (Android) o hasta 1-2 días
(iOS, aunque Apple suele aprobar rápido las "expedited reviews" si se
solicitan explicando que es un rollback de un bug). Esto no se resuelve en
este issue (sería agregar `expo-updates`, que es un cambio de alcance mayor
al pedido aquí) pero debe quedar registrado como riesgo.

No se probó este procedimiento contra el proyecto real de EAS — esta tarea
no tenía credenciales de EAS/Expo ni acceso a App Store Connect / Play
Console. Ver limitaciones en el PR.

## 3. Rollback de una migración SQL fallida (Supabase)

**Contexto del proyecto:** este repo no usa `supabase/migrations/` con
versionado por CLI — el esquema se mantiene como un dump completo en
`supabase_schema.sql` que se pega manualmente en el SQL Editor del dashboard
de Supabase (ver el comentario al inicio de ese archivo). Esto significa que
"la migración" en la práctica suele ser un bloque de SQL (`alter table`,
`create table`, backfill, etc.) ejecutado a mano contra la base real, sin un
mecanismo de `up`/`down` automático. El plan de rollback tiene que asumir
eso.

### 3.1 Antes de correr cualquier migración en producción

- Tener siempre escrito, antes de ejecutar el `ALTER`/`CREATE`, el SQL de
  reversión correspondiente (ver tabla de patrones abajo). Si no se puede
  escribir un rollback razonable para ese cambio, no es un cambio seguro para
  correr directo en producción sin backup verificado primero.
- Confirmar que Supabase tiene un backup reciente disponible
  (Dashboard → Database → Backups) antes de migraciones riesgosas
  (no solo aditivas).

### 3.2 Patrones de rollback por tipo de cambio

| Cambio aplicado | Rollback |
|---|---|
| `alter table X add column Y` (aditivo, sin backfill obligatorio) | `alter table X drop column Y;` — reversible de forma trivial. |
| `create table X` | `drop table X;` (si aún no tiene dependientes/datos que otros procesos ya consumieron). |
| `alter table X alter column Y type ...` / rename / cambios con pérdida de datos | **No es trivialmente reversible.** Requiere restaurar desde backup o PITR (Point-in-Time Recovery) desde el dashboard de Supabase → Database → Backups, a un punto justo antes de la migración. |
| Backfill de datos (`update ... set ...` masivo) | Solo es reversible si se guardó el valor anterior (columna temporal, tabla de respaldo) antes de correr el `update`. Si no se guardó, requiere PITR. |

### 3.3 Procedimiento paso a paso ante una migración fallida

1. **Detener** cualquier proceso/función que dependa del cambio recién
   aplicado si está causando errores en producción (p. ej. pausar la Edge
   Function que empezó a fallar).
2. Si el cambio es del tipo "trivialmente reversible" (ver tabla): ejecutar
   el SQL de reversión correspondiente en el SQL Editor de Supabase.
3. Si no es trivialmente reversible: ir a Dashboard → Database → Backups →
   solicitar un restore a un punto anterior a la migración (PITR, si el plan
   de Supabase lo tiene habilitado) o restaurar desde el último backup
   diario disponible.
4. Verificar con una consulta real (no solo "el dashboard no muestra error")
   que el esquema y los datos quedaron como antes de la migración.
5. Revisar logs de la aplicación (admin-web, mobile-app, Edge Functions) para
   confirmar que el error que disparó el rollback ya no ocurre.

### 3.4 Prueba real ejecutada (migración reversible)

Se probó el caso trivialmente reversible de la tabla anterior (
`add column` / `drop column`) contra un Postgres 17 real (misma versión
mayor que declara `supabase/config.toml`, `major_version = 17`), corriendo
en un contenedor Docker local y descartable — no contra el proyecto de
Supabase real, pero validando que el SQL de rollback documentado es
correcto y no corrompe el resto de los datos de la tabla.

Pasos ejecutados (resumen; la salida completa de cada paso está en la
descripción del PR, bajo "Comprobaciones ejecutadas"):

1. Se levantó un Postgres 17 limpio en Docker y se cargó un subconjunto real
   del esquema (tabla `perfiles`, copiada literalmente de
   `supabase_schema.sql`) con una fila de prueba.
2. Se aplicó la migración de ejemplo: `alter table perfiles add column
   telefono text;`
3. Se escribió un valor en la columna nueva (`update ... set telefono =
   '+52 55 1234 5678'`) para simular que la columna ya se usó con datos
   reales antes de decidir revertir.
4. Se ejecutó el rollback documentado: `alter table perfiles drop column
   telefono;`
5. Se confirmó con `\d perfiles` que la columna desapareció y con `select`
   que la fila original (`nombre_completo`, `plan_membresia`) quedó intacta.

Resultado: el rollback dejó la tabla exactamente en el estado anterior a la
migración, sin pérdida del resto de los datos. El contenedor de prueba se
eliminó al terminar (no quedó infraestructura corriendo).

## 4. Qué NO cubre este documento

- Rollback de cambios en `lib/permissions.ts`, lógica de Stripe/cobros, o
  cualquier ruta marcada como sensible en `sensitive-paths-guard` — están
  fuera del alcance de este issue a propósito.
- No se ejecutó ningún rollback contra el proyecto real de Vercel ni de EAS:
  esta tarea no contaba con esas credenciales (ver limitaciones en las
  secciones 1 y 2).
