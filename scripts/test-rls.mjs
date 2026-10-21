#!/usr/bin/env node
// Orquesta "npm run test:rls" en un solo comando:
//   1. valida que Docker esté disponible
//   2. levanta el stack local de Supabase solo si no está ya corriendo
//   3. regenera las migraciones locales de test (schema real + pgTAP, solo local)
//   4. "supabase db reset" — reconstruye el schema completo desde cero
//      aplicando las migraciones. Esto es lo que realmente valida que
//      supabase_schema.sql es reproducible; "supabase test db" NO hace
//      reset por sí mismo, solo corre pgTAP contra la base que ya exista.
//   5. solo si el reset fue exitoso: "supabase test db"
//
// Si el paso 4 falla, el script se detiene ahí mismo (no se llega a correr
// pgTAP contra un schema incompleto).
//
// supabase_schema.sql sigue siendo la única fuente de verdad editada a mano
// (ver feedback_supabase_schema). Los archivos que este script escribe en
// supabase/migrations/ son generados y desechables: no se editan a mano y
// no se commitean como fuente — se regeneran en cada corrida.
//
// pgTAP y los helpers de test SOLO existen en 00000000000000_pgtap_local_only.sql,
// que nunca se copia a supabase_schema.sql ni se aplica a producción.

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const isWin = process.platform === 'win32';

// En CI, ci.yml ya instala el binario real de Supabase CLI directo en el
// PATH via supabase/setup-cli@v1 — usarlo tal cual es mas confiable que
// "npx supabase", que resuelve su propio binario via npm en cada corrida y
// a veces falla con "No matching Supabase CLI binary package found for
// linux-x64" (visto en vivo en CI, intermitente, no relacionado con ningun
// cambio de codigo). Localmente (sin CI) se mantiene "npx supabase" como
// hasta ahora.
function supabaseCmd(args) {
  return process.env.CI ? ['supabase', args] : ['npx', ['supabase', ...args]];
}

// Todos los comandos que este script invoca son literales fijos (nunca
// interpolan input externo/de usuario), pero igual evitamos el patrón
// deprecado de spawnSync(cmd, args, {shell:true}) (Node DEP0190: con shell
// activo, args no se escapan, solo se concatenan) construyendo la línea de
// comando nosotros mismos.
function run(cmd, args) {
  const res = isWin
    ? spawnSync([cmd, ...args].join(' '), { stdio: 'inherit', shell: true, cwd: ROOT })
    : spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT });
  return res.status === 0;
}

function runQuiet(cmd, args) {
  const res = isWin
    ? spawnSync([cmd, ...args].join(' '), { stdio: 'pipe', shell: true, cwd: ROOT })
    : spawnSync(cmd, args, { stdio: 'pipe', cwd: ROOT });
  return { ok: !res.error && res.status === 0, error: res.error };
}

function checkDocker() {
  const { ok, error } = runQuiet('docker', ['info']);
  if (!ok) {
    console.error('');
    console.error('Docker no está disponible o no está corriendo.');
    console.error('"supabase test db" necesita Docker Desktop activo para levantar la base local de pruebas.');
    console.error('Instala/inicia Docker Desktop y vuelve a correr: npm run test:rls');
    if (error) console.error(`(detalle: ${error.message})`);
    console.error('');
    process.exit(1);
  }
}

function isSupabaseRunning() {
  return runQuiet(...supabaseCmd(['status'])).ok;
}

function ensureSupabaseStarted() {
  if (isSupabaseRunning()) {
    console.log('Supabase local ya está corriendo — no reinicio el stack.');
    return;
  }
  console.log('Supabase local no está activo. Ejecutando "supabase start" (puede tardar la primera vez)...');
  if (!run(...supabaseCmd(['start']))) {
    console.error('');
    console.error('"supabase start" falló. Revisa el log de arriba.');
    console.error('');
    process.exit(1);
  }
}

function syncTestMigrations() {
  const migrationsDir = join(ROOT, 'supabase', 'migrations');
  mkdirSync(migrationsDir, { recursive: true });

  // Directorio 100% generado/desechable (ver comentario del encabezado) —
  // se limpia por completo en cada corrida para no dejar archivos huérfanos
  // de nombres/orden anteriores (ej. si cambia la numeración de los
  // migrations, como ocurrió al mover pgtap_local_only antes de schema.sql).
  for (const f of readdirSync(migrationsDir)) {
    rmSync(join(migrationsDir, f), { force: true });
  }

  // 1) pgTAP + helpers de test — SOLO existen aquí, nunca en supabase_schema.sql.
  // Corre ANTES que supabase_schema.sql (ver comentario dentro de
  // PGTAP_LOCAL_ONLY_SQL): el ALTER DEFAULT PRIVILEGES de aquí necesita
  // preceder a la creación de las tablas/views reales para aplicarles su
  // efecto por defecto, y para que cualquier REVOKE explícito dentro de
  // supabase_schema.sql (ej. Sección 56) sea la última palabra.
  const pgtapDest = join(migrationsDir, '00000000000000_pgtap_local_only.sql');
  writeFileSync(pgtapDest, PGTAP_LOCAL_ONLY_SQL);
  console.log(`Infra de test (pgTAP + helpers) escrita en ${pgtapDest}`);

  // 2) Copia literal de la fuente de verdad de producción, sin modificarla.
  const schemaDest = join(migrationsDir, '00000000000001_schema.sql');
  copyFileSync(join(ROOT, 'supabase_schema.sql'), schemaDest);
  console.log(`supabase_schema.sql copiado a ${schemaDest}`);

  // 3) Copia literal de supabase_stripe_schema.sql. En producción esta
  // columna/tabla (stripe_customer_id, suscripciones) ya existe porque este
  // archivo se corrió por separado; supabase_schema.sql nunca lo incluyó
  // (drift real entre archivos, no un bug de este script). Se copia después
  // de 00000000000000/1 porque depende de que "perfiles" ya exista.
  const stripeDest = join(migrationsDir, '00000000000002_stripe_schema.sql');
  copyFileSync(join(ROOT, 'supabase_stripe_schema.sql'), stripeDest);
  console.log(`supabase_stripe_schema.sql copiado a ${stripeDest}`);
}

const PGTAP_LOCAL_ONLY_SQL = `-- Generado automáticamente por scripts/test-rls.mjs — NO EDITAR A MANO.
-- Esta migración es exclusiva del entorno local/CI de pruebas. NUNCA debe
-- copiarse a supabase_schema.sql ni aplicarse contra el proyecto real de
-- Supabase en producción.

create extension if not exists pgtap with schema extensions;

-- En producción, Supabase concede automáticamente estos privilegios a los
-- roles de la Data API (anon/authenticated/service_role) sobre CUALQUIER
-- tabla/view de "public" al crearse, vía ALTER DEFAULT PRIVILEGES fijado
-- al crear el proyecto ("auto-expose" legado) — nunca vivió en
-- supabase_schema.sql porque lo hacía la plataforma, no el SQL. Un reset
-- local desde cero no lo replica, así que lo reproducimos aquí para que
-- el entorno de test se comporte igual que producción.
--
-- Usamos ALTER DEFAULT PRIVILEGES (no un GRANT puntual sobre las tablas
-- ya existentes) porque esta migración corre ANTES que 00000000000001
-- (supabase_schema.sql, donde todavía no existe ninguna tabla) — así
-- replicamos el mecanismo real (aplica a objetos futuros), no solo un
-- snapshot del momento en que corre este archivo. Esto también es lo que
-- permite que una sección como la 56 haga su propio REVOKE explícito
-- sobre un objeto puntual (nutricionistas_publicos) inmediatamente
-- después de crearlo, y que ese REVOKE sea la última palabra — si este
-- grant corriera DESPUÉS de supabase_schema.sql (como antes), un GRANT
-- ON ALL TABLES puntual habría revertido cualquier REVOKE hecho dentro
-- del propio schema. Exclusivo del entorno local/CI de pruebas.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

-- Helpers propios (no son una dependencia externa, son funciones nuestras)
-- para reducir el boilerplate de crear usuarios sintéticos e impersonar
-- roles dentro de los tests de pgTAP.
create schema if not exists tests;

-- Crea un usuario sintético completo (auth.users + perfiles). El trigger
-- on_auth_user_created ya inserta una fila base en perfiles al hacer el
-- INSERT en auth.users; por eso el INSERT en perfiles de abajo usa
-- ON CONFLICT DO UPDATE para fijar los valores que cada test necesita
-- (rol, nutricionista_id, is_active, estatus), sin depender del contenido
-- por defecto que deje el trigger.
--
-- El INSERT en auth.users corre como el rol que llama a esta función
-- (postgres, vía pg_prove) — service_role NO tiene (ni debe tener) INSERT
-- directo ahí, eso lo gestiona exclusivamente el servicio de Auth incluso
-- en producción real.
--
-- El UPDATE de perfiles (via ON CONFLICT) sí dispara el trigger de la
-- Sección 45 (proteger_columnas_sensibles_perfiles), que bloquea cambios a
-- rol/nutricionista_id/stripe_customer_id salvo que current_user =
-- 'service_role' (el mismo bypass que usan las Edge Functions reales, p.ej.
-- invitar-usuario). Por eso cambiamos de rol solo alrededor de ese UPDATE
-- y lo restauramos enseguida — postgres es superusuario, así que puede
-- hacer SET ROLE a cualquier rol sin necesitar membership previo.
create or replace function tests.create_user(
  p_id uuid,
  p_email text,
  p_rol text default 'usuario',
  p_nutricionista_id uuid default null,
  p_is_active boolean default true,
  p_estatus text default 'aprobado'
) returns uuid
language plpgsql
as $fn$
begin
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    'test-fixture-no-login', now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', ''
  );

  set role service_role;

  insert into public.perfiles (id, email, nombre_completo, rol, nutricionista_id, is_active, estatus)
  values (p_id, p_email, p_email, p_rol, p_nutricionista_id, p_is_active, p_estatus)
  on conflict (id) do update set
    email            = excluded.email,
    nombre_completo  = excluded.nombre_completo,
    rol              = excluded.rol,
    nutricionista_id = excluded.nutricionista_id,
    is_active        = excluded.is_active,
    estatus          = excluded.estatus;

  reset role;

  return p_id;
end;
$fn$;

-- Fija los JWT claims (request.jwt.claims) para que auth.uid()/auth.role()
-- vean a p_user_id como el usuario autenticado. NO cambia el rol de
-- Postgres: cada test file debe seguir ejecutando "set local role
-- authenticated;" explícitamente después de llamar a este helper (ese
-- patrón ya está probado manualmente en A2/A2.2 y lo dejamos como
-- statement literal, no escondido dentro de una función).
create or replace function tests.authenticate_as(p_user_id uuid) returns void
language sql
as $fn$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
$fn$;
`;

function resetDatabase() {
  console.log('Corriendo "supabase db reset" — esto reconstruye el schema completo desde cero');
  console.log('a partir de supabase/migrations/ y es lo que valida que supabase_schema.sql');
  console.log('realmente es reproducible.');
  if (!run(...supabaseCmd(['db', 'reset']))) {
    console.error('');
    console.error('"supabase db reset" falló — el schema/migraciones NO se reconstruyeron');
    console.error('correctamente. Deteniendo aquí: no voy a correr pgTAP contra un schema');
    console.error('incompleto. Revisa el error de arriba (probablemente una sentencia de');
    console.error('supabase_schema.sql referenciando algo que aún no existe en ese punto).');
    console.error('');
    process.exit(1);
  }
}

checkDocker();
ensureSupabaseStarted();
syncTestMigrations();
resetDatabase();

console.log('"supabase db reset" OK. Corriendo "supabase test db" ...');
if (!run(...supabaseCmd(['test', 'db']))) {
  process.exit(1);
}
