# Ciclo de trabajo — MyFitTrack

Este documento define cómo se ejecuta el backlog de producción registrado en el
tablero de GitHub Projects **"MyfitTrack — Lanzamiento"**
(https://github.com/users/joss5321/projects/1). Vive en el repo (no solo en un
documento externo) para que cualquier sesión de trabajo — humana o de IA —
pueda consultarlo sin depender de memoria de conversación.

## Roles

- **Coordinador**: decide qué tarea se ataca, revisa que no haya dependencias
  pendientes, y es quien mueve una tarea a `Bloqueada` o decide qué hacer con
  una tarea bloqueada.
- **Desarrollador**: implementa una tarea a la vez, en su propia rama, hasta
  dejarla en `En revisión` con evidencia de que funciona.
- **Revisor**: revisa el PR y la evidencia adjunta, y decide si pasa a
  `En validación` o regresa a `En desarrollo` con comentarios concretos.

**Nota honesta sobre quién ejecuta estos roles hoy:** actualmente los tres
roles los ejecuta Claude Code sobre el mismo modelo subyacente (Claude Sonnet
5), en la misma máquina. Esto significa que "revisor" hoy es una sesión nueva
del mismo modelo, no un modelo distinto ni una persona distinta — reduce
algunos sesgos de continuidad (una sesión nueva no recuerda las decisiones de
la sesión que implementó, así que revisa el código tal como queda, no la
intención original), pero no sustituye una revisión humana independiente para
cambios críticos (pagos, RLS, borrado de datos). Si se desea un revisor
genuinamente independiente, se recomienda que una persona (el usuario) revise
el PR antes de aprobar, especialmente en tareas de la categoría "Bloqueador de
lanzamiento".

## Los 7 estados

| Estado | Significado |
|---|---|
| `Pendiente` | Registrada, nadie la está trabajando. |
| `Lista` | Tiene criterio de aceptación claro y ninguna dependencia pendiente; puede empezar. |
| `En desarrollo` | Un desarrollador la está implementando en su rama. |
| `En revisión` | Hay un PR abierto, esperando revisión de código. |
| `En validación` | El PR fue aprobado y ahora se valida con evidencia real (no solo lectura de código): logs, capturas, resultado de una prueba ejecutada. |
| `Terminada` | Validada con evidencia real adjunta en el issue o el PR. **Nunca se marca Terminada solo porque el código cambió.** |
| `Bloqueada` | Ver regla de 3 intentos abajo. |

## Regla de una tarea a la vez

- Una rama, un PR, por cada cambio coherente. No mezclar dos tareas del
  backlog en el mismo PR salvo que sean la misma causa raíz.
- Mientras una tarea está `Bloqueada` o `En revisión`, se puede seguir
  trabajando en **otras tareas independientes** del backlog — no hay que
  esperar a que una termine para empezar otra que no depende de ella.
- Antes de mover una tarea a `Lista`, confirmar que sus dependencias (columna
  "Depende de" en el issue, cuando aplique) ya están `Terminada`.

## Regla de los 3 intentos

Si una tarea no se puede resolver después de **3 intentos de corrección**,
se marca `Bloqueada` inmediatamente — no se sigue intentando indefinidamente.
Al bloquear, el issue debe decir explícitamente:

1. Qué se intentó en cada uno de los 3 intentos.
2. Por qué falló cada uno.
3. Qué información, decisión o acceso concreto se necesita para
   desbloquearla (ej. "necesito que el usuario confirme el modelo de negocio
   de pagos", "necesito acceso de superadmin en Supabase para probar esto",
   "necesito una cuenta Apple Developer con el agreement firmado").

## Evidencia requerida antes de `Terminada`

No basta con "el código ya hace X". Ejemplos de evidencia aceptable según el
tipo de tarea:

- **Bug de UI/lógica**: captura de pantalla o grabación del comportamiento
  correcto, o salida de una prueba automatizada.
- **Cambio de base de datos / RLS**: resultado de una consulta real contra el
  proyecto de Supabase (no solo el archivo `supabase_schema.sql`) confirmando
  que la migración corrió y el comportamiento es el esperado.
- **Cambio en Edge Function**: log real de una invocación de prueba, o
  respuesta HTTP capturada.
- **Pagos (Stripe)**: evento real visto en el Dashboard de Stripe (modo Test
  o Live según corresponda) y su efecto confirmado en `perfiles`/`suscripciones`.

El archivo local `supabase_schema.sql` describe la migración **propuesta**;
nunca es evidencia por sí solo de que esa migración ya corrió en producción.

## Migraciones e infraestructura

Las migraciones SQL y cambios de infraestructura se preparan y se dejan
listos para revisión, pero **no se aplican a producción** hasta que una
persona lo apruebe explícitamente, tarea por tarea. Ninguna tarea de este
backlog habilita cobros reales (Stripe Live) sin que el usuario lo autorice
de forma expresa y por separado.

## Automatización del ciclo

Desde el 21/10/2026 los roles de desarrollador y revisor corren de forma
automática vía GitHub Actions. Los workflows viven en `.github/workflows/`:

- `claude-dev.yml` — desarrollador. Arranca solo por `workflow_dispatch`
  manual (número de issue). Valida que el issue esté abierto, tenga la
  etiqueta `agent-ready`, esté en `Lista`, no haya otra tarea activa y no
  haya superado 3 intentos (etiquetas `attempt-1/2/3` en el issue, no
  ramas — borrar una rama no resetea el conteo). Implementa, corre
  comprobaciones reales, abre PR, programa auto-merge nativo de GitHub.
- `claude-review.yml` — revisor. Corre en una ejecución separada de
  Actions (mismo modelo, Claude Sonnet 5, sin contexto compartido con el
  desarrollador) con una identidad de GitHub distinta (`CLAUDE_REVIEWER_TOKEN`,
  un token de solo lectura sobre código). Re-verifica el diff y las
  comprobaciones por su cuenta, nunca confía en el texto del PR. Aprueba o
  pide cambios con observaciones concretas, y deja una señal explícita
  (`CRITERIOS_VERIFICABLES_EN_CI: si/no`) sobre si el criterio de
  aceptación quedó verificado solo con checks automáticos o necesita
  confirmación manual/dispositivo.
- `claude-fix.yml` — corrige sobre la misma rama cuando el revisor pide
  cambios. Límite de 3 rondas; a la cuarta, marca `Bloqueada` y se
  detiene sin reintentar.
- `claude-merged.yml` — tras un merge real (nunca antes), decide entre
  `En validación` (queda abierto) o `Terminada` (se cierra) leyendo
  exclusivamente esa señal estructurada del revisor, nunca su prosa libre.
- `claude-coordinator.yml` — selecciona la siguiente tarea `Lista` +
  `agent-ready` sin dependencias pendientes y sin otra tarea activa, y
  despacha `claude-dev.yml`. Si no hay nada elegible, termina sin invocar
  al modelo.
- `claude-triage.yml` — prepara el backlog (cada 6h): revisa los issues
  `Pendiente`, decide si tienen criterio claro + dependencias resueltas +
  alcance permitido, y si es asi agrega la etiqueta `agent-ready`. Si una
  tarea es muy grande o mezcla riesgos distintos, la divide en sub-issues.
  Si falta un dato/credencial, deja un comentario explicando que falta y
  no la toca. Diseno de seguridad: Claude nunca mueve el tablero
  directamente ni tiene un token con alcance de Projects — un paso
  deterministico separado (sin modelo) es el que mueve a `Lista` cualquier
  issue que haya quedado con la etiqueta puesta.
- `claude-approve-reviews.yml` — aprueba automaticamente (cada 15 min) las
  corridas de `claude-review.yml`/`claude-merged.yml`/`CI` que GitHub deja
  en "action_required" por ser un push de bot en un repo publico (proteccion
  anti-abuso de la plataforma, no algo que este repo pueda desactivar).
  Permiso minimo posible: `actions: write`, nada de contents/pull-requests/
  issues — no puede escribir codigo, no puede tocar `main`, no puede
  mergear nada, solo autoriza que una corrida ya programada empiece.
- `claude-daily-report.yml` — publica un resumen diario (tablero +
  registro de corridas) como comentario en un issue fijo. No se configuró
  ningún canal externo (Slack/email/etc.).

### Garantías de seguridad verificadas (no solo declaradas)

- **Una tarea a la vez**: el `gate` de `claude-dev.yml` rechaza despachar
  una tarea nueva si otra sigue `En desarrollo`/`En revisión`, además del
  `concurrency` de Actions que serializa las corridas.
- **El ciclo no puede modificar su propia configuración**: `sensitive-paths-guard`
  (check requerido en `main`) bloquea cualquier PR de rama `agent/issue-*`
  que toque `.github/`, `WORKFLOW.md`, `CLAUDE.md` o `AGENTS.md` — probado
  en vivo. Esto nunca se relajó.
- **Pagos/permisos/migraciones se pueden *preparar*, nunca aplicar
  automáticamente**: desde el 23/10/2026 el agente puede escribir código de
  Stripe, permisos o una migración (sección nueva en `supabase_schema.sql`)
  como propuesta — pero el mismo `sensitive-paths-guard` sigue fallando a
  propósito para esas rutas, así que el PR nunca puede satisfacer el
  auto-merge aunque el revisor lo apruebe. Queda para revisión y aplicación
  manual de una persona. Ninguna clave "live" de Stripe ni credencial de
  producción existe en ningún workflow.
- **El desarrollador no puede aprobar ni mergear**: identidad de GitHub
  distinta para el revisor + branch protection en `main` (1 aprobación
  requerida) — GitHub rechaza que una PR se apruebe a sí misma.
- **Ningún cierre automático salta la validación**: `Terminada` solo
  ocurre si el revisor marcó explícitamente `CRITERIOS_VERIFICABLES_EN_CI: si`;
  en cualquier otro caso queda `En validación`, abierto.
- **Merge y despliegue a producción están desacoplados**: el auto-merge a
  `main` no tiene ninguna credencial de Vercel/EAS/Stripe; si Vercel
  despliega admin-web al mergear es por su propia integración de Git
  (confirmado), no por nada de este ciclo. Ninguna Edge Function de
  Supabase se despliega automáticamente — sigue siendo manual.
- **Probado de extremo a extremo, dos veces, con evidencia real** (no solo
  configurado):
  - Ruta "criterios verificables": issue #49 → PR #50 → revisor aprobó con
    `CRITERIOS_VERIFICABLES_EN_CI: si` → merge automático → cierre
    automático + `Terminada`.
  - Ruta "revisor pide cambios": issue #6 → PR #54 → revisor pidió cambios
    concretos → `claude-fix.yml` corrigió sobre la misma rama → re-revisión
    del último commit → aprobó → merge automático. El issue quedó en
    `En validación` (no `Terminada`) porque el revisor marcó
    `CRITERIOS_VERIFICABLES_EN_CI: no`.
  - En el camino se encontraron y corrigieron en vivo varios bugs reales
    de la primera versión de estos workflows (faltaba `--allowedTools`,
    límites de turnos insuficientes, protección anti-bucle de la propia
    Claude Code Action rechazando a los bots "claude" y "github-actions",
    un error de sintaxis YAML que impedía que `claude-fix.yml` corriera
    nunca, y que "Closes #N" cerraba el issue de forma nativa sin pasar
    por la validación de este ciclo) — todos documentados en los mensajes
    de commit correspondientes, no ocultados.

## Dónde vive cada cosa

- **Backlog y estado de cada tarea**: tablero de GitHub Projects
  "MyfitTrack — Lanzamiento" (https://github.com/users/joss5321/projects/1).
- **Detalle de cada tarea** (evidencia, criterio de aceptación, severidad,
  categoría, dependencias): el issue de GitHub correspondiente.
- **Este documento**: las reglas del ciclo, no el estado de ninguna tarea
  puntual — si las reglas cambian, se edita aquí.
