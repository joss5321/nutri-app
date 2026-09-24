-- Pruebas RLS de public.recetas, public.receta_ingredientes y
-- public.receta_pasos (Sección 52 de supabase_schema.sql). Cobertura:
-- catálogo global (ownership por created_by, poblado por trigger),
-- recetas personalizadas (multi-tenant por nutricionista), y protección
-- de columnas.
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada, sin datos
-- reales de producción.

begin;
select plan(91);

-- ── Fixtures sintéticos ──────────────────────────────────────────────
select tests.create_user('60000000-0000-4000-8000-000000000003'::uuid, 'admin-a@test.local',    'admin');
select tests.create_user('60000000-0000-4000-8000-000000000004'::uuid, 'admin-b@test.local',    'admin');
select tests.create_user('60000000-0000-4000-8000-000000000005'::uuid, 'superadmin@test.local', 'superadmin');
select tests.create_user('60000000-0000-4000-8000-000000000001'::uuid, 'paciente-a@test.local', 'usuario', '60000000-0000-4000-8000-000000000003'::uuid, true, 'aprobado');
select tests.create_user('60000000-0000-4000-8000-000000000002'::uuid, 'paciente-b@test.local', 'usuario', '60000000-0000-4000-8000-000000000004'::uuid, true, 'aprobado');

-- alimentos no se llena desde supabase_schema.sql (catálogo administrado
-- aparte) — se necesita uno sintético para el FK de receta_ingredientes.
insert into alimentos (id, nombre) values ('60000000-0000-4000-8000-0000000000e1', 'Alimento Test');

-- Receta de catálogo genérica preexistente, solo para el test de lectura
-- del paciente (created_by NULL a propósito: nadie la "creó" vía la app).
insert into recetas (id, nombre, user_id, created_by)
values ('60000000-0000-4000-8000-0000000000f1', 'Receta catálogo genérica', null, null);

-- Recetas personalizadas preexistentes de Paciente A y Paciente B, con un
-- ingrediente y un paso cada una.
insert into recetas (id, nombre, user_id, created_by)
values ('60000000-0000-4000-8000-0000000000f2', 'Receta personalizada A', '60000000-0000-4000-8000-000000000001', null);
insert into receta_ingredientes (id, receta_id, orden, descripcion)
values ('60000000-0000-4000-8000-0000000000f3', '60000000-0000-4000-8000-0000000000f2', 1, 'Ingrediente A');
insert into receta_pasos (id, receta_id, numero, descripcion)
values ('60000000-0000-4000-8000-0000000000f4', '60000000-0000-4000-8000-0000000000f2', 1, 'Paso A');

insert into recetas (id, nombre, user_id, created_by)
values ('60000000-0000-4000-8000-0000000000f5', 'Receta personalizada B', '60000000-0000-4000-8000-000000000002', null);
insert into receta_ingredientes (id, receta_id, orden, descripcion)
values ('60000000-0000-4000-8000-0000000000f6', '60000000-0000-4000-8000-0000000000f5', 1, 'Ingrediente B');
insert into receta_pasos (id, receta_id, numero, descripcion)
values ('60000000-0000-4000-8000-0000000000f7', '60000000-0000-4000-8000-0000000000f5', 1, 'Paso B');

-- Receta de catálogo dedicada a las pruebas del trigger de columnas,
-- con created_by fijado explícitamente a Admin A (insertada como el rol
-- por defecto, que no dispara set_created_by_recetas).
insert into recetas (id, nombre, user_id, created_by)
values ('60000000-0000-4000-8000-0000000000f8', 'Receta trigger test', null, '60000000-0000-4000-8000-000000000003');
insert into receta_ingredientes (id, receta_id, orden, descripcion, cantidad, unidad, grupo)
values ('60000000-0000-4000-8000-0000000000f9', '60000000-0000-4000-8000-0000000000f8', 1, 'Ingrediente trigger test', 10, 'g', 'Frutas');
insert into receta_pasos (id, receta_id, numero, descripcion)
values ('60000000-0000-4000-8000-0000000000fa', '60000000-0000-4000-8000-0000000000f8', 1, 'Paso trigger test');

-- ══════════════════════ Catálogo — paciente ══════════════════════

-- 1. Paciente A SELECT catálogo = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from recetas where id = '60000000-0000-4000-8000-0000000000f1')::int, 1,
  'recetas: paciente SELECT catálogo = permitido');
reset role;

-- 2. Paciente A INSERT catálogo = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into recetas (nombre, user_id) values ('hack', null) $$,
  '42501', null, 'recetas: paciente INSERT catálogo = bloqueado');
reset role;

-- 3. Paciente A UPDATE catálogo = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update recetas set nombre = 'hack' where id = '60000000-0000-4000-8000-0000000000f1' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'recetas: paciente UPDATE catálogo = bloqueado');
reset role;

-- 4. Paciente A DELETE catálogo = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from recetas where id = '60000000-0000-4000-8000-0000000000f1' returning 1
)
select is((select count(*) from borrado)::int, 0, 'recetas: paciente DELETE catálogo = bloqueado');
reset role;

-- ══════════════════════ Ciclo real de creación — Admin A ══════════════════════

-- 5. Admin A INSERT receta global SIN enviar created_by = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into recetas (id, nombre) values ('60000000-0000-4000-8000-00000000a001', 'Receta Admin A') $$,
  'recetas: admin INSERT receta global sin created_by = permitido');
reset role;

-- 6. Confirmar que created_by quedó fijado a Admin A por el trigger
select is(
  (select created_by from recetas where id = '60000000-0000-4000-8000-00000000a001')::text,
  '60000000-0000-4000-8000-000000000003',
  'recetas: created_by se fija automáticamente al creador real');

-- 7. Admin A INSERT enviando created_by=Admin B (falsificación) -> el
--    trigger debe sobreescribirlo con el auth.uid() real (Admin A)
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into recetas (id, nombre, created_by) values ('60000000-0000-4000-8000-00000000a002', 'Receta spoof', '60000000-0000-4000-8000-000000000004') $$,
  'recetas: admin INSERT enviando created_by ajeno = permitido (el valor se sobreescribe)');
reset role;

select is(
  (select created_by from recetas where id = '60000000-0000-4000-8000-00000000a002')::text,
  '60000000-0000-4000-8000-000000000003',
  'recetas: created_by falsificado se sobreescribe con el auth.uid() real, no con el valor enviado');

-- ══════════════════════ Admin A (creador): UPDATE/DELETE receta propia ══════════════════════

-- 8. Admin A UPDATE su propia receta = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update recetas set nombre = 'Receta Admin A (editada)' where id = '60000000-0000-4000-8000-00000000a001' $$,
  'recetas: admin creador UPDATE receta propia = permitido');
reset role;

-- 9. Admin A DELETE la receta "spoof" (no se necesita después) = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from recetas where id = '60000000-0000-4000-8000-00000000a002' $$,
  'recetas: admin creador DELETE receta propia = permitido');
reset role;

-- ══════════════════════ Admin B sobre receta global de Admin A ══════════════════════

-- 10. Admin B SELECT receta de Admin A = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select is((select count(*) from recetas where id = '60000000-0000-4000-8000-00000000a001')::int, 1,
  'recetas: admin no-creador SELECT catálogo ajeno = permitido');
reset role;

-- 11. Admin B UPDATE receta de Admin A = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
with actualizado as (
  update recetas set nombre = 'hack' where id = '60000000-0000-4000-8000-00000000a001' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'recetas: admin no-creador UPDATE receta ajena = bloqueado');
reset role;

-- 12. Admin B DELETE receta de Admin A = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
with borrado as (
  delete from recetas where id = '60000000-0000-4000-8000-00000000a001' returning 1
)
select is((select count(*) from borrado)::int, 0, 'recetas: admin no-creador DELETE receta ajena = bloqueado');
reset role;

-- 13. Admin B INSERT ingrediente en receta de Admin A = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into receta_ingredientes (receta_id, orden, descripcion) values ('60000000-0000-4000-8000-00000000a001', 2, 'hack') $$,
  '42501', null, 'receta_ingredientes: admin no-creador INSERT en receta ajena = bloqueado');
reset role;

-- 14. Admin B INSERT paso en receta de Admin A = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into receta_pasos (receta_id, numero, descripcion) values ('60000000-0000-4000-8000-00000000a001', 2, 'hack') $$,
  '42501', null, 'receta_pasos: admin no-creador INSERT en receta ajena = bloqueado');
reset role;

-- ══════════════════════ Admin A (creador): gestiona sus propios hijos ══════════════════════

-- 15. Admin A INSERT ingrediente en su propia receta = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into receta_ingredientes (id, receta_id, orden, descripcion)
     values ('60000000-0000-4000-8000-00000000a003', '60000000-0000-4000-8000-00000000a001', 1, 'Ingrediente Admin A') $$,
  'receta_ingredientes: admin creador INSERT en receta propia = permitido');
reset role;

-- 16. Admin A INSERT paso en su propia receta = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into receta_pasos (id, receta_id, numero, descripcion)
     values ('60000000-0000-4000-8000-00000000a004', '60000000-0000-4000-8000-00000000a001', 1, 'Paso Admin A') $$,
  'receta_pasos: admin creador INSERT en receta propia = permitido');
reset role;

-- 17. Admin B UPDATE ese ingrediente = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
with actualizado as (
  update receta_ingredientes set alimento_id = '60000000-0000-4000-8000-0000000000e1' where id = '60000000-0000-4000-8000-00000000a003' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'receta_ingredientes: admin no-creador UPDATE = bloqueado');
reset role;

-- 18. Admin B DELETE ese ingrediente = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
with borrado as (
  delete from receta_ingredientes where id = '60000000-0000-4000-8000-00000000a003' returning 1
)
select is((select count(*) from borrado)::int, 0, 'receta_ingredientes: admin no-creador DELETE = bloqueado');
reset role;

-- 19. Admin B DELETE ese paso = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
with borrado as (
  delete from receta_pasos where id = '60000000-0000-4000-8000-00000000a004' returning 1
)
select is((select count(*) from borrado)::int, 0, 'receta_pasos: admin no-creador DELETE = bloqueado');
reset role;

-- 20. Admin A UPDATE (alimento_id) su propio ingrediente = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update receta_ingredientes set alimento_id = '60000000-0000-4000-8000-0000000000e1' where id = '60000000-0000-4000-8000-00000000a003' $$,
  'receta_ingredientes: admin creador UPDATE alimento_id = permitido');
reset role;

-- 21. Admin A DELETE su propio ingrediente = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from receta_ingredientes where id = '60000000-0000-4000-8000-00000000a003' $$,
  'receta_ingredientes: admin creador DELETE = permitido');
reset role;

-- 22. Admin A DELETE su propio paso = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from receta_pasos where id = '60000000-0000-4000-8000-00000000a004' $$,
  'receta_pasos: admin creador DELETE = permitido');
reset role;

-- ══════════════════════ Superadmin — catálogo global ══════════════════════

-- 23. Superadmin SELECT receta de Admin A = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from recetas where id = '60000000-0000-4000-8000-00000000a001')::int, 1,
  'recetas: superadmin SELECT = permitido');
reset role;

-- 24. Superadmin UPDATE receta de Admin A = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update recetas set nombre = 'Receta Admin A (superadmin)' where id = '60000000-0000-4000-8000-00000000a001' $$,
  'recetas: superadmin UPDATE = permitido');
reset role;

-- 25. Superadmin INSERT ingrediente en receta de Admin A = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into receta_ingredientes (id, receta_id, orden, descripcion)
     values ('60000000-0000-4000-8000-00000000a005', '60000000-0000-4000-8000-00000000a001', 1, 'Ingrediente superadmin') $$,
  'receta_ingredientes: superadmin INSERT = permitido');
reset role;

-- 26. Superadmin UPDATE ese ingrediente = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update receta_ingredientes set alimento_id = '60000000-0000-4000-8000-0000000000e1' where id = '60000000-0000-4000-8000-00000000a005' $$,
  'receta_ingredientes: superadmin UPDATE = permitido');
reset role;

-- 27. Superadmin DELETE ese ingrediente = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from receta_ingredientes where id = '60000000-0000-4000-8000-00000000a005' $$,
  'receta_ingredientes: superadmin DELETE = permitido');
reset role;

-- 28. Superadmin INSERT paso en receta de Admin A = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into receta_pasos (id, receta_id, numero, descripcion)
     values ('60000000-0000-4000-8000-00000000a006', '60000000-0000-4000-8000-00000000a001', 1, 'Paso superadmin') $$,
  'receta_pasos: superadmin INSERT = permitido');
reset role;

-- 29. Superadmin DELETE ese paso = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from receta_pasos where id = '60000000-0000-4000-8000-00000000a006' $$,
  'receta_pasos: superadmin DELETE = permitido');
reset role;

-- 30. Superadmin DELETE la receta de Admin A = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from recetas where id = '60000000-0000-4000-8000-00000000a001' $$,
  'recetas: superadmin DELETE = permitido');
reset role;

-- ══════════════════════ Personalizada — recetas ══════════════════════

-- 31. Paciente A SELECT su receta personalizada = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from recetas where id = '60000000-0000-4000-8000-0000000000f2')::int, 1,
  'recetas: paciente propio SELECT personalizada = permitido');
reset role;

-- 32. Paciente A UPDATE su receta personalizada = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update recetas set nombre = 'hack' where id = '60000000-0000-4000-8000-0000000000f2' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'recetas: paciente propio UPDATE personalizada = bloqueado');
reset role;

-- 33. Paciente A SELECT receta personalizada de Paciente B = 0
select tests.authenticate_as('60000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from recetas where id = '60000000-0000-4000-8000-0000000000f5')::int, 0,
  'recetas: paciente ajeno SELECT personalizada = bloqueado');
reset role;

-- 34. Admin A (dueño de Paciente A) SELECT receta personalizada de A = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from recetas where id = '60000000-0000-4000-8000-0000000000f2')::int, 1,
  'recetas: admin dueño SELECT personalizada = permitido');
reset role;

-- 35. Admin A INSERT nueva receta personalizada para Paciente A = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into recetas (id, nombre, user_id) values ('60000000-0000-4000-8000-00000000a007', 'Receta personalizada nueva A', '60000000-0000-4000-8000-000000000001') $$,
  'recetas: admin dueño INSERT personalizada = permitido');
reset role;

-- 36. Admin A UPDATE esa receta = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update recetas set nombre = 'Receta personalizada nueva A (editada)' where id = '60000000-0000-4000-8000-00000000a007' $$,
  'recetas: admin dueño UPDATE personalizada = permitido');
reset role;

-- 37. Admin A DELETE esa receta = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from recetas where id = '60000000-0000-4000-8000-00000000a007' $$,
  'recetas: admin dueño DELETE personalizada = permitido');
reset role;

-- 38. Admin A SELECT receta personalizada de Paciente B (ajeno) = 0
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from recetas where id = '60000000-0000-4000-8000-0000000000f5')::int, 0,
  'recetas: admin ajeno SELECT personalizada = bloqueado');
reset role;

-- 39. Admin A INSERT receta personalizada para Paciente B (ajeno) = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into recetas (nombre, user_id) values ('hack', '60000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'recetas: admin ajeno INSERT personalizada = bloqueado');
reset role;

-- 40. Admin A UPDATE receta personalizada de Paciente B (ajeno) = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update recetas set nombre = 'hack' where id = '60000000-0000-4000-8000-0000000000f5' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'recetas: admin ajeno UPDATE personalizada = bloqueado');
reset role;

-- ══════════════════════ Personalizada — hijas ══════════════════════

-- 41. Paciente A SELECT su propio ingrediente = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from receta_ingredientes where id = '60000000-0000-4000-8000-0000000000f3')::int, 1,
  'receta_ingredientes: paciente propio SELECT = permitido');
reset role;

-- 42. Paciente A SELECT su propio paso = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from receta_pasos where id = '60000000-0000-4000-8000-0000000000f4')::int, 1,
  'receta_pasos: paciente propio SELECT = permitido');
reset role;

-- 43. Paciente A SELECT ingrediente de Paciente B (ajeno) = 0
select tests.authenticate_as('60000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from receta_ingredientes where id = '60000000-0000-4000-8000-0000000000f6')::int, 0,
  'receta_ingredientes: paciente ajeno SELECT = bloqueado');
reset role;

-- 44. Admin A INSERT ingrediente en receta personalizada de su paciente = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into receta_ingredientes (id, receta_id, orden, descripcion)
     values ('60000000-0000-4000-8000-00000000a008', '60000000-0000-4000-8000-0000000000f2', 2, 'Ingrediente A nuevo') $$,
  'receta_ingredientes: admin dueño INSERT en personalizada = permitido');
reset role;

-- 45. Admin A UPDATE ese ingrediente = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update receta_ingredientes set alimento_id = '60000000-0000-4000-8000-0000000000e1' where id = '60000000-0000-4000-8000-00000000a008' $$,
  'receta_ingredientes: admin dueño UPDATE en personalizada = permitido');
reset role;

-- 46. Admin A DELETE ese ingrediente = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from receta_ingredientes where id = '60000000-0000-4000-8000-00000000a008' $$,
  'receta_ingredientes: admin dueño DELETE en personalizada = permitido');
reset role;

-- 47. Admin A INSERT paso en receta personalizada de su paciente = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into receta_pasos (id, receta_id, numero, descripcion)
     values ('60000000-0000-4000-8000-00000000a009', '60000000-0000-4000-8000-0000000000f2', 2, 'Paso A nuevo') $$,
  'receta_pasos: admin dueño INSERT en personalizada = permitido');
reset role;

-- 48. Admin A DELETE ese paso = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from receta_pasos where id = '60000000-0000-4000-8000-00000000a009' $$,
  'receta_pasos: admin dueño DELETE en personalizada = permitido');
reset role;

-- 49. Admin A INSERT ingrediente en receta personalizada de Paciente B (ajeno) = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into receta_ingredientes (receta_id, orden, descripcion) values ('60000000-0000-4000-8000-0000000000f5', 2, 'hack') $$,
  '42501', null, 'receta_ingredientes: admin ajeno INSERT en personalizada = bloqueado');
reset role;

-- 50. Admin A DELETE ingrediente de Paciente B (ajeno) = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from receta_ingredientes where id = '60000000-0000-4000-8000-0000000000f6' returning 1
)
select is((select count(*) from borrado)::int, 0, 'receta_ingredientes: admin ajeno DELETE en personalizada = bloqueado');
reset role;

-- ══════════════════════ Personalizada — superadmin ══════════════════════

-- 51. Superadmin UPDATE receta personalizada de Paciente B = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update recetas set nombre = 'Receta personalizada B (superadmin)' where id = '60000000-0000-4000-8000-0000000000f5' $$,
  'recetas: superadmin UPDATE personalizada ajena = permitido');
reset role;

-- 52. Superadmin INSERT ingrediente en receta personalizada de Paciente B = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into receta_ingredientes (id, receta_id, orden, descripcion)
     values ('60000000-0000-4000-8000-00000000a00a', '60000000-0000-4000-8000-0000000000f5', 2, 'Ingrediente superadmin B') $$,
  'receta_ingredientes: superadmin INSERT en personalizada ajena = permitido');
reset role;

-- ══════════════════════ Trigger recetas — protección de columnas ══════════════════════

-- 53. Admin A (creador) UPDATE id = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update recetas set id = '60000000-0000-4000-8000-0000000000aa' where id = '60000000-0000-4000-8000-0000000000f8' $$,
  null, null, 'recetas: UPDATE id = bloqueado');
reset role;

-- 54. Admin A UPDATE user_id = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update recetas set user_id = '60000000-0000-4000-8000-000000000001' where id = '60000000-0000-4000-8000-0000000000f8' $$,
  null, null, 'recetas: UPDATE user_id = bloqueado');
reset role;

-- 55. Admin A UPDATE receta_base_id = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update recetas set receta_base_id = '60000000-0000-4000-8000-0000000000f1' where id = '60000000-0000-4000-8000-0000000000f8' $$,
  null, null, 'recetas: UPDATE receta_base_id = bloqueado');
reset role;

-- 56. Admin A UPDATE created_by = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update recetas set created_by = '60000000-0000-4000-8000-000000000004' where id = '60000000-0000-4000-8000-0000000000f8' $$,
  null, null, 'recetas: UPDATE created_by = bloqueado');
reset role;

-- 57. Admin A UPDATE created_at = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update recetas set created_at = now() - interval '1 year' where id = '60000000-0000-4000-8000-0000000000f8' $$,
  null, null, 'recetas: UPDATE created_at = bloqueado');
reset role;

-- 58. Admin A UPDATE nombre/calorias = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update recetas set nombre = 'Receta trigger test (editada)', calorias = 250 where id = '60000000-0000-4000-8000-0000000000f8' $$,
  'recetas: UPDATE nombre/calorias = permitido');
reset role;

-- ══════════════════════ Trigger receta_ingredientes — protección de columnas ══════════════════════

-- 59. Admin A UPDATE alimento_id = permitido
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update receta_ingredientes set alimento_id = '60000000-0000-4000-8000-0000000000e1' where id = '60000000-0000-4000-8000-0000000000f9' $$,
  'receta_ingredientes: UPDATE alimento_id = permitido');
reset role;

-- 60. Admin A UPDATE receta_id = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update receta_ingredientes set receta_id = '60000000-0000-4000-8000-0000000000f1' where id = '60000000-0000-4000-8000-0000000000f9' $$,
  null, null, 'receta_ingredientes: UPDATE receta_id = bloqueado');
reset role;

-- 61. Admin A UPDATE descripcion = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update receta_ingredientes set descripcion = 'hack' where id = '60000000-0000-4000-8000-0000000000f9' $$,
  null, null, 'receta_ingredientes: UPDATE descripcion = bloqueado');
reset role;

-- 62. Admin A UPDATE cantidad = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update receta_ingredientes set cantidad = 999 where id = '60000000-0000-4000-8000-0000000000f9' $$,
  null, null, 'receta_ingredientes: UPDATE cantidad = bloqueado');
reset role;

-- 63. Admin A UPDATE unidad = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update receta_ingredientes set unidad = 'kg' where id = '60000000-0000-4000-8000-0000000000f9' $$,
  null, null, 'receta_ingredientes: UPDATE unidad = bloqueado');
reset role;

-- 64. Admin A UPDATE orden = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update receta_ingredientes set orden = 99 where id = '60000000-0000-4000-8000-0000000000f9' $$,
  null, null, 'receta_ingredientes: UPDATE orden = bloqueado');
reset role;

-- 65. Admin A UPDATE grupo = bloqueado
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update receta_ingredientes set grupo = 'Otro grupo' where id = '60000000-0000-4000-8000-0000000000f9' $$,
  null, null, 'receta_ingredientes: UPDATE grupo = bloqueado');
reset role;

-- ══════════════════════ receta_pasos — sin policy UPDATE ══════════════════════

-- 66. UPDATE bloqueado para cualquier rol (no existe policy UPDATE en absoluto)
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update receta_pasos set descripcion = 'hack' where id = '60000000-0000-4000-8000-0000000000fa' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'receta_pasos: UPDATE bloqueado para cualquier rol (sin policy)');
reset role;

-- ══════════════════ RPC actualizar_receta_completa (Sección 59) ══════════════════
-- Cobertura de atomicidad: caso exitoso, error a mitad de camino
-- (ingrediente con alimento_id inexistente), rollback total sin estado
-- parcial, caller no autorizado bloqueado, caller autorizado permitido
-- (catálogo y personalizada).

-- Fixture dedicada: receta de catálogo creada por Admin A, con un
-- ingrediente y un paso "viejos" que la RPC debe reemplazar por completo.
insert into recetas (id, nombre, user_id, created_by)
values ('60000000-0000-4000-8000-0000000000b1', 'Receta RPC catálogo', null, '60000000-0000-4000-8000-000000000003');
insert into receta_ingredientes (id, receta_id, orden, descripcion)
values ('60000000-0000-4000-8000-0000000000b2', '60000000-0000-4000-8000-0000000000b1', 1, 'Ingrediente viejo');
insert into receta_pasos (id, receta_id, numero, descripcion)
values ('60000000-0000-4000-8000-0000000000b3', '60000000-0000-4000-8000-0000000000b1', 1, 'Paso viejo');

-- 68. Caso exitoso: Admin A (creador) actualiza nombre + reemplaza
--     ingredientes y pasos en una sola llamada.
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ select public.actualizar_receta_completa(
       '60000000-0000-4000-8000-0000000000b1'::uuid,
       'Receta RPC catálogo (editada)', null, 'Desayuno', null, null, null, null, null, null, null, null, null, null, null,
       '[{"descripcion":"Ingrediente nuevo 1"},{"descripcion":"Ingrediente nuevo 2"}]'::jsonb,
       '["Paso nuevo 1", "Paso nuevo 2"]'::jsonb,
       null, null
     ) $$,
  'actualizar_receta_completa: admin creador actualiza catálogo completo = permitido');
reset role;

-- 69-71. El padre y los hijos quedaron reemplazados por completo.
select is((select nombre from recetas where id = '60000000-0000-4000-8000-0000000000b1'),
  'Receta RPC catálogo (editada)', 'actualizar_receta_completa: nombre del padre actualizado');
select is((select count(*)::int from receta_ingredientes where receta_id = '60000000-0000-4000-8000-0000000000b1'), 2,
  'actualizar_receta_completa: ingredientes viejos reemplazados por los 2 nuevos');
select is((select count(*)::int from receta_pasos where receta_id = '60000000-0000-4000-8000-0000000000b1'), 2,
  'actualizar_receta_completa: pasos viejos reemplazados por los 2 nuevos');

-- 72. Error a mitad de camino: el segundo ingrediente referencia un
--     alimento_id inexistente (viola el FK) — la llamada entera debe
--     fallar, incluyendo el UPDATE del padre ya intentado.
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ select public.actualizar_receta_completa(
       '60000000-0000-4000-8000-0000000000b1'::uuid,
       'Nombre que no debería aplicarse', null, 'Desayuno', null, null, null, null, null, null, null, null, null, null, null,
       '[{"descripcion":"ok"},{"descripcion":"bad","alimento_id":"60000000-0000-4000-8000-ffffffffffff"}]'::jsonb,
       '["Paso ok"]'::jsonb,
       null, null
     ) $$,
  '23503', null, 'actualizar_receta_completa: alimento_id inexistente en ingrediente 2 = bloqueado (FK)');
reset role;

-- 73-75. Rollback total: nombre e hijos siguen siendo exactamente los del
-- test 68 — ni el UPDATE del padre ni el DELETE+INSERT parcial de
-- ingredientes/pasos quedaron aplicados.
select is((select nombre from recetas where id = '60000000-0000-4000-8000-0000000000b1'),
  'Receta RPC catálogo (editada)', 'actualizar_receta_completa: tras el error, el nombre del padre NO cambió (rollback total)');
select is((select count(*)::int from receta_ingredientes where receta_id = '60000000-0000-4000-8000-0000000000b1'), 2,
  'actualizar_receta_completa: tras el error, los ingredientes NO cambiaron (rollback total)');
select is((select count(*)::int from receta_pasos where receta_id = '60000000-0000-4000-8000-0000000000b1'), 2,
  'actualizar_receta_completa: tras el error, los pasos NO cambiaron (rollback total)');

-- 76. Caller no autorizado: Admin B (no creador) intenta actualizar la
--     receta de catálogo de Admin A = bloqueado.
select tests.authenticate_as('60000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select throws_ok(
  $$ select public.actualizar_receta_completa(
       '60000000-0000-4000-8000-0000000000b1'::uuid,
       'hack', null, null, null, null, null, null, null, null, null, null, null, null, null,
       '[]'::jsonb, '[]'::jsonb,
       null, null
     ) $$,
  null, null, 'actualizar_receta_completa: admin no-creador UPDATE catálogo ajeno = bloqueado');
reset role;

-- 77-78. Caller autorizado permitido, sobre una receta personalizada:
--     Admin A (dueño de Paciente A) actualiza la receta personalizada f2.
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ select public.actualizar_receta_completa(
       '60000000-0000-4000-8000-0000000000f2'::uuid,
       'Receta personalizada A (RPC)', null, null, null, null, null, null, null, null, null, null, null, null, null,
       '[{"descripcion":"Ingrediente A vía RPC"}]'::jsonb,
       '["Paso A vía RPC"]'::jsonb,
       null, null
     ) $$,
  'actualizar_receta_completa: admin dueño actualiza personalizada de su paciente = permitido');
reset role;

select is((select nombre from recetas where id = '60000000-0000-4000-8000-0000000000f2'),
  'Receta personalizada A (RPC)', 'actualizar_receta_completa: nombre de la personalizada actualizado');

-- ══════════════════ actualizar_receta_completa — grants y SECURITY INVOKER ══════════════════
-- Corrección post-deploy: "revoke all ... from public" no bastó en
-- producción (anon tenía EXECUTE explícito).

-- 79. authenticated SÍ tiene EXECUTE.
select ok(
  has_function_privilege('authenticated',
    'public.actualizar_receta_completa(uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb, text, text)',
    'EXECUTE'),
  'actualizar_receta_completa: authenticated tiene EXECUTE');

-- 80. anon NO tiene EXECUTE.
select ok(
  not has_function_privilege('anon',
    'public.actualizar_receta_completa(uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb, text, text)',
    'EXECUTE'),
  'actualizar_receta_completa: anon NO tiene EXECUTE');

-- 81. PUBLIC NO tiene EXECUTE.
select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join lateral aclexplode(p.proacl) a on true
    where n.nspname = 'public' and p.proname = 'actualizar_receta_completa'
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'actualizar_receta_completa: PUBLIC NO tiene EXECUTE');

-- 82. Sigue siendo SECURITY INVOKER (prosecdef = false).
select is(
  (select prosecdef from pg_proc where oid =
    'public.actualizar_receta_completa(uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb, text, text)'::regprocedure),
  false, 'actualizar_receta_completa: SECURITY INVOKER (prosecdef = false)');

-- ══════════════════ crear_receta_completa (Sección 63, H1) ══════════════════
-- Único consumidor real: scripts/seed-recetas.mjs vía service_role — cero
-- clientes autenticados la necesitan hoy, así que el grant es más estricto
-- que actualizar_receta_completa (revocado también de authenticated, no
-- solo de public/anon).

-- 83. Caso exitoso: service_role crea una receta de catálogo completa
-- (padre + ingredientes + pasos) en una sola llamada.
set local role service_role;
select lives_ok(
  $$ select public.crear_receta_completa(
       null,
       'Receta RPC catálogo nueva', '🍽️', 'Comida', null, null, null, null, null, 'Fácil', null, '1', null, null, null,
       '[{"descripcion":"Ingrediente nuevo 1"},{"descripcion":"Ingrediente nuevo 2"}]'::jsonb,
       '["Paso nuevo 1"]'::jsonb
     ) $$,
  'crear_receta_completa: service_role crea receta de catálogo completa = permitido');
reset role;

-- 84-85. Ingredientes y pasos quedaron insertados.
select is((select count(*)::int from receta_ingredientes ri join recetas r on r.id = ri.receta_id where r.nombre = 'Receta RPC catálogo nueva'), 2,
  'crear_receta_completa: se insertaron los 2 ingredientes');
select is((select count(*)::int from receta_pasos rp join recetas r on r.id = rp.receta_id where r.nombre = 'Receta RPC catálogo nueva'), 1,
  'crear_receta_completa: se insertó el paso');

-- 86. Error a mitad de camino: el segundo ingrediente referencia un
-- alimento_id inexistente (FK) — la llamada entera debe fallar, incluida
-- la receta padre ya insertada.
set local role service_role;
select throws_ok(
  $$ select public.crear_receta_completa(
       null,
       'Receta RPC con error', null, 'Comida', null, null, null, null, null, 'Fácil', null, '1', null, null, null,
       '[{"descripcion":"ok"},{"descripcion":"bad","alimento_id":"60000000-0000-4000-8000-ffffffffffff"}]'::jsonb,
       '[]'::jsonb
     ) $$,
  '23503', null, 'crear_receta_completa: alimento_id inexistente en ingrediente 2 = bloqueado (FK)');
reset role;

-- 87. Rollback total: la receta padre del intento fallido NO quedó
-- huérfana en el catálogo.
select is((select count(*)::int from recetas where nombre = 'Receta RPC con error'), 0,
  'crear_receta_completa: tras el error, la receta padre NO quedó huérfana (rollback total)');

-- 88. authenticated (incluso admin) SIN EXECUTE en absoluto — bloqueado
-- antes de siquiera evaluar RLS.
select tests.authenticate_as('60000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ select public.crear_receta_completa(
       null, 'hack', null, 'Comida', null, null, null, null, null, null, null, '1', null, null, null, '[]'::jsonb, '[]'::jsonb
     ) $$,
  '42501', null, 'crear_receta_completa: authenticated (incluso admin) sin EXECUTE = bloqueado');
reset role;

-- 89. anon sin EXECUTE.
select ok(
  not has_function_privilege('anon',
    'public.crear_receta_completa(uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb)',
    'EXECUTE'),
  'crear_receta_completa: anon NO tiene EXECUTE');

-- 90. PUBLIC sin EXECUTE.
select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join lateral aclexplode(p.proacl) a on true
    where n.nspname = 'public' and p.proname = 'crear_receta_completa'
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'crear_receta_completa: PUBLIC NO tiene EXECUTE');

-- 91. Sigue siendo SECURITY INVOKER (prosecdef = false).
select is(
  (select prosecdef from pg_proc where oid =
    'public.crear_receta_completa(uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb)'::regprocedure),
  false, 'crear_receta_completa: SECURITY INVOKER (prosecdef = false)');

select * from finish();
rollback;
