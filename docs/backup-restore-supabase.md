# Backup y restore de Supabase — MyFitTrack

Documento para el issue #30 (hallazgo de la auditoría de producción, Fase
3). Decisión adoptada (2026-11-23): **proceso manual verificado, sin PITR
por ahora** — ver "Decisión de costo" más abajo.

## Decisión de costo

El proyecto está en plan **Free** de Supabase. Según la página oficial de
precios (supabase.com/pricing):

| | Free (plan actual) | Pro |
|---|---|---|
| Respaldo automático | No incluido | Incluido (7 días) |
| Point-in-Time Recovery (PITR) | No incluido | Add-on aparte, **$100/mes** por 7 días de retención |
| Precio base | $0 | $25/mes |

Activar PITR real costaría **~$125/mes** (Pro + el add-on). Decisión
explícita del dueño del producto: no contratarlo todavía para la etapa de
piloto — quedarse con el proceso manual de este documento, y revisar de
nuevo cuando haya datos reales de pacientes/cobros en juego a mayor
escala.

## Qué cubre el proceso manual (verificado de extremo a extremo)

### Base de datos (schema `public`)

**Procedimiento:**
1. `supabase db dump --remote --schema public` (esquema) y
   `--data-only --use-copy` (datos) contra producción — ambos de solo
   lectura, no modifican nada.
2. Levantar un stack 100% local vía `supabase start` (Docker), separado
   por completo de producción.
3. Reiniciar el schema `public` en local y restaurar desde el dump.
   **Hallazgo real documentado:** el dump con `--schema public` **no
   incluye la extensión `pg_trgm`**, aunque sus objetos viven en ese
   schema — sin recrearla manualmente antes
   (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`), la restauración falla en
   el primer índice GIN. Paso obligatorio del procedimiento.
4. Restaurar los datos con `SET session_replication_role = replica;`
   (hay FKs circulares reales detectadas por `pg_dump`, ej. `recetas`,
   `radar_alertas`/`intervenciones`).

**Verificación real ejecutada** (no solo "corrió sin error"):
- Conteos de 9 tablas core comparados 1:1 entre el local restaurado y
  producción real: `perfiles`, `medidas`, `rutinas`, `citas`,
  `suscripciones`, `planes_nutricionales`, `recetas`,
  `nutriologo_perfiles`, `pacientes_manuales` — los 9 coinciden
  exactamente.
- Integridad referencial verificada sobre los 29 foreign keys internos al
  schema `public` (excluyendo los que apuntan a `auth`/`storage`,
  gestionados por la plataforma) — 0 violaciones.
- Limpieza confirmada al terminar: `supabase stop --no-backup` (volúmenes
  Docker vacíos, confirmado con `docker volume ls`) + los archivos del
  dump (datos reales de pacientes) borrados del disco.

**Qué NO cubre:** el schema `auth` (usuarios, contraseñas, sesiones) —
Supabase lo gestiona aparte internamente, no hay forma de respaldarlo de
la misma manera sin credenciales adicionales. Tampoco reemplaza PITR: da
un punto de restauración al momento de correr el dump, no recuperación a
un segundo exacto arbitrario.

### Storage — 5 buckets reales

| Bucket | Público | Objetos hoy | Estado |
|---|---|---|---|
| `avatars` | Sí | 11 | ✅ Descargado y verificado |
| `recetas-fotos` | Sí | 4 | ✅ Descargado y verificado |
| `exercise-gifs` | Sí | 0 | ✅ Vacío, nada que respaldar |
| `videos-ejercicios` | Sí | 0 | ✅ Vacío, nada que respaldar |
| `certificaciones-nutriologos` | **No** (privado) | **0** | ✅ Confirmado vacío (2026-11-23) |

**Buckets públicos:** se descargan directo por HTTPS sin ninguna
credencial, vía `{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}`.
Los 15 objetos existentes en `avatars`/`recetas-fotos` se descargaron y
se verificó que el tamaño de cada uno coincide exactamente con el
registrado en la base de datos. Las copias locales se borraron al
terminar.

**Bucket privado (`certificaciones-nutriologos`):** el CLI de Supabase
3.2.0 solo soporta `storage cp` en sentido local→remoto (subir), no
remoto→local (descargar) — limitación real de la herramienta, confirmada
con varios intentos. Se accedió una sola vez con la `service_role key`
para confirmar su contenido real (consulta de solo lectura a
`storage.objects` vía `supabase db query`): **el bucket está vacío, 0
objetos** — no hay nada que respaldar todavía. Si en el futuro se suben
certificaciones ahí, este paso debe repetirse con la API de Storage (no
el CLI) y la `service_role key` real.

## Cuándo revisar esta decisión

- Si el bucket `certificaciones-nutriologos` empieza a recibir archivos
  reales, repetir la verificación de ese bucket específicamente.
- Si el proyecto pasa a tener cobros reales activos (Stripe Live, #16) o
  un volumen significativo de pacientes reales, reconsiderar el costo de
  PITR (~$125/mes) contra el riesgo de depender solo del proceso manual.
- El proceso manual no está automatizado — hoy depende de correrlo a
  mano. Si se decide mantenerlo como mecanismo principal a largo plazo,
  vale la pena programarlo (ej. un cron/GitHub Action periódico), no
  solo dejarlo como procedimiento documentado.
