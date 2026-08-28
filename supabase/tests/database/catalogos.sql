-- Pruebas RLS de public.ejercicios, public.alimentos y
-- public.suplementos (Sección 54 de supabase_schema.sql). Cobertura:
-- catálogo con ownership por created_by (ejercicios/alimentos, con
-- semánticas distintas de SELECT documentadas explícitamente), catálogo
-- compartido sin ownership (suplementos), y protección de created_by.
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada, sin datos
-- reales de producción.

begin;
select plan(55);

-- ── Fixtures sintéticos ──────────────────────────────────────────────
select tests.create_user('80000000-0000-4000-8000-000000000003'::uuid, 'admin-a@test.local',       'admin');
select tests.create_user('80000000-0000-4000-8000-000000000004'::uuid, 'admin-b@test.local',       'admin');
select tests.create_user('80000000-0000-4000-8000-000000000005'::uuid, 'superadmin-1@test.local',  'superadmin');
select tests.create_user('80000000-0000-4000-8000-000000000006'::uuid, 'superadmin-2@test.local',  'superadmin');
select tests.create_user('80000000-0000-4000-8000-000000000001'::uuid, 'paciente-a@test.local',    'usuario', '80000000-0000-4000-8000-000000000003'::uuid, true, 'aprobado');

-- ══════════════════════════════════════════════════════════════════
-- EJERCICIOS
-- ══════════════════════════════════════════════════════════════════

insert into ejercicios (id, nombre, created_by) values ('80000000-0000-4000-8000-0000000000e1', 'Ejercicio global', null);
insert into ejercicios (id, nombre, created_by) values ('80000000-0000-4000-8000-0000000000e2', 'Ejercicio Admin A', '80000000-0000-4000-8000-000000000003');
insert into ejercicios (id, nombre, created_by) values ('80000000-0000-4000-8000-0000000000e3', 'Ejercicio Admin A (borrar)', '80000000-0000-4000-8000-000000000003');
insert into ejercicios (id, nombre, created_by) values ('80000000-0000-4000-8000-0000000000e4', 'Ejercicio Admin B', '80000000-0000-4000-8000-000000000004');
insert into ejercicios (id, nombre, created_by) values ('80000000-0000-4000-8000-0000000000e5', 'Ejercicio Superadmin 2', '80000000-0000-4000-8000-000000000006');

-- 1. Paciente SELECT ve TODO el catálogo, incluido lo creado por un admin
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from ejercicios where id = '80000000-0000-4000-8000-0000000000e2')::int, 1,
  'ejercicios: paciente SELECT ve todo el catálogo (incluido lo creado por un admin)');
reset role;

-- 2. Paciente INSERT = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into ejercicios (nombre) values ('hack') $$,
  '42501', null, 'ejercicios: paciente INSERT = bloqueado');
reset role;

-- 3. Paciente UPDATE = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update ejercicios set nombre = 'hack' where id = '80000000-0000-4000-8000-0000000000e2' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'ejercicios: paciente UPDATE = bloqueado');
reset role;

-- 4. Paciente DELETE = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from ejercicios where id = '80000000-0000-4000-8000-0000000000e2' returning 1
)
select is((select count(*) from borrado)::int, 0, 'ejercicios: paciente DELETE = bloqueado');
reset role;

-- 5. Admin A INSERT propio (sin created_by) = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into ejercicios (id, nombre) values ('80000000-0000-4000-8000-00000000a001', 'Ejercicio nuevo Admin A') $$,
  'ejercicios: admin INSERT propio = permitido');
reset role;

-- 6. Admin A INSERT falsificando created_by=Admin B = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into ejercicios (nombre, created_by) values ('hack', '80000000-0000-4000-8000-000000000004') $$,
  '42501', null, 'ejercicios: admin INSERT falsificando created_by ajeno = bloqueado');
reset role;

-- 7. Admin A UPDATE propio = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update ejercicios set nombre = 'Ejercicio Admin A (editado)' where id = '80000000-0000-4000-8000-0000000000e2' $$,
  'ejercicios: admin UPDATE propio = permitido');
reset role;

-- 8. Admin A DELETE propio = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from ejercicios where id = '80000000-0000-4000-8000-0000000000e3' $$,
  'ejercicios: admin DELETE propio = permitido');
reset role;

-- 9. Admin A UPDATE ajeno (Admin B) = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update ejercicios set nombre = 'hack' where id = '80000000-0000-4000-8000-0000000000e4' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'ejercicios: admin UPDATE ajeno = bloqueado');
reset role;

-- 10. Admin A DELETE ajeno (Admin B) = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from ejercicios where id = '80000000-0000-4000-8000-0000000000e4' returning 1
)
select is((select count(*) from borrado)::int, 0, 'ejercicios: admin DELETE ajeno = bloqueado');
reset role;

-- 11. Admin A UPDATE global = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update ejercicios set nombre = 'hack' where id = '80000000-0000-4000-8000-0000000000e1' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'ejercicios: admin UPDATE global = bloqueado');
reset role;

-- 12. Admin A DELETE global = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from ejercicios where id = '80000000-0000-4000-8000-0000000000e1' returning 1
)
select is((select count(*) from borrado)::int, 0, 'ejercicios: admin DELETE global = bloqueado');
reset role;

-- 13. Admin A UPDATE created_by->Admin B sobre SU PROPIO ejercicio = bloqueado
--     (RLS (USING) sí le permite llegar a la fila porque es la suya; el
--     WITH CHECK explícito rechaza la fila nueva por el cambio de dueño).
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update ejercicios set created_by = '80000000-0000-4000-8000-000000000004' where id = '80000000-0000-4000-8000-0000000000e2' $$,
  null, null, 'ejercicios: admin UPDATE created_by hacia otro admin = bloqueado (RLS ya permitía llegar a la fila)');
reset role;

-- 14. Superadmin 1 UPDATE global = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update ejercicios set nombre = 'Ejercicio global (editado)' where id = '80000000-0000-4000-8000-0000000000e1' $$,
  'ejercicios: superadmin UPDATE global = permitido');
reset role;

-- 15. Superadmin 1 DELETE global = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from ejercicios where id = '80000000-0000-4000-8000-0000000000e1' $$,
  'ejercicios: superadmin DELETE global = permitido');
reset role;

-- 16. Superadmin 1 UPDATE creado por Superadmin 2 = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update ejercicios set nombre = 'Ejercicio SA2 (editado)' where id = '80000000-0000-4000-8000-0000000000e5' $$,
  'ejercicios: superadmin UPDATE creado por otro superadmin = permitido');
reset role;

-- 17. Superadmin 1 DELETE creado por Superadmin 2 = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from ejercicios where id = '80000000-0000-4000-8000-0000000000e5' $$,
  'ejercicios: superadmin DELETE creado por otro superadmin = permitido');
reset role;

-- 18. Superadmin 1 UPDATE creado por admin normal = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
with actualizado as (
  update ejercicios set nombre = 'hack' where id = '80000000-0000-4000-8000-0000000000e4' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'ejercicios: superadmin UPDATE creado por admin normal = bloqueado');
reset role;

-- 19. Superadmin 1 DELETE creado por admin normal = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
with borrado as (
  delete from ejercicios where id = '80000000-0000-4000-8000-0000000000e4' returning 1
)
select is((select count(*) from borrado)::int, 0, 'ejercicios: superadmin DELETE creado por admin normal = bloqueado');
reset role;

-- 20. Superadmin 1 SELECT creado por admin normal = PERMITIDO
--     (vía "ejercicios: lectura para autenticados", que se conserva
--     intencionalmente y da SELECT global a cualquier authenticated —
--     documentado explícitamente, no una inconsistencia).
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from ejercicios where id = '80000000-0000-4000-8000-0000000000e4')::int, 1,
  'ejercicios: superadmin SELECT creado por admin normal = permitido (lectura global se conserva)');
reset role;

-- ══════════════════════════════════════════════════════════════════
-- ALIMENTOS
-- ══════════════════════════════════════════════════════════════════

-- trg_set_created_by_alimentos sobreescribe created_by con auth.uid() para
-- cualquier admin/superadmin; auth.uid() sigue "pegado" al último usuario
-- de tests.authenticate_as() de la sección anterior (reset role NO limpia
-- request.jwt.claims). Insertamos como service_role — el mismo bypass que
-- ya usa tests.create_user() para el trigger de perfiles — para que estos
-- INSERT de fixtures conserven el created_by exacto que se especifica.
set role service_role;
insert into alimentos (id, nombre, created_by) values ('80000000-0000-4000-8000-0000000000f1', 'Alimento global', null);
insert into alimentos (id, nombre, created_by) values ('80000000-0000-4000-8000-0000000000f2', 'Alimento Admin A', '80000000-0000-4000-8000-000000000003');
insert into alimentos (id, nombre, created_by) values ('80000000-0000-4000-8000-0000000000f3', 'Alimento Admin A (borrar)', '80000000-0000-4000-8000-000000000003');
insert into alimentos (id, nombre, created_by) values ('80000000-0000-4000-8000-0000000000f4', 'Alimento Admin B', '80000000-0000-4000-8000-000000000004');
insert into alimentos (id, nombre, created_by) values ('80000000-0000-4000-8000-0000000000f5', 'Alimento Superadmin 2', '80000000-0000-4000-8000-000000000006');
reset role;

-- 21. Paciente SELECT = bloqueado (0 filas — a diferencia de ejercicios,
--     alimentos no conserva ninguna lectura amplia)
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from alimentos where id = '80000000-0000-4000-8000-0000000000f2')::int, 0,
  'alimentos: paciente SELECT = bloqueado');
reset role;

-- 22. Paciente INSERT = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into alimentos (nombre) values ('hack') $$,
  '42501', null, 'alimentos: paciente INSERT = bloqueado');
reset role;

-- 23. Paciente UPDATE = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update alimentos set nombre = 'hack' where id = '80000000-0000-4000-8000-0000000000f2' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'alimentos: paciente UPDATE = bloqueado');
reset role;

-- 24. Paciente DELETE = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from alimentos where id = '80000000-0000-4000-8000-0000000000f2' returning 1
)
select is((select count(*) from borrado)::int, 0, 'alimentos: paciente DELETE = bloqueado');
reset role;

-- 25. Admin A INSERT sin created_by = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into alimentos (id, nombre) values ('80000000-0000-4000-8000-00000000a002', 'Alimento nuevo Admin A') $$,
  'alimentos: admin INSERT sin created_by = permitido');
reset role;

-- 26. Confirmar que created_by quedó fijado a Admin A por el trigger
select is(
  (select created_by from alimentos where id = '80000000-0000-4000-8000-00000000a002')::text,
  '80000000-0000-4000-8000-000000000003',
  'alimentos: created_by se autopobla con el creador real');

-- 27. Admin A INSERT enviando created_by=Admin B (falsificación) = permitido
--     (el trigger sobreescribe el valor, no se rechaza el INSERT)
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into alimentos (id, nombre, created_by) values ('80000000-0000-4000-8000-00000000a003', 'Alimento spoof', '80000000-0000-4000-8000-000000000004') $$,
  'alimentos: admin INSERT enviando created_by ajeno = permitido (el valor se sobreescribe)');
reset role;

-- 28. Confirmar que el created_by falsificado se sobreescribió con Admin A
select is(
  (select created_by from alimentos where id = '80000000-0000-4000-8000-00000000a003')::text,
  '80000000-0000-4000-8000-000000000003',
  'alimentos: created_by falsificado se sobreescribe con el auth.uid() real');

-- 29. Admin A UPDATE created_by->Admin B sobre SU PROPIO alimento = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update alimentos set created_by = '80000000-0000-4000-8000-000000000004' where id = '80000000-0000-4000-8000-0000000000f2' $$,
  null, null, 'alimentos: admin UPDATE created_by hacia otro admin = bloqueado (RLS ya permitía llegar a la fila)');
reset role;

-- 30. Admin A UPDATE propio = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update alimentos set nombre = 'Alimento Admin A (editado)' where id = '80000000-0000-4000-8000-0000000000f2' $$,
  'alimentos: admin UPDATE propio = permitido');
reset role;

-- 31. Admin A DELETE propio = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from alimentos where id = '80000000-0000-4000-8000-0000000000f3' $$,
  'alimentos: admin DELETE propio = permitido');
reset role;

-- 32. Admin A UPDATE ajeno = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update alimentos set nombre = 'hack' where id = '80000000-0000-4000-8000-0000000000f4' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'alimentos: admin UPDATE ajeno = bloqueado');
reset role;

-- 33. Admin A DELETE ajeno = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from alimentos where id = '80000000-0000-4000-8000-0000000000f4' returning 1
)
select is((select count(*) from borrado)::int, 0, 'alimentos: admin DELETE ajeno = bloqueado');
reset role;

-- 34. Admin A UPDATE global = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update alimentos set nombre = 'hack' where id = '80000000-0000-4000-8000-0000000000f1' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'alimentos: admin UPDATE global = bloqueado');
reset role;

-- 35. Admin A DELETE global = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from alimentos where id = '80000000-0000-4000-8000-0000000000f1' returning 1
)
select is((select count(*) from borrado)::int, 0, 'alimentos: admin DELETE global = bloqueado');
reset role;

-- 36. Admin A SELECT propio = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from alimentos where id = '80000000-0000-4000-8000-0000000000f2')::int, 1,
  'alimentos: admin SELECT propio = permitido');
reset role;

-- 37. Admin A SELECT global = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from alimentos where id = '80000000-0000-4000-8000-0000000000f1')::int, 1,
  'alimentos: admin SELECT global = permitido');
reset role;

-- 38. Admin A SELECT ajeno = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from alimentos where id = '80000000-0000-4000-8000-0000000000f4')::int, 0,
  'alimentos: admin SELECT ajeno = bloqueado');
reset role;

-- 39. Superadmin 1 UPDATE global = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update alimentos set nombre = 'Alimento global (editado)' where id = '80000000-0000-4000-8000-0000000000f1' $$,
  'alimentos: superadmin UPDATE global = permitido');
reset role;

-- 40. Superadmin 1 DELETE global = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from alimentos where id = '80000000-0000-4000-8000-0000000000f1' $$,
  'alimentos: superadmin DELETE global = permitido');
reset role;

-- 41. Superadmin 1 UPDATE creado por Superadmin 2 = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update alimentos set nombre = 'Alimento SA2 (editado)' where id = '80000000-0000-4000-8000-0000000000f5' $$,
  'alimentos: superadmin UPDATE creado por otro superadmin = permitido');
reset role;

-- 42. Superadmin 1 DELETE creado por Superadmin 2 = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from alimentos where id = '80000000-0000-4000-8000-0000000000f5' $$,
  'alimentos: superadmin DELETE creado por otro superadmin = permitido');
reset role;

-- 43. Superadmin 1 UPDATE creado por admin normal = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
with actualizado as (
  update alimentos set nombre = 'hack' where id = '80000000-0000-4000-8000-0000000000f4' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'alimentos: superadmin UPDATE creado por admin normal = bloqueado');
reset role;

-- 44. Superadmin 1 DELETE creado por admin normal = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
with borrado as (
  delete from alimentos where id = '80000000-0000-4000-8000-0000000000f4' returning 1
)
select is((select count(*) from borrado)::int, 0, 'alimentos: superadmin DELETE creado por admin normal = bloqueado');
reset role;

-- 45. Superadmin 1 SELECT creado por admin normal = NO VISIBLE
--     (a diferencia de ejercicios: aquí SÍ se eliminó la lectura legacy,
--     así que alimentos_select manda, y su cláusula de superadmin no
--     cubre lo creado por un admin normal).
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from alimentos where id = '80000000-0000-4000-8000-0000000000f4')::int, 0,
  'alimentos: superadmin SELECT creado por admin normal = NO visible (sin lectura legacy amplia)');
reset role;

-- ══════════════════════════════════════════════════════════════════
-- SUPLEMENTOS
-- ══════════════════════════════════════════════════════════════════

insert into suplementos (id, nombre) values ('80000000-0000-4000-8000-0000000000d1', 'Suplemento Test');

-- 46. Paciente SELECT = permitido (catálogo compartido, sin ownership)
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from suplementos where id = '80000000-0000-4000-8000-0000000000d1')::int, 1,
  'suplementos: paciente SELECT = permitido');
reset role;

-- 47. Paciente INSERT = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into suplementos (nombre) values ('hack') $$,
  '42501', null, 'suplementos: paciente INSERT = bloqueado');
reset role;

-- 48. Paciente UPDATE = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update suplementos set nombre = 'hack' where id = '80000000-0000-4000-8000-0000000000d1' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'suplementos: paciente UPDATE = bloqueado');
reset role;

-- 49. Paciente DELETE = bloqueado
select tests.authenticate_as('80000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from suplementos where id = '80000000-0000-4000-8000-0000000000d1' returning 1
)
select is((select count(*) from borrado)::int, 0, 'suplementos: paciente DELETE = bloqueado');
reset role;

-- 50. Admin A INSERT = permitido (catálogo global, sin ownership)
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into suplementos (id, nombre) values ('80000000-0000-4000-8000-0000000000d2', 'Suplemento Admin A') $$,
  'suplementos: admin INSERT = permitido');
reset role;

-- 51. Admin A UPDATE (cualquier fila del catálogo, no solo la suya) = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update suplementos set nombre = 'Suplemento Test (editado por Admin A)' where id = '80000000-0000-4000-8000-0000000000d1' $$,
  'suplementos: admin UPDATE (catálogo global, no solo lo suyo) = permitido');
reset role;

-- 52. Admin A DELETE (cualquier fila del catálogo) = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from suplementos where id = '80000000-0000-4000-8000-0000000000d2' $$,
  'suplementos: admin DELETE (catálogo global) = permitido');
reset role;

-- 53. Superadmin INSERT = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into suplementos (id, nombre) values ('80000000-0000-4000-8000-0000000000d3', 'Suplemento Superadmin') $$,
  'suplementos: superadmin INSERT = permitido');
reset role;

-- 54. Superadmin UPDATE = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update suplementos set nombre = 'Suplemento Test (editado por superadmin)' where id = '80000000-0000-4000-8000-0000000000d1' $$,
  'suplementos: superadmin UPDATE = permitido');
reset role;

-- 55. Superadmin DELETE = permitido
select tests.authenticate_as('80000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from suplementos where id = '80000000-0000-4000-8000-0000000000d3' $$,
  'suplementos: superadmin DELETE = permitido');
reset role;

select * from finish();
rollback;
