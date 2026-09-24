-- Pruebas RLS de public.nutricion_checks (Sección 69 de supabase_schema.sql,
-- MyFitTrack Radar — Blueprint v1.1, Fase A, R2). Cobertura completa de la
-- matriz de permisos: paciente propio/ajeno, admin dueño/ajeno, superadmin,
-- más la restricción temporal de UPDATE (solo el día actual) y las
-- constraints de datos (estado enum, UNIQUE user_id+fecha).
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(16);

-- ── Fixtures sintéticos ──────────────────────────────────────────────
select tests.create_user('90000000-0000-4000-8000-000000000003'::uuid, 'admin-a@test.local',    'admin');
select tests.create_user('90000000-0000-4000-8000-000000000004'::uuid, 'admin-b@test.local',    'admin');
select tests.create_user('90000000-0000-4000-8000-000000000005'::uuid, 'superadmin@test.local', 'superadmin');
select tests.create_user('90000000-0000-4000-8000-000000000001'::uuid, 'paciente-a@test.local', 'usuario', '90000000-0000-4000-8000-000000000003'::uuid, true, 'aprobado');
select tests.create_user('90000000-0000-4000-8000-000000000002'::uuid, 'paciente-b@test.local', 'usuario', '90000000-0000-4000-8000-000000000004'::uuid, true, 'aprobado');

-- Check de ayer de Paciente A, para probar la restricción temporal de UPDATE
-- (insertado directo, sin pasar por RLS — bypasea porque corre como el rol
-- por defecto antes de authenticate_as).
insert into nutricion_checks (id, user_id, fecha, estado)
values ('90000000-0000-4000-8000-0000000000f1', '90000000-0000-4000-8000-000000000001', (now() at time zone 'America/Mexico_City')::date - 1, 'no_seguido');

-- ══════════════════════ Paciente A — propio ══════════════════════

-- 1. INSERT check propio de hoy = permitido
select tests.authenticate_as('90000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into nutricion_checks (id, user_id, fecha, estado, nota)
     values ('90000000-0000-4000-8000-0000000000f2', '90000000-0000-4000-8000-000000000001', (now() at time zone 'America/Mexico_City')::date, 'parcial', 'Cena fuera') $$,
  'nutricion_checks: paciente propio INSERT (hoy) = permitido');
reset role;

-- 2. El registro persiste
select tests.authenticate_as('90000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select estado from nutricion_checks where id = '90000000-0000-4000-8000-0000000000f2'), 'parcial',
  'nutricion_checks: el registro persiste con el estado correcto');
reset role;

-- 3. Paciente A puede corregir el check de HOY (UPDATE)
select tests.authenticate_as('90000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ update nutricion_checks set estado = 'seguido' where id = '90000000-0000-4000-8000-0000000000f2' $$,
  'nutricion_checks: paciente propio UPDATE del check de HOY = permitido');
reset role;

select is((select estado from nutricion_checks where id = '90000000-0000-4000-8000-0000000000f2'), 'seguido',
  'nutricion_checks: la corrección del día actual se guardó');

-- 4. Paciente A NO puede modificar el check de AYER (fuera de ventana)
select tests.authenticate_as('90000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update nutricion_checks set estado = 'seguido' where id = '90000000-0000-4000-8000-0000000000f1' returning 1
)
select is((select count(*) from actualizado)::int, 0,
  'nutricion_checks: paciente propio UPDATE de un día pasado = bloqueado');
reset role;

-- 5. INSERT para otro usuario (suplantación) = bloqueado
select tests.authenticate_as('90000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into nutricion_checks (user_id, fecha, estado)
     values ('90000000-0000-4000-8000-000000000002', (now() at time zone 'America/Mexico_City')::date, 'seguido') $$,
  '42501', null, 'nutricion_checks: paciente INSERT para user_id ajeno = bloqueado');
reset role;

-- 6. estado fuera del enum permitido = bloqueado (CHECK constraint)
select tests.authenticate_as('90000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into nutricion_checks (user_id, fecha, estado)
     values ('90000000-0000-4000-8000-000000000001', (now() at time zone 'America/Mexico_City')::date - 2, 'si') $$,
  '23514', null, 'nutricion_checks: estado fuera de (seguido, parcial, no_seguido) = bloqueado');
reset role;

-- 7. Segundo check el mismo día (misma fecha, distinto id) = bloqueado por UNIQUE
select tests.authenticate_as('90000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into nutricion_checks (user_id, fecha, estado)
     values ('90000000-0000-4000-8000-000000000001', (now() at time zone 'America/Mexico_City')::date, 'no_seguido') $$,
  '23505', null, 'nutricion_checks: UNIQUE(user_id, fecha) impide un segundo check el mismo día');
reset role;

-- ══════════════════════ Paciente A vs Paciente B ══════════════════════

-- 8. SELECT del check de Paciente B = bloqueado (aislamiento)
insert into nutricion_checks (id, user_id, fecha, estado)
values ('90000000-0000-4000-8000-0000000000f3', '90000000-0000-4000-8000-000000000002', (now() at time zone 'America/Mexico_City')::date, 'seguido');

select tests.authenticate_as('90000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from nutricion_checks where id = '90000000-0000-4000-8000-0000000000f3')::int, 0,
  'nutricion_checks: paciente ajeno SELECT = bloqueado');
reset role;

-- ══════════════════════ Nutriólogo ══════════════════════

-- 9. Admin A (nutricionista_id real) SELECT del check de su Paciente A = permitido
select tests.authenticate_as('90000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from nutricion_checks where id = '90000000-0000-4000-8000-0000000000f2')::int, 1,
  'nutricion_checks: nutriólogo dueño SELECT = permitido');
reset role;

-- 10. Admin A SELECT del check de Paciente B (no es su paciente) = bloqueado
select tests.authenticate_as('90000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from nutricion_checks where id = '90000000-0000-4000-8000-0000000000f3')::int, 0,
  'nutricion_checks: nutriólogo ajeno SELECT = bloqueado');
reset role;

-- 11. Admin A NO puede modificar el autorreporte de su propio paciente
select tests.authenticate_as('90000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update nutricion_checks set estado = 'no_seguido' where id = '90000000-0000-4000-8000-0000000000f2' returning 1
)
select is((select count(*) from actualizado)::int, 0,
  'nutricion_checks: nutriólogo dueño UPDATE del autorreporte del paciente = bloqueado');
reset role;

-- 12. Admin A NO puede insertar un check a nombre de su paciente
select tests.authenticate_as('90000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into nutricion_checks (user_id, fecha, estado)
     values ('90000000-0000-4000-8000-000000000001', (now() at time zone 'America/Mexico_City')::date - 3, 'seguido') $$,
  '42501', null, 'nutricion_checks: nutriólogo INSERT a nombre del paciente = bloqueado');
reset role;

-- ══════════════════════ Superadmin ══════════════════════

-- 13. Superadmin SELECT de cualquier paciente = permitido
select tests.authenticate_as('90000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from nutricion_checks where id = '90000000-0000-4000-8000-0000000000f3')::int, 1,
  'nutricion_checks: superadmin SELECT = permitido');
reset role;

-- 14. Superadmin puede INSERT a nombre de cualquier paciente
select tests.authenticate_as('90000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into nutricion_checks (user_id, fecha, estado)
     values ('90000000-0000-4000-8000-000000000002', (now() at time zone 'America/Mexico_City')::date - 1, 'parcial') $$,
  'nutricion_checks: superadmin INSERT a nombre de cualquier paciente = permitido');
reset role;

-- 15. Sin DELETE para nadie — paciente propio DELETE = bloqueado
select tests.authenticate_as('90000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from nutricion_checks where id = '90000000-0000-4000-8000-0000000000f2' returning 1
)
select is((select count(*) from borrado)::int, 0, 'nutricion_checks: paciente propio DELETE = bloqueado (sin policy)');
reset role;

select * from finish();
rollback;
