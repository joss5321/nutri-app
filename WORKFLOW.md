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

## Dónde vive cada cosa

- **Backlog y estado de cada tarea**: tablero de GitHub Projects
  "MyfitTrack — Lanzamiento" (https://github.com/users/joss5321/projects/1).
- **Detalle de cada tarea** (evidencia, criterio de aceptación, severidad,
  categoría, dependencias): el issue de GitHub correspondiente.
- **Este documento**: las reglas del ciclo, no el estado de ninguna tarea
  puntual — si las reglas cambian, se edita aquí.
