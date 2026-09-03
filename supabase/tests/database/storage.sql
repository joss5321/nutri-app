-- Pruebas de las policies de Storage sobre storage.objects para los
-- buckets "avatars" y "videos-ejercicios" (Sección 64 de
-- supabase_schema.sql, H2 del barrido final de auditoría).
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(21);

-- storage.objects tiene un guard propio de Supabase (trigger STATEMENT-level
-- "protect_objects_delete") que bloquea CUALQUIER DELETE directo por SQL,
-- sin importar el rol — pensado para evitar borrar filas huérfanas sin
-- pasar por la Storage API real. Es un guard de nivel STATEMENT (su
-- resultado se ignora), no participa en la evaluación de RLS — al
-- desactivarlo aquí, el DELETE sigue sujeto a la policy de RLS normal, que
-- es exactamente lo que estas pruebas necesitan verificar.
set local storage.allow_delete_query = 'true';

-- ── Fixtures sintéticos ──────────────────────────────────────────────
select tests.create_user('80000000-0000-4000-8000-000000000003'::uuid, 'admin-a@test.local',      'admin');
select tests.create_user('80000000-0000-4000-8000-000000000004'::uuid, 'admin-b@test.local',      'admin');
select tests.create_user('80000000-0000-4000-8000-000000000005'::uuid, 'superadmin@test.local',   'superadmin');
select tests.create_user('80000000-0000-4000-8000-000000000001'::uuid, 'paciente-a@test.local',   'usuario', '80000000-0000-4000-8000-000000000003'::uuid, true, 'aprobado');
select tests.create_user('80000000-0000-4000-8000-000000000002'::uuid, 'paciente-b@test.local',   'usuario', '80000000-0000-4000-8000-000000000004'::uuid, true, 'aprobado');

-- Objetos preexistentes (insertados como rol por defecto, sin pasar por RLS).
insert into storage.objects (bucket_id, name) values
  ('avatars', '80000000-0000-4000-8000-000000000001.jpg'),  -- avatar de Paciente A
  ('avatars', '80000000-0000-4000-8000-000000000002.jpg'),  -- avatar de Paciente B (ajeno)
  ('avatars', '80000000-0000-4000-8000-000000000004.jpg'),  -- avatar de Admin B
  ('videos-ejercicios', '10000000-0000-4000-8000-0000000000e1.mp4');

-- ══════════════════════════ avatars ══════════════════════════

-- 1. Paciente A SELECT avatar de Paciente B (ajeno) = permitido (lectura pública)
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = '80000000-0000-4000-8000-000000000002.jpg'), 1,
  'avatars: SELECT de avatar ajeno = permitido (lectura pública)');
reset role;

-- 2. Paciente A INSERT propio (path nuevo, mismo uid) = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '80000000-0000-4000-8000-000000000001.png') $$,
  'avatars: paciente INSERT su propio avatar = permitido');
reset role;

-- 3. Paciente A UPDATE propio = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ update storage.objects set metadata = '{"test":true}'::jsonb where bucket_id = 'avatars' and name = '80000000-0000-4000-8000-000000000001.jpg' $$,
  'avatars: paciente UPDATE su propio avatar = permitido');
reset role;

-- 4. Paciente A DELETE propio = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from storage.objects where bucket_id = 'avatars' and name = '80000000-0000-4000-8000-000000000001.png' $$,
  'avatars: paciente DELETE su propio avatar = permitido');
reset role;

-- 5. Paciente A INSERT avatar de Paciente B (ajeno) = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '80000000-0000-4000-8000-000000000002.png') $$,
  '42501', null, 'avatars: paciente INSERT avatar ajeno = bloqueado');
reset role;

-- 6. Paciente A UPDATE avatar de Paciente B (ajeno) = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update storage.objects set metadata = '{"hack":true}'::jsonb
  where bucket_id = 'avatars' and name = '80000000-0000-4000-8000-000000000002.jpg'
  returning 1
)
select is((select count(*) from actualizado)::int, 0, 'avatars: paciente UPDATE avatar ajeno = bloqueado');
reset role;

-- 7. Paciente A DELETE avatar de Paciente B (ajeno) = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from storage.objects
  where bucket_id = 'avatars' and name = '80000000-0000-4000-8000-000000000002.jpg'
  returning 1
)
select is((select count(*) from borrado)::int, 0, 'avatars: paciente DELETE avatar ajeno = bloqueado');
reset role;

-- 8. Admin A sube imagen de suplemento (suplementos/...) = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', 'suplementos/test-imagen.jpg') $$,
  'avatars: admin INSERT bajo suplementos/ = permitido');
reset role;

-- 9. Paciente A sube imagen de suplemento (suplementos/...) = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', 'suplementos/hack.jpg') $$,
  '42501', null, 'avatars: paciente INSERT bajo suplementos/ = bloqueado');
reset role;

-- 10. Admin A (no superadmin) modifica avatar de Paciente B (otro usuario) = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update storage.objects set metadata = '{"hack":true}'::jsonb
  where bucket_id = 'avatars' and name = '80000000-0000-4000-8000-000000000002.jpg'
  returning 1
)
select is((select count(*) from actualizado)::int, 0, 'avatars: admin normal UPDATE avatar de otro usuario = bloqueado');
reset role;

-- 11. Superadmin modifica avatar de Admin B (otro admin, flujo real de /administradores) = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update storage.objects set metadata = '{"editado_por_superadmin":true}'::jsonb
     where bucket_id = 'avatars' and name = '80000000-0000-4000-8000-000000000004.jpg' $$,
  'avatars: superadmin UPDATE avatar de otro admin = permitido');
reset role;

-- ══════════════════════════ videos-ejercicios ══════════════════════════

-- 12. Paciente INSERT = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('videos-ejercicios', '10000000-0000-4000-8000-0000000000e2.mp4') $$,
  '42501', null, 'videos-ejercicios: paciente INSERT = bloqueado');
reset role;

-- 13. Paciente UPDATE = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update storage.objects set metadata = '{"hack":true}'::jsonb
  where bucket_id = 'videos-ejercicios' and name = '10000000-0000-4000-8000-0000000000e1.mp4'
  returning 1
)
select is((select count(*) from actualizado)::int, 0, 'videos-ejercicios: paciente UPDATE = bloqueado');
reset role;

-- 14. Paciente DELETE = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from storage.objects
  where bucket_id = 'videos-ejercicios' and name = '10000000-0000-4000-8000-0000000000e1.mp4'
  returning 1
)
select is((select count(*) from borrado)::int, 0, 'videos-ejercicios: paciente DELETE = bloqueado');
reset role;

-- 15-17. Admin INSERT/UPDATE/DELETE = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('videos-ejercicios', '10000000-0000-4000-8000-0000000000e3.mp4') $$,
  'videos-ejercicios: admin INSERT = permitido');
reset role;

select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update storage.objects set metadata = '{"editado":true}'::jsonb
     where bucket_id = 'videos-ejercicios' and name = '10000000-0000-4000-8000-0000000000e3.mp4' $$,
  'videos-ejercicios: admin UPDATE = permitido');
reset role;

select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from storage.objects where bucket_id = 'videos-ejercicios' and name = '10000000-0000-4000-8000-0000000000e3.mp4' $$,
  'videos-ejercicios: admin DELETE = permitido');
reset role;

-- 18-20. Superadmin INSERT/UPDATE/DELETE = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('videos-ejercicios', '10000000-0000-4000-8000-0000000000e4.mp4') $$,
  'videos-ejercicios: superadmin INSERT = permitido');
reset role;

select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update storage.objects set metadata = '{"editado":true}'::jsonb
     where bucket_id = 'videos-ejercicios' and name = '10000000-0000-4000-8000-0000000000e4.mp4' $$,
  'videos-ejercicios: superadmin UPDATE = permitido');
reset role;

select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from storage.objects where bucket_id = 'videos-ejercicios' and name = '10000000-0000-4000-8000-0000000000e4.mp4' $$,
  'videos-ejercicios: superadmin DELETE = permitido');
reset role;

-- 21. SELECT público (cualquier authenticated, incluido paciente) = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'videos-ejercicios' and name = '10000000-0000-4000-8000-0000000000e1.mp4'), 1,
  'videos-ejercicios: SELECT público = permitido');
reset role;

select * from finish();
rollback;
