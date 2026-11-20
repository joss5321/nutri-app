-- Pruebas RLS de public.planes_nutricionales y public.plan_equivalentes
-- (Sección 50 de supabase_schema.sql). Cobertura completa de la matriz de
-- permisos: paciente propio/ajeno, admin dueño/ajeno, superadmin, más los
-- 4 estados de negocio del paciente destino en INSERT de planes.
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada, sin datos
-- reales de producción.

begin;
select plan(48);

-- ── Fixtures sintéticos ──────────────────────────────────────────────
select tests.create_user('40000000-0000-4000-8000-000000000003'::uuid, 'admin-a@test.local',    'admin');
select tests.create_user('40000000-0000-4000-8000-000000000004'::uuid, 'admin-b@test.local',    'admin');
select tests.create_user('40000000-0000-4000-8000-000000000005'::uuid, 'superadmin@test.local', 'superadmin');
select tests.create_user('40000000-0000-4000-8000-000000000001'::uuid, 'paciente-a@test.local', 'usuario', '40000000-0000-4000-8000-000000000003'::uuid, true, 'aprobado');
select tests.create_user('40000000-0000-4000-8000-000000000002'::uuid, 'paciente-b@test.local', 'usuario', '40000000-0000-4000-8000-000000000004'::uuid, true, 'aprobado');

-- Pacientes en los otros 3 estados de negocio (dueños de Admin A, para que
-- las pruebas de "admin dueño" sean significativas — ownership correcta,
-- pero bloqueado por estado).
select tests.create_user('40000000-0000-4000-8000-000000000006'::uuid, 'paciente-pendiente@test.local',    'usuario', '40000000-0000-4000-8000-000000000003'::uuid, false, 'pendiente');
select tests.create_user('40000000-0000-4000-8000-000000000007'::uuid, 'paciente-rechazado@test.local',    'usuario', '40000000-0000-4000-8000-000000000003'::uuid, false, 'rechazado');
select tests.create_user('40000000-0000-4000-8000-000000000008'::uuid, 'paciente-deshabilitado@test.local', 'usuario', '40000000-0000-4000-8000-000000000003'::uuid, false, 'aprobado');

-- Estructura preexistente de Paciente A (propia) y Paciente B (ajena).
-- Insertada como el rol por defecto (bypasea RLS).
insert into planes_nutricionales (id, user_id, objetivo, activo)
values ('40000000-0000-4000-8000-0000000000f1', '40000000-0000-4000-8000-000000000001', 'Bajar de peso', true);
insert into plan_equivalentes (id, plan_id, grupo, desayuno)
values ('40000000-0000-4000-8000-0000000000f2', '40000000-0000-4000-8000-0000000000f1', 'Frutas', 2);

insert into planes_nutricionales (id, user_id, objetivo, activo)
values ('40000000-0000-4000-8000-0000000000f3', '40000000-0000-4000-8000-000000000002', 'Ganar músculo', true);
insert into plan_equivalentes (id, plan_id, grupo, desayuno)
values ('40000000-0000-4000-8000-0000000000f4', '40000000-0000-4000-8000-0000000000f3', 'Verduras', 3);

-- ══════════════════════ Paciente A — propio ══════════════════════

-- 1. SELECT propio (planes_nutricionales) = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from planes_nutricionales where id = '40000000-0000-4000-8000-0000000000f1')::int, 1,
  'planes_nutricionales: paciente propio SELECT = permitido');
reset role;

-- 2. INSERT propio (planes_nutricionales) = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into planes_nutricionales (user_id, objetivo) values ('40000000-0000-4000-8000-000000000001', 'Hack') $$,
  '42501', null, 'planes_nutricionales: paciente propio INSERT = bloqueado');
reset role;

-- 3. UPDATE propio (planes_nutricionales) = bloqueado (no existe policy UPDATE)
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update planes_nutricionales set objetivo = 'hack' where id = '40000000-0000-4000-8000-0000000000f1' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'planes_nutricionales: paciente propio UPDATE = bloqueado');
reset role;

-- 4. DELETE propio (planes_nutricionales) = bloqueado (no existe policy DELETE)
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from planes_nutricionales where id = '40000000-0000-4000-8000-0000000000f1' returning 1
)
select is((select count(*) from borrado)::int, 0, 'planes_nutricionales: paciente propio DELETE = bloqueado');
reset role;

-- 5. SELECT propios (plan_equivalentes) = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from plan_equivalentes where id = '40000000-0000-4000-8000-0000000000f2')::int, 1,
  'plan_equivalentes: paciente propio SELECT = permitido');
reset role;

-- 6. INSERT en su propio plan (plan_equivalentes) = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_equivalentes (plan_id, grupo) values ('40000000-0000-4000-8000-0000000000f1', 'Cereales sin grasa') $$,
  '42501', null, 'plan_equivalentes: paciente propio INSERT (incluso en su propio plan) = bloqueado');
reset role;

-- 7. UPDATE (plan_equivalentes) = bloqueado (no existe policy UPDATE)
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update plan_equivalentes set desayuno = 9 where id = '40000000-0000-4000-8000-0000000000f2' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'plan_equivalentes: paciente propio UPDATE = bloqueado');
reset role;

-- 8. DELETE de su propio equivalente = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from plan_equivalentes where id = '40000000-0000-4000-8000-0000000000f2' returning 1
)
select is((select count(*) from borrado)::int, 0, 'plan_equivalentes: paciente propio DELETE = bloqueado');
reset role;

-- ══════════════════════ Paciente A vs Paciente B ══════════════════════

-- 9. SELECT plan de Paciente B = 0
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from planes_nutricionales where id = '40000000-0000-4000-8000-0000000000f3')::int, 0,
  'planes_nutricionales: paciente ajeno SELECT = bloqueado');
reset role;

-- 10. SELECT equivalentes de Paciente B = 0
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from plan_equivalentes where id = '40000000-0000-4000-8000-0000000000f4')::int, 0,
  'plan_equivalentes: paciente ajeno SELECT = bloqueado');
reset role;

-- 11. INSERT plan para Paciente B = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into planes_nutricionales (user_id, objetivo) values ('40000000-0000-4000-8000-000000000002', 'hack') $$,
  '42501', null, 'planes_nutricionales: paciente ajeno INSERT = bloqueado');
reset role;

-- 12. INSERT equivalente en plan de Paciente B = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_equivalentes (plan_id, grupo) values ('40000000-0000-4000-8000-0000000000f3', 'hack') $$,
  '42501', null, 'plan_equivalentes: paciente ajeno INSERT = bloqueado');
reset role;

-- 13. DELETE equivalente de Paciente B = 0
select tests.authenticate_as('40000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from plan_equivalentes where id = '40000000-0000-4000-8000-0000000000f4' returning 1
)
select is((select count(*) from borrado)::int, 0, 'plan_equivalentes: paciente ajeno DELETE = bloqueado');
reset role;

-- ══════════════════════ Admin A — su Paciente A ══════════════════════

-- 14. SELECT plan de su paciente = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from planes_nutricionales where id = '40000000-0000-4000-8000-0000000000f1')::int, 1,
  'planes_nutricionales: admin dueño SELECT = permitido');
reset role;

-- 15. INSERT plan para su paciente (activo+aprobado) = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into planes_nutricionales (id, user_id, objetivo)
     values ('40000000-0000-4000-8000-0000000000a1', '40000000-0000-4000-8000-000000000001', 'Plan nuevo') $$,
  'planes_nutricionales: admin dueño INSERT (paciente activo+aprobado) = permitido');
reset role;

-- 16. SELECT equivalentes de su paciente = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from plan_equivalentes where id = '40000000-0000-4000-8000-0000000000f2')::int, 1,
  'plan_equivalentes: admin dueño SELECT = permitido');
reset role;

-- 17. INSERT equivalente en plan de su paciente = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into plan_equivalentes (id, plan_id, grupo)
     values ('40000000-0000-4000-8000-0000000000a2', '40000000-0000-4000-8000-0000000000f1', 'Leguminosas') $$,
  'plan_equivalentes: admin dueño INSERT = permitido');
reset role;

-- 18. DELETE ese equivalente = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from plan_equivalentes where id = '40000000-0000-4000-8000-0000000000a2' $$,
  'plan_equivalentes: admin dueño DELETE = permitido');
reset role;

-- 19. UPDATE equivalente de su paciente = bloqueado (código no lo necesita)
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update plan_equivalentes set desayuno = 9 where id = '40000000-0000-4000-8000-0000000000f2' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'plan_equivalentes: admin dueño UPDATE = bloqueado');
reset role;

-- 20. UPDATE plan de su paciente = bloqueado (no existe policy UPDATE)
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update planes_nutricionales set objetivo = 'hack' where id = '40000000-0000-4000-8000-0000000000f1' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'planes_nutricionales: admin dueño UPDATE = bloqueado');
reset role;

-- 21. DELETE plan de su paciente = bloqueado (no existe policy DELETE)
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from planes_nutricionales where id = '40000000-0000-4000-8000-0000000000f1' returning 1
)
select is((select count(*) from borrado)::int, 0, 'planes_nutricionales: admin dueño DELETE = bloqueado');
reset role;

-- ══════════════════════ Admin A vs Paciente B ══════════════════════

-- 22. SELECT plan de paciente ajeno = 0
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from planes_nutricionales where id = '40000000-0000-4000-8000-0000000000f3')::int, 0,
  'planes_nutricionales: admin ajeno SELECT = bloqueado');
reset role;

-- 23. INSERT plan para paciente ajeno = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into planes_nutricionales (user_id, objetivo) values ('40000000-0000-4000-8000-000000000002', 'hack admin') $$,
  '42501', null, 'planes_nutricionales: admin ajeno INSERT = bloqueado');
reset role;

-- 24. SELECT equivalentes de paciente ajeno = 0
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from plan_equivalentes where id = '40000000-0000-4000-8000-0000000000f4')::int, 0,
  'plan_equivalentes: admin ajeno SELECT = bloqueado');
reset role;

-- 25. INSERT equivalente en plan de paciente ajeno = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_equivalentes (plan_id, grupo) values ('40000000-0000-4000-8000-0000000000f3', 'hack') $$,
  '42501', null, 'plan_equivalentes: admin ajeno INSERT = bloqueado');
reset role;

-- 26. DELETE equivalente de paciente ajeno = 0
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from plan_equivalentes where id = '40000000-0000-4000-8000-0000000000f4' returning 1
)
select is((select count(*) from borrado)::int, 0, 'plan_equivalentes: admin ajeno DELETE = bloqueado');
reset role;

-- ══════════════════════ Superadmin ══════════════════════

-- 27. SELECT global (plan de cualquier paciente) = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from planes_nutricionales where id = '40000000-0000-4000-8000-0000000000f3')::int, 1,
  'planes_nutricionales: superadmin SELECT = permitido');
reset role;

-- 28. INSERT plan para cualquier paciente (activo+aprobado) = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into planes_nutricionales (id, user_id, objetivo)
     values ('40000000-0000-4000-8000-0000000000a4', '40000000-0000-4000-8000-000000000002', 'Plan superadmin') $$,
  'planes_nutricionales: superadmin INSERT = permitido');
reset role;

-- 29. SELECT equivalentes de cualquier paciente = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from plan_equivalentes where id = '40000000-0000-4000-8000-0000000000f4')::int, 1,
  'plan_equivalentes: superadmin SELECT = permitido');
reset role;

-- 30. INSERT equivalente en plan de cualquier paciente = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into plan_equivalentes (id, plan_id, grupo)
     values ('40000000-0000-4000-8000-0000000000a3', '40000000-0000-4000-8000-0000000000f3', 'Aceites y grasas') $$,
  'plan_equivalentes: superadmin INSERT = permitido');
reset role;

-- 31. DELETE equivalente de cualquier paciente = permitido
select tests.authenticate_as('40000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from plan_equivalentes where id = '40000000-0000-4000-8000-0000000000a3' $$,
  'plan_equivalentes: superadmin DELETE = permitido');
reset role;

-- ══════════════════════ Estados de negocio del paciente destino ══════════════════════
-- Confirman que get_perfil_activo_aprobado() sigue bloqueando correctamente
-- para ambos actores que la comparten (admin dueño y superadmin).

-- 32. Admin dueño INSERT para paciente pendiente = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into planes_nutricionales (user_id, objetivo) values ('40000000-0000-4000-8000-000000000006', 'x') $$,
  '42501', null, 'planes_nutricionales: admin dueño INSERT para paciente pendiente = bloqueado');
reset role;

-- 33. Admin dueño INSERT para paciente rechazado = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into planes_nutricionales (user_id, objetivo) values ('40000000-0000-4000-8000-000000000007', 'x') $$,
  '42501', null, 'planes_nutricionales: admin dueño INSERT para paciente rechazado = bloqueado');
reset role;

-- 34. Admin dueño INSERT para paciente deshabilitado = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into planes_nutricionales (user_id, objetivo) values ('40000000-0000-4000-8000-000000000008', 'x') $$,
  '42501', null, 'planes_nutricionales: admin dueño INSERT para paciente deshabilitado = bloqueado');
reset role;

-- 35. Superadmin INSERT para paciente pendiente = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into planes_nutricionales (user_id, objetivo) values ('40000000-0000-4000-8000-000000000006', 'x') $$,
  '42501', null, 'planes_nutricionales: superadmin INSERT para paciente pendiente = bloqueado');
reset role;

-- 36. Superadmin INSERT para paciente rechazado = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into planes_nutricionales (user_id, objetivo) values ('40000000-0000-4000-8000-000000000007', 'x') $$,
  '42501', null, 'planes_nutricionales: superadmin INSERT para paciente rechazado = bloqueado');
reset role;

-- 37. Superadmin INSERT para paciente deshabilitado = bloqueado
select tests.authenticate_as('40000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into planes_nutricionales (user_id, objetivo) values ('40000000-0000-4000-8000-000000000008', 'x') $$,
  '42501', null, 'planes_nutricionales: superadmin INSERT para paciente deshabilitado = bloqueado');
reset role;

-- ══════════════════ RPC guardar_equivalentes_plan (Sección 93) ══════════════════
-- Cobertura de atomicidad: caso exitoso, error a mitad de camino,
-- rollback total sin estado parcial, caller no autorizado bloqueado.
-- plan_equivalentes_insert/_delete no tienen regla de estado del paciente
-- (a diferencia de plan_suplementacion) — solo ownership por
-- nutricionista_id o superadmin.

-- 38. Caso exitoso: Admin A reemplaza el plan de equivalentes completo de
--     Paciente A (1 fila preexistente, f2) por 2 filas nuevas.
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ select public.guardar_equivalentes_plan(
       '40000000-0000-4000-8000-0000000000f1'::uuid,
       '[{"grupo":"Frutas","icono":"🍎","desayuno":1,"colacion_1":0,"comida":1,"colacion_2":0,"cena":0},
         {"grupo":"Verduras","icono":"🥦","desayuno":0,"colacion_1":0,"comida":2,"colacion_2":0,"cena":1}]'::jsonb
     ) $$,
  'guardar_equivalentes_plan: admin dueño reemplaza el plan completo = permitido');
reset role;

-- 39-40. El plan quedó reemplazado con el contenido correcto.
select is((select count(*)::int from plan_equivalentes where plan_id = '40000000-0000-4000-8000-0000000000f1'), 2,
  'guardar_equivalentes_plan: plan de Paciente A queda con exactamente las 2 filas nuevas');
select is(
  (select comida from plan_equivalentes where plan_id = '40000000-0000-4000-8000-0000000000f1' and grupo = 'Verduras'),
  2, 'guardar_equivalentes_plan: valor correcto en la fila nueva');

-- 41. Error a mitad de camino: el segundo grupo es NULL (viola el NOT
--     NULL de la columna "grupo") — la llamada entera debe fallar.
select tests.authenticate_as('40000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_equivalentes_plan(
       '40000000-0000-4000-8000-0000000000f1'::uuid,
       '[{"grupo":"Cereales sin grasa","desayuno":1},
         {"grupo":null,"desayuno":1}]'::jsonb
     ) $$,
  '23502', null, 'guardar_equivalentes_plan: grupo NULL en la fila 2 = bloqueado (NOT NULL)');
reset role;

-- 42-43. Rollback total: Paciente A conserva exactamente el plan del test
-- 38 — el DELETE ya ejecutado dentro de la función también se revirtió.
select is((select count(*)::int from plan_equivalentes where plan_id = '40000000-0000-4000-8000-0000000000f1'), 2,
  'guardar_equivalentes_plan: tras el error, Paciente A sigue con sus 2 filas (rollback total)');
select is(
  (select comida from plan_equivalentes where plan_id = '40000000-0000-4000-8000-0000000000f1' and grupo = 'Verduras'),
  2, 'guardar_equivalentes_plan: tras el error, la fila previa (Verduras) sigue intacta (rollback total)');

-- 44-45. Caller no autorizado: Admin B intenta reemplazar el plan de
--     Paciente A (ajeno) = bloqueado, y el plan no sufre ningún cambio.
select tests.authenticate_as('40000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_equivalentes_plan(
       '40000000-0000-4000-8000-0000000000f1'::uuid,
       '[{"grupo":"hack","desayuno":9}]'::jsonb
     ) $$,
  '42501', null, 'guardar_equivalentes_plan: admin ajeno = bloqueado');
reset role;

select is((select count(*)::int from plan_equivalentes where plan_id = '40000000-0000-4000-8000-0000000000f1'), 2,
  'guardar_equivalentes_plan: plan de Paciente A intacto tras el intento no autorizado');

-- ══════════════════ guardar_equivalentes_plan — grants y SECURITY INVOKER ══════════════════

-- 46. authenticated SÍ tiene EXECUTE.
select ok(
  has_function_privilege('authenticated', 'public.guardar_equivalentes_plan(uuid, jsonb)', 'EXECUTE'),
  'guardar_equivalentes_plan: authenticated tiene EXECUTE');

-- 47. anon NO tiene EXECUTE.
select ok(
  not has_function_privilege('anon', 'public.guardar_equivalentes_plan(uuid, jsonb)', 'EXECUTE'),
  'guardar_equivalentes_plan: anon NO tiene EXECUTE');

-- 48. Sigue siendo SECURITY INVOKER (prosecdef = false).
select is(
  (select prosecdef from pg_proc where oid = 'public.guardar_equivalentes_plan(uuid, jsonb)'::regprocedure),
  false, 'guardar_equivalentes_plan: SECURITY INVOKER (prosecdef = false)');

select * from finish();
rollback;
