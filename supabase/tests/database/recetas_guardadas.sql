-- Pruebas RLS de public.recetas_guardadas (Sección 53 de
-- supabase_schema.sql). Cobertura: aislamiento multi-tenant por fila,
-- invariante receta↔paciente (INSERT y UPDATE de receta_id), y
-- protección de columnas.
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada, sin datos
-- reales de producción.

begin;
select plan(28);

-- ── Fixtures sintéticos ──────────────────────────────────────────────
select tests.create_user('70000000-0000-4000-8000-000000000003'::uuid, 'admin-a@test.local',    'admin');
select tests.create_user('70000000-0000-4000-8000-000000000004'::uuid, 'admin-b@test.local',    'admin');
select tests.create_user('70000000-0000-4000-8000-000000000005'::uuid, 'superadmin@test.local', 'superadmin');
select tests.create_user('70000000-0000-4000-8000-000000000001'::uuid, 'paciente-a@test.local', 'usuario', '70000000-0000-4000-8000-000000000003'::uuid, true, 'aprobado');
select tests.create_user('70000000-0000-4000-8000-000000000002'::uuid, 'paciente-b@test.local', 'usuario', '70000000-0000-4000-8000-000000000004'::uuid, true, 'aprobado');

-- Recetas: una de catálogo y una personalizada por cada paciente.
insert into recetas (id, nombre, user_id) values ('70000000-0000-4000-8000-0000000000e1', 'Receta catálogo', null);
insert into recetas (id, nombre, user_id) values ('70000000-0000-4000-8000-0000000000e2', 'Receta personalizada A', '70000000-0000-4000-8000-000000000001');
insert into recetas (id, nombre, user_id) values ('70000000-0000-4000-8000-0000000000e3', 'Receta personalizada B', '70000000-0000-4000-8000-000000000002');

-- recetas_guardadas preexistentes de Paciente A y Paciente B.
insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000e1');
insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-0000000000e1');

-- ══════════════════════ Paciente propio ══════════════════════

-- 1. Paciente A SELECT su propia fila = permitido
select tests.authenticate_as('70000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from recetas_guardadas where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e1')::int, 1,
  'recetas_guardadas: paciente propio SELECT = permitido');
reset role;

-- 2. Paciente A INSERT propio = bloqueado
select tests.authenticate_as('70000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000e2') $$,
  '42501', null, 'recetas_guardadas: paciente propio INSERT = bloqueado');
reset role;

-- 3. Paciente A UPDATE propio (receta_id) = bloqueado
select tests.authenticate_as('70000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update recetas_guardadas set receta_id = '70000000-0000-4000-8000-0000000000e2'
  where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e1'
  returning 1
)
select is((select count(*) from actualizado)::int, 0, 'recetas_guardadas: paciente propio UPDATE = bloqueado');
reset role;

-- 4. Paciente A DELETE propio = bloqueado
select tests.authenticate_as('70000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from recetas_guardadas
  where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e1'
  returning 1
)
select is((select count(*) from borrado)::int, 0, 'recetas_guardadas: paciente propio DELETE = bloqueado');
reset role;

-- ══════════════════════ Paciente ajeno ══════════════════════

-- 5. Paciente A SELECT fila de Paciente B = 0
select tests.authenticate_as('70000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from recetas_guardadas where user_id = '70000000-0000-4000-8000-000000000002')::int, 0,
  'recetas_guardadas: paciente ajeno SELECT = bloqueado');
reset role;

-- 6. Paciente A INSERT para Paciente B = bloqueado
select tests.authenticate_as('70000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'recetas_guardadas: paciente ajeno INSERT = bloqueado');
reset role;

-- 7. Paciente A DELETE fila de Paciente B = bloqueado
select tests.authenticate_as('70000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from recetas_guardadas
  where user_id = '70000000-0000-4000-8000-000000000002' and receta_id = '70000000-0000-4000-8000-0000000000e1'
  returning 1
)
select is((select count(*) from borrado)::int, 0, 'recetas_guardadas: paciente ajeno DELETE = bloqueado');
reset role;

-- ══════════════════════ Admin dueño ══════════════════════

-- 8. Admin A SELECT fila de su paciente = permitido
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from recetas_guardadas where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e1')::int, 1,
  'recetas_guardadas: admin dueño SELECT = permitido');
reset role;

-- 9. Admin A DELETE fila de su paciente = permitido (fixture dedicada)
insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000e3')
on conflict do nothing;
-- nota: e3 es personalizada de B, insertada aquí como rol por defecto solo
-- para tener una fila que borrar; no pasa por RLS.
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from recetas_guardadas where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e3' $$,
  'recetas_guardadas: admin dueño DELETE = permitido');
reset role;

-- ══════════════════════ Admin dueño — INSERT (invariante) ══════════════════════

-- 10. Admin A INSERT: receta global para su paciente = permitido
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000e1')
     on conflict (user_id, receta_id) do update set tiempo_comida = excluded.tiempo_comida $$,
  'recetas_guardadas: admin dueño INSERT receta global = permitido');
reset role;

-- 11. Admin A INSERT: receta personalizada de su propio paciente = permitido
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000e2') $$,
  'recetas_guardadas: admin dueño INSERT receta personalizada propia = permitido');
reset role;

-- 12. Admin A INSERT: receta personalizada de Paciente B para Paciente A = bloqueado
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000e3') $$,
  '42501', null, 'recetas_guardadas: admin dueño INSERT receta personalizada ajena = bloqueado (invariante)');
reset role;

-- ══════════════════════ Admin dueño — UPDATE (invariante) ══════════════════════

-- Limpieza: el test 11 dejó persistida (paciente_a, e2) — hay que quitarla
-- para que el test 13 pueda mover una fila hacia ese mismo destino sin
-- chocar con la PK (user_id, receta_id).
delete from recetas_guardadas where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e2';

-- 13. Admin A UPDATE: global -> personalizada de su propio paciente = permitido
delete from recetas_guardadas where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e1';
insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000e1');
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update recetas_guardadas set receta_id = '70000000-0000-4000-8000-0000000000e2'
     where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e1' $$,
  'recetas_guardadas: admin dueño UPDATE global->personalizada propia = permitido');
reset role;

-- 14. Admin A UPDATE: global -> personalizada de Paciente B = bloqueado
insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000e1')
  on conflict (user_id, receta_id) do nothing;
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update recetas_guardadas set receta_id = '70000000-0000-4000-8000-0000000000e3'
     where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e1' $$,
  '42501', null, 'recetas_guardadas: admin dueño UPDATE global->personalizada ajena = bloqueado (invariante)');
reset role;

-- ══════════════════════ Admin ajeno ══════════════════════

-- 15. Admin A SELECT fila de Paciente B = 0
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from recetas_guardadas where user_id = '70000000-0000-4000-8000-000000000002')::int, 0,
  'recetas_guardadas: admin ajeno SELECT = bloqueado');
reset role;

-- 16. Admin A INSERT para Paciente B = bloqueado
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'recetas_guardadas: admin ajeno INSERT = bloqueado');
reset role;

-- 17. Admin A UPDATE fila de Paciente B = bloqueado
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update recetas_guardadas set receta_id = '70000000-0000-4000-8000-0000000000e3'
  where user_id = '70000000-0000-4000-8000-000000000002' and receta_id = '70000000-0000-4000-8000-0000000000e1'
  returning 1
)
select is((select count(*) from actualizado)::int, 0, 'recetas_guardadas: admin ajeno UPDATE = bloqueado');
reset role;

-- 18. Admin A DELETE fila de Paciente B = bloqueado
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from recetas_guardadas
  where user_id = '70000000-0000-4000-8000-000000000002' and receta_id = '70000000-0000-4000-8000-0000000000e1'
  returning 1
)
select is((select count(*) from borrado)::int, 0, 'recetas_guardadas: admin ajeno DELETE = bloqueado');
reset role;

-- ══════════════════════ Superadmin ══════════════════════

-- 19. Superadmin SELECT fila de cualquier paciente = permitido
select tests.authenticate_as('70000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from recetas_guardadas where user_id = '70000000-0000-4000-8000-000000000002' and receta_id = '70000000-0000-4000-8000-0000000000e1')::int, 1,
  'recetas_guardadas: superadmin SELECT = permitido');
reset role;

-- 20. Superadmin DELETE fila de cualquier paciente = permitido (fixture dedicada)
insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-0000000000e3')
  on conflict (user_id, receta_id) do nothing;
select tests.authenticate_as('70000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from recetas_guardadas where user_id = '70000000-0000-4000-8000-000000000002' and receta_id = '70000000-0000-4000-8000-0000000000e3' $$,
  'recetas_guardadas: superadmin DELETE = permitido');
reset role;

-- ══════════════════════ Superadmin — INSERT (invariante) ══════════════════════

-- 21. Superadmin INSERT: receta global para Paciente A = permitido
select tests.authenticate_as('70000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-0000000000e1')
     on conflict (user_id, receta_id) do update set tiempo_comida = excluded.tiempo_comida $$,
  'recetas_guardadas: superadmin INSERT receta global = permitido');
reset role;

-- 22. Superadmin INSERT: receta personalizada A para Paciente A = permitido
select tests.authenticate_as('70000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000e2')
     on conflict (user_id, receta_id) do update set tiempo_comida = excluded.tiempo_comida $$,
  'recetas_guardadas: superadmin INSERT receta personalizada propia = permitido');
reset role;

-- 23. Superadmin INSERT: receta personalizada B para Paciente A = bloqueado
select tests.authenticate_as('70000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000e3') $$,
  '42501', null, 'recetas_guardadas: superadmin INSERT receta personalizada ajena = bloqueado (invariante)');
reset role;

-- ══════════════════════ Superadmin — UPDATE (invariante) ══════════════════════

-- 24. Superadmin UPDATE: global -> personalizada de su propio paciente = permitido
insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-0000000000e1')
  on conflict (user_id, receta_id) do nothing;
select tests.authenticate_as('70000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update recetas_guardadas set receta_id = '70000000-0000-4000-8000-0000000000e3'
     where user_id = '70000000-0000-4000-8000-000000000002' and receta_id = '70000000-0000-4000-8000-0000000000e1' $$,
  'recetas_guardadas: superadmin UPDATE global->personalizada propia = permitido');
reset role;

-- 25. Superadmin UPDATE: global -> personalizada de otro paciente = bloqueado
insert into recetas_guardadas (user_id, receta_id) values ('70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-0000000000e1')
  on conflict (user_id, receta_id) do nothing;
select tests.authenticate_as('70000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ update recetas_guardadas set receta_id = '70000000-0000-4000-8000-0000000000e2'
     where user_id = '70000000-0000-4000-8000-000000000002' and receta_id = '70000000-0000-4000-8000-0000000000e1' $$,
  '42501', null, 'recetas_guardadas: superadmin UPDATE global->personalizada de otro paciente = bloqueado (invariante)');
reset role;

-- ══════════════════════ Trigger de columnas ══════════════════════
-- Corre como Admin A (dueño de Paciente A) sobre la fila original
-- (user_id=Paciente A, receta_id=catálogo) — RLS (USING) le permite
-- acceder a esta fila sin problema, así que si el UPDATE falla, es
-- exclusivamente porque el trigger lo rechazó, no porque RLS la haya
-- vuelto invisible.

-- 26. Admin A UPDATE user_id = bloqueado por el trigger
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update recetas_guardadas set user_id = '70000000-0000-4000-8000-000000000002'
     where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e1' $$,
  'P0001', null, 'recetas_guardadas: UPDATE user_id = bloqueado por trigger (RLS sí permite acceder a la fila)');
reset role;

-- 27. Admin A UPDATE tiempo_comida = bloqueado por el trigger
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update recetas_guardadas set tiempo_comida = 'cena'
     where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e1' $$,
  'P0001', null, 'recetas_guardadas: UPDATE tiempo_comida = bloqueado por trigger (RLS sí permite acceder a la fila)');
reset role;

-- 28. Admin A UPDATE created_at = bloqueado por el trigger
select tests.authenticate_as('70000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update recetas_guardadas set created_at = now() - interval '1 year'
     where user_id = '70000000-0000-4000-8000-000000000001' and receta_id = '70000000-0000-4000-8000-0000000000e1' $$,
  'P0001', null, 'recetas_guardadas: UPDATE created_at = bloqueado por trigger (RLS sí permite acceder a la fila)');
reset role;

select * from finish();
rollback;
