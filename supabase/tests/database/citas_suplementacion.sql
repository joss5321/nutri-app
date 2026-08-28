-- Pruebas RLS de public.plan_suplementacion y public.citas
-- (Sección 51 de supabase_schema.sql). Cobertura: aislamiento multi-tenant
-- por fila, estados de negocio del paciente destino, protección de
-- columnas (BEFORE UPDATE trigger) y transiciones válidas de citas.estado.
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada, sin datos
-- reales de producción.

begin;
select plan(66);

-- ── Fixtures sintéticos ──────────────────────────────────────────────
select tests.create_user('50000000-0000-4000-8000-000000000003'::uuid, 'admin-a@test.local',    'admin');
select tests.create_user('50000000-0000-4000-8000-000000000004'::uuid, 'admin-b@test.local',    'admin');
select tests.create_user('50000000-0000-4000-8000-000000000005'::uuid, 'superadmin@test.local', 'superadmin');
select tests.create_user('50000000-0000-4000-8000-000000000001'::uuid, 'paciente-a@test.local', 'usuario', '50000000-0000-4000-8000-000000000003'::uuid, true, 'aprobado');
select tests.create_user('50000000-0000-4000-8000-000000000002'::uuid, 'paciente-b@test.local', 'usuario', '50000000-0000-4000-8000-000000000004'::uuid, true, 'aprobado');

-- Pacientes en los otros 3 estados de negocio (dueños de Admin A).
select tests.create_user('50000000-0000-4000-8000-000000000006'::uuid, 'paciente-pendiente@test.local',    'usuario', '50000000-0000-4000-8000-000000000003'::uuid, false, 'pendiente');
select tests.create_user('50000000-0000-4000-8000-000000000007'::uuid, 'paciente-rechazado@test.local',    'usuario', '50000000-0000-4000-8000-000000000003'::uuid, false, 'rechazado');
select tests.create_user('50000000-0000-4000-8000-000000000008'::uuid, 'paciente-deshabilitado@test.local', 'usuario', '50000000-0000-4000-8000-000000000003'::uuid, false, 'aprobado');

-- suplementos no se llena desde supabase_schema.sql (catálogo administrado
-- aparte) — se necesitan dos suplementos sintéticos: uno para los fixtures
-- y otro distinto para probar que el trigger bloquea un cambio REAL de
-- suplemento_id (si se usara el mismo valor que ya tiene la fila, no
-- habría cambio real y el trigger no tendría nada que bloquear).
insert into suplementos (id, nombre) values ('50000000-0000-4000-8000-0000000000e1', 'Suplemento Test');
insert into suplementos (id, nombre) values ('50000000-0000-4000-8000-0000000000e2', 'Suplemento Test 2');

-- Estructura preexistente de Paciente A (propia) y Paciente B (ajena).
insert into plan_suplementacion (id, user_id, suplemento_id, dosis)
values ('50000000-0000-4000-8000-0000000000f1', '50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-0000000000e1', '1 tableta');
insert into plan_suplementacion (id, user_id, suplemento_id, dosis)
values ('50000000-0000-4000-8000-0000000000f2', '50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-0000000000e1', '1 tableta');

insert into citas (id, user_id, fecha, hora, tipo, estado)
values ('50000000-0000-4000-8000-0000000000f3', '50000000-0000-4000-8000-000000000001', current_date + 7, '10:00', 'Nutrición', 'pendiente');
insert into citas (id, user_id, fecha, hora, tipo, estado)
values ('50000000-0000-4000-8000-0000000000f4', '50000000-0000-4000-8000-000000000002', current_date + 7, '10:00', 'Nutrición', 'pendiente');

-- ══════════════════════ plan_suplementacion — aislamiento por fila ══════════════════════

-- 1. Paciente A SELECT propio = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from plan_suplementacion where id = '50000000-0000-4000-8000-0000000000f1')::int, 1,
  'plan_suplementacion: paciente propio SELECT = permitido');
reset role;

-- 2. Paciente A INSERT propio = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_suplementacion (user_id, suplemento_id) values ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'plan_suplementacion: paciente propio INSERT = bloqueado');
reset role;

-- 3. Paciente A DELETE propio = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from plan_suplementacion where id = '50000000-0000-4000-8000-0000000000f1' returning 1
)
select is((select count(*) from borrado)::int, 0, 'plan_suplementacion: paciente propio DELETE = bloqueado');
reset role;

-- 4. Paciente A SELECT de Paciente B = 0
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from plan_suplementacion where id = '50000000-0000-4000-8000-0000000000f2')::int, 0,
  'plan_suplementacion: paciente ajeno SELECT = bloqueado');
reset role;

-- 5. Paciente A INSERT para Paciente B = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_suplementacion (user_id, suplemento_id) values ('50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'plan_suplementacion: paciente ajeno INSERT = bloqueado');
reset role;

-- 6. Paciente A DELETE de Paciente B = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from plan_suplementacion where id = '50000000-0000-4000-8000-0000000000f2' returning 1
)
select is((select count(*) from borrado)::int, 0, 'plan_suplementacion: paciente ajeno DELETE = bloqueado');
reset role;

-- 7. Admin A SELECT de su paciente = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from plan_suplementacion where id = '50000000-0000-4000-8000-0000000000f1')::int, 1,
  'plan_suplementacion: admin dueño SELECT = permitido');
reset role;

-- 8. Admin A INSERT para su paciente (activo+aprobado) = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into plan_suplementacion (id, user_id, suplemento_id)
     values ('50000000-0000-4000-8000-0000000000a1', '50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-0000000000e1') $$,
  'plan_suplementacion: admin dueño INSERT = permitido');
reset role;

-- 9. Admin A DELETE ese registro = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from plan_suplementacion where id = '50000000-0000-4000-8000-0000000000a1' $$,
  'plan_suplementacion: admin dueño DELETE = permitido');
reset role;

-- 10. Admin A UPDATE de su paciente = bloqueado (no existe policy UPDATE)
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update plan_suplementacion set dosis = 'hack' where id = '50000000-0000-4000-8000-0000000000f1' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'plan_suplementacion: admin dueño UPDATE = bloqueado');
reset role;

-- 11. Admin A SELECT de paciente ajeno = 0
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from plan_suplementacion where id = '50000000-0000-4000-8000-0000000000f2')::int, 0,
  'plan_suplementacion: admin ajeno SELECT = bloqueado');
reset role;

-- 12. Admin A INSERT para paciente ajeno = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_suplementacion (user_id, suplemento_id) values ('50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'plan_suplementacion: admin ajeno INSERT = bloqueado');
reset role;

-- 13. Admin A DELETE de paciente ajeno = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from plan_suplementacion where id = '50000000-0000-4000-8000-0000000000f2' returning 1
)
select is((select count(*) from borrado)::int, 0, 'plan_suplementacion: admin ajeno DELETE = bloqueado');
reset role;

-- 14. Superadmin SELECT de cualquier paciente = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from plan_suplementacion where id = '50000000-0000-4000-8000-0000000000f2')::int, 1,
  'plan_suplementacion: superadmin SELECT = permitido');
reset role;

-- 15. Superadmin INSERT para cualquier paciente (activo+aprobado) = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into plan_suplementacion (id, user_id, suplemento_id)
     values ('50000000-0000-4000-8000-0000000000a2', '50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-0000000000e1') $$,
  'plan_suplementacion: superadmin INSERT = permitido');
reset role;

-- 16. Superadmin DELETE ese registro = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from plan_suplementacion where id = '50000000-0000-4000-8000-0000000000a2' $$,
  'plan_suplementacion: superadmin DELETE = permitido');
reset role;

-- 17-22. Estados de negocio para INSERT (admin dueño y superadmin comparten get_perfil_activo_aprobado)
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_suplementacion (user_id, suplemento_id) values ('50000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'plan_suplementacion: admin dueño INSERT para paciente pendiente = bloqueado');
reset role;

select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_suplementacion (user_id, suplemento_id) values ('50000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'plan_suplementacion: admin dueño INSERT para paciente rechazado = bloqueado');
reset role;

select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_suplementacion (user_id, suplemento_id) values ('50000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'plan_suplementacion: admin dueño INSERT para paciente deshabilitado = bloqueado');
reset role;

select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_suplementacion (user_id, suplemento_id) values ('50000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'plan_suplementacion: superadmin INSERT para paciente pendiente = bloqueado');
reset role;

select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_suplementacion (user_id, suplemento_id) values ('50000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'plan_suplementacion: superadmin INSERT para paciente rechazado = bloqueado');
reset role;

select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into plan_suplementacion (user_id, suplemento_id) values ('50000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'plan_suplementacion: superadmin INSERT para paciente deshabilitado = bloqueado');
reset role;

-- ══════════════════════ plan_suplementacion — protección de columnas ══════════════════════

-- 23. Paciente UPDATE id propio = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update plan_suplementacion set id = '50000000-0000-4000-8000-0000000000aa' where id = '50000000-0000-4000-8000-0000000000f1' $$,
  null, null, 'plan_suplementacion: paciente UPDATE id = bloqueado');
reset role;

-- 24. Paciente UPDATE suplemento_id = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update plan_suplementacion set suplemento_id = '50000000-0000-4000-8000-0000000000e2' where id = '50000000-0000-4000-8000-0000000000f1' $$,
  null, null, 'plan_suplementacion: paciente UPDATE suplemento_id = bloqueado');
reset role;

-- 25. Paciente UPDATE dosis = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update plan_suplementacion set dosis = 'otra dosis' where id = '50000000-0000-4000-8000-0000000000f1' $$,
  null, null, 'plan_suplementacion: paciente UPDATE dosis = bloqueado');
reset role;

-- 26. Paciente UPDATE user_id = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update plan_suplementacion set user_id = '50000000-0000-4000-8000-000000000002' where id = '50000000-0000-4000-8000-0000000000f1' $$,
  null, null, 'plan_suplementacion: paciente UPDATE user_id = bloqueado');
reset role;

-- 27. Paciente UPDATE hora+momento+notas = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ update plan_suplementacion set hora = '08:00', momento = 'Ayuno', notas = 'con agua' where id = '50000000-0000-4000-8000-0000000000f1' $$,
  'plan_suplementacion: paciente UPDATE hora/momento/notas = permitido');
reset role;

-- ══════════════════════ citas — aislamiento por fila ══════════════════════

-- 28. Paciente A SELECT propia = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from citas where id = '50000000-0000-4000-8000-0000000000f3')::int, 1,
  'citas: paciente propio SELECT = permitido');
reset role;

-- 29. Paciente A INSERT propia = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into citas (user_id, fecha, hora, tipo) values ('50000000-0000-4000-8000-000000000001', current_date + 1, '09:00', 'Nutrición') $$,
  '42501', null, 'citas: paciente propio INSERT = bloqueado');
reset role;

-- 30. Paciente A DELETE propia = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from citas where id = '50000000-0000-4000-8000-0000000000f3' returning 1
)
select is((select count(*) from borrado)::int, 0, 'citas: paciente propio DELETE = bloqueado');
reset role;

-- 31. Paciente A SELECT de Paciente B = 0
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from citas where id = '50000000-0000-4000-8000-0000000000f4')::int, 0,
  'citas: paciente ajeno SELECT = bloqueado');
reset role;

-- 32. Paciente A INSERT para Paciente B = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into citas (user_id, fecha, hora, tipo) values ('50000000-0000-4000-8000-000000000002', current_date + 1, '09:00', 'Nutrición') $$,
  '42501', null, 'citas: paciente ajeno INSERT = bloqueado');
reset role;

-- 33. Paciente A DELETE de Paciente B = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from citas where id = '50000000-0000-4000-8000-0000000000f4' returning 1
)
select is((select count(*) from borrado)::int, 0, 'citas: paciente ajeno DELETE = bloqueado');
reset role;

-- 34. Admin A SELECT de su paciente = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from citas where id = '50000000-0000-4000-8000-0000000000f3')::int, 1,
  'citas: admin dueño SELECT = permitido');
reset role;

-- 35. Admin A INSERT para su paciente (activo+aprobado) = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into citas (id, user_id, fecha, hora, tipo)
     values ('50000000-0000-4000-8000-0000000000a3', '50000000-0000-4000-8000-000000000001', current_date + 2, '11:00', 'Seguimiento') $$,
  'citas: admin dueño INSERT = permitido');
reset role;

-- 36. Admin A DELETE ese registro = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from citas where id = '50000000-0000-4000-8000-0000000000a3' $$,
  'citas: admin dueño DELETE = permitido');
reset role;

-- 37. Admin A SELECT de paciente ajeno = 0
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from citas where id = '50000000-0000-4000-8000-0000000000f4')::int, 0,
  'citas: admin ajeno SELECT = bloqueado');
reset role;

-- 38. Admin A INSERT para paciente ajeno = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into citas (user_id, fecha, hora, tipo) values ('50000000-0000-4000-8000-000000000002', current_date + 1, '09:00', 'Nutrición') $$,
  '42501', null, 'citas: admin ajeno INSERT = bloqueado');
reset role;

-- 39. Admin A DELETE de paciente ajeno = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from citas where id = '50000000-0000-4000-8000-0000000000f4' returning 1
)
select is((select count(*) from borrado)::int, 0, 'citas: admin ajeno DELETE = bloqueado');
reset role;

-- 40. Superadmin SELECT de cualquier paciente = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from citas where id = '50000000-0000-4000-8000-0000000000f4')::int, 1,
  'citas: superadmin SELECT = permitido');
reset role;

-- 41. Superadmin INSERT para cualquier paciente (activo+aprobado) = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into citas (id, user_id, fecha, hora, tipo)
     values ('50000000-0000-4000-8000-0000000000a4', '50000000-0000-4000-8000-000000000002', current_date + 2, '11:00', 'Seguimiento') $$,
  'citas: superadmin INSERT = permitido');
reset role;

-- 42. Superadmin DELETE ese registro = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from citas where id = '50000000-0000-4000-8000-0000000000a4' $$,
  'citas: superadmin DELETE = permitido');
reset role;

-- 43-48. Estados de negocio para INSERT
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into citas (user_id, fecha, hora, tipo) values ('50000000-0000-4000-8000-000000000006', current_date + 1, '09:00', 'Nutrición') $$,
  '42501', null, 'citas: admin dueño INSERT para paciente pendiente = bloqueado');
reset role;

select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into citas (user_id, fecha, hora, tipo) values ('50000000-0000-4000-8000-000000000007', current_date + 1, '09:00', 'Nutrición') $$,
  '42501', null, 'citas: admin dueño INSERT para paciente rechazado = bloqueado');
reset role;

select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into citas (user_id, fecha, hora, tipo) values ('50000000-0000-4000-8000-000000000008', current_date + 1, '09:00', 'Nutrición') $$,
  '42501', null, 'citas: admin dueño INSERT para paciente deshabilitado = bloqueado');
reset role;

select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into citas (user_id, fecha, hora, tipo) values ('50000000-0000-4000-8000-000000000006', current_date + 1, '09:00', 'Nutrición') $$,
  '42501', null, 'citas: superadmin INSERT para paciente pendiente = bloqueado');
reset role;

select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into citas (user_id, fecha, hora, tipo) values ('50000000-0000-4000-8000-000000000007', current_date + 1, '09:00', 'Nutrición') $$,
  '42501', null, 'citas: superadmin INSERT para paciente rechazado = bloqueado');
reset role;

select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into citas (user_id, fecha, hora, tipo) values ('50000000-0000-4000-8000-000000000008', current_date + 1, '09:00', 'Nutrición') $$,
  '42501', null, 'citas: superadmin INSERT para paciente deshabilitado = bloqueado');
reset role;

-- ══════════════════════ citas — protección de columnas ══════════════════════

-- 49. Paciente UPDATE fecha = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set fecha = current_date + 30 where id = '50000000-0000-4000-8000-0000000000f3' $$,
  null, null, 'citas: paciente UPDATE fecha = bloqueado');
reset role;

-- 50. Paciente UPDATE hora = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set hora = '15:00' where id = '50000000-0000-4000-8000-0000000000f3' $$,
  null, null, 'citas: paciente UPDATE hora = bloqueado');
reset role;

-- 51. Paciente UPDATE tipo = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set tipo = 'Entrenamiento' where id = '50000000-0000-4000-8000-0000000000f3' $$,
  null, null, 'citas: paciente UPDATE tipo = bloqueado');
reset role;

-- 52. Paciente UPDATE profesional = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set profesional = 'Dr. Hack' where id = '50000000-0000-4000-8000-0000000000f3' $$,
  null, null, 'citas: paciente UPDATE profesional = bloqueado');
reset role;

-- 53. Paciente UPDATE modalidad = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set modalidad = 'En línea' where id = '50000000-0000-4000-8000-0000000000f3' $$,
  null, null, 'citas: paciente UPDATE modalidad = bloqueado');
reset role;

-- 54. Paciente UPDATE notas = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set notas = 'hack' where id = '50000000-0000-4000-8000-0000000000f3' $$,
  null, null, 'citas: paciente UPDATE notas = bloqueado');
reset role;

-- 55. Paciente UPDATE user_id = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set user_id = '50000000-0000-4000-8000-000000000002' where id = '50000000-0000-4000-8000-0000000000f3' $$,
  null, null, 'citas: paciente UPDATE user_id = bloqueado');
reset role;

-- 56. Paciente UPDATE created_at = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set created_at = now() - interval '1 year' where id = '50000000-0000-4000-8000-0000000000f3' $$,
  null, null, 'citas: paciente UPDATE created_at = bloqueado');
reset role;

-- ══════════════════════ citas — transiciones de estado ══════════════════════
-- Fixtures dedicados por caso: cada transición es un cambio real que
-- persiste dentro de la transacción, así que cada una necesita su propia
-- fila en el estado OLD correcto.
insert into citas (id, user_id, fecha, hora, tipo, estado) values
  ('50000000-0000-4000-8000-0000000000b1', '50000000-0000-4000-8000-000000000001', current_date + 3, '09:00', 'Nutrición', 'pendiente'),
  ('50000000-0000-4000-8000-0000000000b2', '50000000-0000-4000-8000-000000000001', current_date + 3, '09:00', 'Nutrición', 'pendiente'),
  ('50000000-0000-4000-8000-0000000000b3', '50000000-0000-4000-8000-000000000001', current_date + 3, '09:00', 'Nutrición', 'confirmada'),
  ('50000000-0000-4000-8000-0000000000b4', '50000000-0000-4000-8000-000000000001', current_date + 3, '09:00', 'Nutrición', 'cancelada'),
  ('50000000-0000-4000-8000-0000000000b5', '50000000-0000-4000-8000-000000000001', current_date + 3, '09:00', 'Nutrición', 'confirmada'),
  ('50000000-0000-4000-8000-0000000000b6', '50000000-0000-4000-8000-000000000001', current_date + 3, '09:00', 'Nutrición', 'cancelada');

-- 57. pendiente -> confirmada = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ update citas set estado = 'confirmada' where id = '50000000-0000-4000-8000-0000000000b1' $$,
  'citas: paciente pendiente -> confirmada = permitido');
reset role;

-- 58. pendiente -> cancelada = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ update citas set estado = 'cancelada' where id = '50000000-0000-4000-8000-0000000000b2' $$,
  'citas: paciente pendiente -> cancelada = permitido');
reset role;

-- 59. confirmada -> cancelada = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set estado = 'cancelada' where id = '50000000-0000-4000-8000-0000000000b3' $$,
  null, null, 'citas: paciente confirmada -> cancelada = bloqueado');
reset role;

-- 60. cancelada -> confirmada = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set estado = 'confirmada' where id = '50000000-0000-4000-8000-0000000000b4' $$,
  null, null, 'citas: paciente cancelada -> confirmada = bloqueado');
reset role;

-- 61. confirmada -> pendiente = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set estado = 'pendiente' where id = '50000000-0000-4000-8000-0000000000b5' $$,
  null, null, 'citas: paciente confirmada -> pendiente = bloqueado');
reset role;

-- 62. cancelada -> pendiente = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set estado = 'pendiente' where id = '50000000-0000-4000-8000-0000000000b6' $$,
  null, null, 'citas: paciente cancelada -> pendiente = bloqueado');
reset role;

-- ══════════════════════ citas — admin/superadmin conservan flexibilidad ══════════════════════

-- 63. Admin dueño UPDATE estado a cualquier valor (ej. pendiente) = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update citas set estado = 'pendiente' where id = '50000000-0000-4000-8000-0000000000b3' $$,
  'citas: admin dueño UPDATE estado (cualquier valor) = permitido');
reset role;

-- 64. Admin dueño UPDATE fecha = bloqueado (ni admin lo necesita)
select tests.authenticate_as('50000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set fecha = current_date + 30 where id = '50000000-0000-4000-8000-0000000000f3' $$,
  null, null, 'citas: admin dueño UPDATE fecha = bloqueado');
reset role;

-- 65. Superadmin UPDATE estado en paciente ajeno = permitido
select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update citas set estado = 'confirmada' where id = '50000000-0000-4000-8000-0000000000f4' $$,
  'citas: superadmin UPDATE estado en paciente ajeno = permitido');
reset role;

-- 66. Superadmin UPDATE fecha en paciente ajeno = bloqueado
select tests.authenticate_as('50000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ update citas set fecha = current_date + 30 where id = '50000000-0000-4000-8000-0000000000f4' $$,
  null, null, 'citas: superadmin UPDATE fecha en paciente ajeno = bloqueado');
reset role;

select * from finish();
rollback;
