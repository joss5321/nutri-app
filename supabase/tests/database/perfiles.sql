-- Pruebas RLS de public.perfiles (Secciones 45, 46 y 56 de
-- supabase_schema.sql).
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(25);

-- ── Fixtures sintéticos ──────────────────────────────────────────────
-- Ninguno de estos UUIDs/emails corresponde a datos reales.
select tests.create_user('10000000-0000-4000-8000-000000000003'::uuid, 'admin-a@test.local',      'admin');
select tests.create_user('10000000-0000-4000-8000-000000000004'::uuid, 'admin-b@test.local',      'admin');
select tests.create_user('10000000-0000-4000-8000-000000000005'::uuid, 'superadmin@test.local',   'superadmin');
select tests.create_user('10000000-0000-4000-8000-000000000006'::uuid, 'superadmin-b@test.local', 'superadmin');
select tests.create_user('10000000-0000-4000-8000-000000000001'::uuid, 'paciente-a@test.local',   'usuario', '10000000-0000-4000-8000-000000000003'::uuid, true, 'aprobado');
select tests.create_user('10000000-0000-4000-8000-000000000002'::uuid, 'paciente-b@test.local',   'usuario', '10000000-0000-4000-8000-000000000004'::uuid, true, 'aprobado');

-- 1. Paciente SELECT propio = permitido
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000001')::int,
  1,
  'Paciente A puede leer su propio perfil'
);
reset role;

-- 2. Paciente UPDATE nombre propio = permitido
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ update perfiles set nombre_completo = 'Nuevo Nombre' where id = '10000000-0000-4000-8000-000000000001' $$,
  'Paciente A puede actualizar su propio nombre_completo'
);
reset role;

-- 3. Paciente cambia su propio rol a superadmin = bloqueado
--    (trigger Sección 45: proteger_columnas_sensibles_perfiles, RAISE EXCEPTION -> SQLSTATE P0001)
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update perfiles set rol = 'superadmin' where id = '10000000-0000-4000-8000-000000000001' $$,
  'P0001',
  null,
  'Paciente A no puede cambiar su propio rol a superadmin'
);
reset role;

-- 4. Paciente INSERT directo a perfiles = bloqueado
--    (Sección 46: sin policy INSERT para authenticated -> RLS violation, SQLSTATE 42501)
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into perfiles (id, nombre_completo) values ('10000000-0000-4000-8000-000000000099', 'Intruso') $$,
  '42501',
  null,
  'Paciente A no puede insertar una fila directa en perfiles'
);
reset role;

-- 5. Paciente DELETE propio = bloqueado
--    (Sección 46: sin policy DELETE -> 0 filas afectadas, sin excepción)
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from perfiles where id = '10000000-0000-4000-8000-000000000001' returning 1
)
select is(
  (select count(*) from borrado)::int,
  0,
  'Paciente A no puede borrar su propio perfil'
);
reset role;

-- 6. Admin cambia estatus/is_active de su propio paciente = permitido
select tests.authenticate_as('10000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update perfiles set estatus = 'rechazado', is_active = false where id = '10000000-0000-4000-8000-000000000001' $$,
  'Admin A puede cambiar estatus/is_active de su propio paciente'
);
reset role;

-- 7. Admin NO modifica paciente de otro admin
select tests.authenticate_as('10000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update perfiles set estatus = 'rechazado' where id = '10000000-0000-4000-8000-000000000002' returning 1
)
select is(
  (select count(*) from actualizado)::int,
  0,
  'Admin A no puede modificar al paciente de Admin B'
);
reset role;

-- 8. Superadmin conserva los cambios permitidos
select tests.authenticate_as('10000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update perfiles set estatus = 'aprobado', is_active = true where id = '10000000-0000-4000-8000-000000000002' $$,
  'Superadmin puede modificar el perfil de cualquier paciente'
);
reset role;

-- ══════════════════════════════════════════════════════════════════
-- SECCIÓN 56 — lectura multi-tenant con superadmin global +
-- nutricionistas_publicos (directorio anon/authenticated sin exponer
-- perfiles completa)
-- ══════════════════════════════════════════════════════════════════

-- ── ANON ──────────────────────────────────────────────────────────
-- Limpiamos cualquier JWT residual de un test anterior antes de probar
-- como anon — auth.uid()/auth.role() leen request.jwt.claims, que NO se
-- limpia con "reset role" (es set_config con is_local=true, dura toda la
-- transacción salvo que se sobreescriba explícitamente).
select set_config('request.jwt.claims', '', true);
set local role anon;

-- 9. ANON SELECT perfiles filas rol='admin' directo = bloqueado
select is(
  (select count(*) from perfiles where rol = 'admin')::int,
  0,
  'ANON: SELECT directo de perfiles rol=admin = bloqueado'
);

-- 10. ANON SELECT perfiles de un paciente directo = bloqueado
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000001')::int,
  0,
  'ANON: SELECT directo de perfiles de un paciente = bloqueado'
);

-- 11. ANON SELECT nutricionistas_publicos = permitido
select is(
  (select count(*) from nutricionistas_publicos where id = '10000000-0000-4000-8000-000000000003')::int,
  1,
  'ANON: SELECT nutricionistas_publicos = permitido'
);

-- 12. La view NO expone telefono
select throws_ok(
  $$ select telefono from nutricionistas_publicos limit 1 $$,
  '42703',
  null,
  'nutricionistas_publicos no expone la columna telefono'
);

-- 13. La view NO expone stripe_customer_id
select throws_ok(
  $$ select stripe_customer_id from nutricionistas_publicos limit 1 $$,
  '42703',
  null,
  'nutricionistas_publicos no expone la columna stripe_customer_id'
);
reset role;

-- ── PACIENTE ──────────────────────────────────────────────────────
-- 14. Paciente A SELECT propio = permitido
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000001')::int,
  1,
  'PACIENTE: SELECT propio = permitido'
);
reset role;

-- 15. Paciente A SELECT de otro paciente = bloqueado
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000002')::int,
  0,
  'PACIENTE: SELECT de otro paciente = bloqueado'
);
reset role;

-- 16. Paciente A SELECT perfil completo de un admin = bloqueado
--     (antes de la Sección 56 esto estaba permitido vía "rol='admin'" —
--     es exactamente el comportamiento inseguro que se cierra aquí)
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000003')::int,
  0,
  'PACIENTE: SELECT de perfil completo de un admin = bloqueado (Sección 56)'
);
reset role;

-- 17. Paciente A SELECT nutricionistas_publicos = permitido
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is(
  (select count(*) from nutricionistas_publicos where id = '10000000-0000-4000-8000-000000000003')::int,
  1,
  'PACIENTE: SELECT nutricionistas_publicos = permitido'
);
reset role;

-- ── ADMIN ─────────────────────────────────────────────────────────
-- 18. Admin A SELECT propio = permitido
select tests.authenticate_as('10000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000003')::int,
  1,
  'ADMIN: SELECT propio = permitido'
);
reset role;

-- 19. Admin A SELECT paciente propio (Paciente A) = permitido
select tests.authenticate_as('10000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000001')::int,
  1,
  'ADMIN: SELECT paciente propio = permitido'
);
reset role;

-- 20. Admin A SELECT paciente ajeno (Paciente B, de Admin B) = bloqueado
select tests.authenticate_as('10000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000002')::int,
  0,
  'ADMIN: SELECT paciente ajeno = bloqueado'
);
reset role;

-- 21. Admin A SELECT perfil completo de Admin B = bloqueado
--     (antes de la Sección 56 esto estaba permitido vía "rol='admin'")
select tests.authenticate_as('10000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000004')::int,
  0,
  'ADMIN: SELECT perfil completo de otro admin = bloqueado (Sección 56)'
);
reset role;

-- 22. Admin A SELECT nutricionistas_publicos = permitido
select tests.authenticate_as('10000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is(
  (select count(*) from nutricionistas_publicos where id = '10000000-0000-4000-8000-000000000004')::int,
  1,
  'ADMIN: SELECT nutricionistas_publicos = permitido'
);
reset role;

-- ── SUPERADMIN ────────────────────────────────────────────────────
-- 23. Superadmin SELECT cualquier paciente (Paciente B, no es su nutricionista) = permitido
select tests.authenticate_as('10000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000002')::int,
  1,
  'SUPERADMIN: SELECT cualquier paciente = permitido'
);
reset role;

-- 24. Superadmin SELECT cualquier admin = permitido
select tests.authenticate_as('10000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000003')::int,
  1,
  'SUPERADMIN: SELECT cualquier admin = permitido'
);
reset role;

-- 25. Superadmin SELECT otro superadmin = permitido
select tests.authenticate_as('10000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is(
  (select count(*) from perfiles where id = '10000000-0000-4000-8000-000000000006')::int,
  1,
  'SUPERADMIN: SELECT otro superadmin = permitido'
);
reset role;

select * from finish();
rollback;
