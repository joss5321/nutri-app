-- Pruebas RLS de public.medidas, public.dietocalculo y public.ejercicio_logs
-- (Sección 47 de supabase_schema.sql). Cobertura completa de la matriz de
-- permisos: paciente propio/ajeno, admin dueño/ajeno, superadmin — para
-- cada comando realmente otorgado por Sección 47 (no se prueban comandos
-- que ninguna policy otorga, p.ej. UPDATE/DELETE en medidas).
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(33);

-- ── Fixtures sintéticos ──────────────────────────────────────────────
select tests.create_user('20000000-0000-4000-8000-000000000003'::uuid, 'admin-a@test.local',    'admin');
select tests.create_user('20000000-0000-4000-8000-000000000004'::uuid, 'admin-b@test.local',    'admin');
select tests.create_user('20000000-0000-4000-8000-000000000005'::uuid, 'superadmin@test.local', 'superadmin');
select tests.create_user('20000000-0000-4000-8000-000000000001'::uuid, 'paciente-a@test.local', 'usuario', '20000000-0000-4000-8000-000000000003'::uuid, true, 'aprobado');
select tests.create_user('20000000-0000-4000-8000-000000000002'::uuid, 'paciente-b@test.local', 'usuario', '20000000-0000-4000-8000-000000000004'::uuid, true, 'aprobado');

-- ejercicios no se llena desde supabase_schema.sql (se importa aparte).
insert into ejercicios (id, nombre) values ('20000000-0000-4000-8000-0000000000e1', 'Ejercicio Test');

-- Datos preexistentes de Paciente A (propios) y Paciente B (ajenos, para
-- probar aislamiento). Todo insertado como el rol por defecto (bypasea RLS).
insert into medidas (id, user_id, peso_kg)
values ('20000000-0000-4000-8000-0000000000f0', '20000000-0000-4000-8000-000000000001', 68);
insert into medidas (id, user_id, peso_kg)
values ('20000000-0000-4000-8000-0000000000f1', '20000000-0000-4000-8000-000000000002', 70);

insert into ejercicio_logs (id, user_id, ejercicio_id, peso_kg)
values ('20000000-0000-4000-8000-0000000000f9', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000e1', 20);
insert into ejercicio_logs (id, user_id, ejercicio_id, peso_kg)
values ('20000000-0000-4000-8000-0000000000f2', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-0000000000e1', 40);

insert into dietocalculo (id, user_id, formula, actividad)
values ('20000000-0000-4000-8000-0000000000f3', '20000000-0000-4000-8000-000000000002', 'harris-benedict', 'sedentario');

-- ══════════════════════════ medidas ══════════════════════════
-- Permitido: paciente propio (SELECT, INSERT), admin dueño (SELECT, INSERT),
-- superadmin (SELECT, INSERT). Nadie tiene UPDATE ni DELETE.

-- 1. Paciente A SELECT propia = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from medidas where id = '20000000-0000-4000-8000-0000000000f0')::int, 1,
  'medidas: paciente propio SELECT = permitido');
reset role;

-- 2. Paciente A INSERT propia = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into medidas (user_id, peso_kg) values ('20000000-0000-4000-8000-000000000001', 71) $$,
  'medidas: paciente propio INSERT = permitido');
reset role;

-- 3. Paciente A SELECT de Paciente B = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from medidas where id = '20000000-0000-4000-8000-0000000000f1')::int, 0,
  'medidas: paciente ajeno SELECT = bloqueado');
reset role;

-- 4. Paciente A INSERT para Paciente B = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into medidas (user_id, peso_kg) values ('20000000-0000-4000-8000-000000000002', 70) $$,
  '42501', null, 'medidas: paciente ajeno INSERT = bloqueado');
reset role;

-- 5. Admin A SELECT de su paciente = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from medidas where id = '20000000-0000-4000-8000-0000000000f0')::int, 1,
  'medidas: admin dueño SELECT = permitido');
reset role;

-- 6. Admin A INSERT para su paciente = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into medidas (user_id, peso_kg) values ('20000000-0000-4000-8000-000000000001', 72) $$,
  'medidas: admin dueño INSERT = permitido');
reset role;

-- 7. Admin A SELECT de paciente ajeno = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from medidas where id = '20000000-0000-4000-8000-0000000000f1')::int, 0,
  'medidas: admin ajeno SELECT = bloqueado');
reset role;

-- 8. Admin A INSERT para paciente ajeno = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into medidas (user_id, peso_kg) values ('20000000-0000-4000-8000-000000000002', 70) $$,
  '42501', null, 'medidas: admin ajeno INSERT = bloqueado');
reset role;

-- 9. Superadmin SELECT de cualquier paciente = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from medidas where id = '20000000-0000-4000-8000-0000000000f1')::int, 1,
  'medidas: superadmin SELECT = permitido');
reset role;

-- 10. Superadmin INSERT para cualquier paciente = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into medidas (user_id, peso_kg) values ('20000000-0000-4000-8000-000000000002', 73) $$,
  'medidas: superadmin INSERT = permitido');
reset role;

-- ══════════════════════════ ejercicio_logs ══════════════════════════
-- Permitido: paciente propio (SELECT, INSERT, DELETE), admin dueño (SELECT
-- únicamente — admin-web nunca inserta/borra), superadmin (SELECT, INSERT,
-- DELETE). Nadie tiene UPDATE.

-- 11. Paciente A SELECT propio = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from ejercicio_logs where id = '20000000-0000-4000-8000-0000000000f9')::int, 1,
  'ejercicio_logs: paciente propio SELECT = permitido');
reset role;

-- 12. Paciente A INSERT propio = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into ejercicio_logs (id, user_id, ejercicio_id, peso_kg)
     values ('20000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000e1', 12.5) $$,
  'ejercicio_logs: paciente propio INSERT = permitido');
reset role;

-- 13. Paciente A DELETE propio = permitido (borra el que acaba de crear)
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from ejercicio_logs where id = '20000000-0000-4000-8000-0000000000a2' $$,
  'ejercicio_logs: paciente propio DELETE = permitido');
reset role;

-- 14. Paciente A SELECT de Paciente B = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from ejercicio_logs where id = '20000000-0000-4000-8000-0000000000f2')::int, 0,
  'ejercicio_logs: paciente ajeno SELECT = bloqueado');
reset role;

-- 15. Paciente A INSERT para Paciente B = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into ejercicio_logs (user_id, ejercicio_id, peso_kg)
     values ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-0000000000e1', 10) $$,
  '42501', null, 'ejercicio_logs: paciente ajeno INSERT = bloqueado');
reset role;

-- 16. Paciente A DELETE de Paciente B = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from ejercicio_logs where id = '20000000-0000-4000-8000-0000000000f2' returning 1
)
select is((select count(*) from borrado)::int, 0, 'ejercicio_logs: paciente ajeno DELETE = bloqueado');
reset role;

-- 17. Admin A SELECT de su paciente = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from ejercicio_logs where id = '20000000-0000-4000-8000-0000000000f9')::int, 1,
  'ejercicio_logs: admin dueño SELECT = permitido');
reset role;

-- 18. Admin A INSERT para su paciente = bloqueado (admin-web nunca inserta)
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into ejercicio_logs (user_id, ejercicio_id, peso_kg)
     values ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000e1', 10) $$,
  '42501', null, 'ejercicio_logs: admin dueño INSERT = bloqueado');
reset role;

-- 19. Admin A SELECT de paciente ajeno = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from ejercicio_logs where id = '20000000-0000-4000-8000-0000000000f2')::int, 0,
  'ejercicio_logs: admin ajeno SELECT = bloqueado');
reset role;

-- 20. Superadmin SELECT de cualquier paciente = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from ejercicio_logs where id = '20000000-0000-4000-8000-0000000000f2')::int, 1,
  'ejercicio_logs: superadmin SELECT = permitido');
reset role;

-- 21. Superadmin INSERT para cualquier paciente = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into ejercicio_logs (id, user_id, ejercicio_id, peso_kg)
     values ('20000000-0000-4000-8000-0000000000a3', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-0000000000e1', 15) $$,
  'ejercicio_logs: superadmin INSERT = permitido');
reset role;

-- 22. Superadmin DELETE de cualquier paciente = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from ejercicio_logs where id = '20000000-0000-4000-8000-0000000000f2' $$,
  'ejercicio_logs: superadmin DELETE = permitido');
reset role;

-- ══════════════════════════ dietocalculo ══════════════════════════
-- Permitido: paciente NINGUNO (ni siquiera propio — flujo real solo pasa
-- por admin-web), admin dueño (SELECT, INSERT, UPDATE), superadmin (SELECT,
-- INSERT, UPDATE). Nadie tiene DELETE.

-- 23. Admin A INSERT dietocalculo para su paciente = permitido (crea el
--     registro que usan las siguientes pruebas)
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into dietocalculo (id, user_id, formula, actividad)
     values ('20000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001', 'harris-benedict', 'sedentario') $$,
  'dietocalculo: admin dueño INSERT = permitido');
reset role;

-- 24. Admin A SELECT ese registro = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from dietocalculo where id = '20000000-0000-4000-8000-0000000000a1')::int, 1,
  'dietocalculo: admin dueño SELECT = permitido');
reset role;

-- 25. Admin A UPDATE ese registro = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update dietocalculo set actividad = 'moderado' where id = '20000000-0000-4000-8000-0000000000a1' $$,
  'dietocalculo: admin dueño UPDATE = permitido');
reset role;

-- 26. Paciente A SELECT su propio dietocalculo (el que Admin A creó) = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from dietocalculo where id = '20000000-0000-4000-8000-0000000000a1')::int, 0,
  'dietocalculo: paciente propio SELECT = bloqueado');
reset role;

-- 27. Paciente A INSERT dietocalculo propio = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into dietocalculo (user_id, formula, actividad)
     values ('20000000-0000-4000-8000-000000000001', 'harris-benedict', 'sedentario') $$,
  '42501', null, 'dietocalculo: paciente propio INSERT = bloqueado');
reset role;

-- 28. Admin A SELECT dietocalculo de paciente ajeno = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from dietocalculo where id = '20000000-0000-4000-8000-0000000000f3')::int, 0,
  'dietocalculo: admin ajeno SELECT = bloqueado');
reset role;

-- 29. Admin A INSERT dietocalculo para paciente ajeno = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into dietocalculo (user_id, formula, actividad)
     values ('20000000-0000-4000-8000-000000000002', 'harris-benedict', 'sedentario') $$,
  '42501', null, 'dietocalculo: admin ajeno INSERT = bloqueado');
reset role;

-- 30. Admin A UPDATE dietocalculo de paciente ajeno = bloqueado
select tests.authenticate_as('20000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update dietocalculo set actividad = 'hack' where id = '20000000-0000-4000-8000-0000000000f3' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'dietocalculo: admin ajeno UPDATE = bloqueado');
reset role;

-- 31. Superadmin SELECT dietocalculo de cualquier paciente = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from dietocalculo where id = '20000000-0000-4000-8000-0000000000f3')::int, 1,
  'dietocalculo: superadmin SELECT = permitido');
reset role;

-- 32. Superadmin INSERT dietocalculo para cualquier paciente = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into dietocalculo (user_id, formula, actividad)
     values ('20000000-0000-4000-8000-000000000002', 'harris-benedict', 'sedentario') $$,
  'dietocalculo: superadmin INSERT = permitido');
reset role;

-- 33. Superadmin UPDATE dietocalculo de cualquier paciente = permitido
select tests.authenticate_as('20000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update dietocalculo set actividad = 'moderado' where id = '20000000-0000-4000-8000-0000000000f3' $$,
  'dietocalculo: superadmin UPDATE = permitido');
reset role;

select * from finish();
rollback;
