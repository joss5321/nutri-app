-- Pruebas RLS de public.perfiles (Secciones 45, 46, 56 y 57 de
-- supabase_schema.sql).
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(60);

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

-- ══════════════════════════════════════════════════════════════════
-- SECCIÓN 56 (hardening) — GRANTS explícitos de nutricionistas_publicos.
-- Supabase concede ALL PRIVILEGES por defecto a anon/authenticated sobre
-- cualquier objeto nuevo de public; sin el REVOKE explícito de la
-- migración, la view (auto-updatable, security_invoker=false) permitía
-- UPDATE/DELETE que bypaseaban por completo la RLS de perfiles al correr
-- con el contexto de su dueño. Se prueba con intentos reales (no solo
-- has_table_privilege()) para confirmar el comportamiento efectivo, no
-- solo el catálogo de permisos.
-- ══════════════════════════════════════════════════════════════════

-- ── ANON ──────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '', true);
set local role anon;

-- 26. ANON SELECT nutricionistas_publicos = permitido
select is(
  (select count(*) from nutricionistas_publicos where id = '10000000-0000-4000-8000-000000000003')::int,
  1,
  'ANON: SELECT nutricionistas_publicos = permitido'
);

-- 27. ANON INSERT en nutricionistas_publicos = bloqueado
select throws_ok(
  $$ insert into nutricionistas_publicos (id, nombre_completo, email, avatar_url) values ('10000000-0000-4000-8000-000000000099', 'Intruso', 'intruso@test.local', null) $$,
  '42501',
  null,
  'ANON: INSERT en nutricionistas_publicos = bloqueado'
);

-- 28. ANON UPDATE en nutricionistas_publicos = bloqueado
select throws_ok(
  $$ update nutricionistas_publicos set nombre_completo = 'hack' where id = '10000000-0000-4000-8000-000000000003' $$,
  '42501',
  null,
  'ANON: UPDATE en nutricionistas_publicos = bloqueado'
);

-- 29. ANON DELETE en nutricionistas_publicos = bloqueado
select throws_ok(
  $$ delete from nutricionistas_publicos where id = '10000000-0000-4000-8000-000000000003' $$,
  '42501',
  null,
  'ANON: DELETE en nutricionistas_publicos = bloqueado'
);
reset role;

-- ── AUTHENTICATED ─────────────────────────────────────────────────
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;

-- 30. AUTHENTICATED SELECT nutricionistas_publicos = permitido
select is(
  (select count(*) from nutricionistas_publicos where id = '10000000-0000-4000-8000-000000000003')::int,
  1,
  'AUTHENTICATED: SELECT nutricionistas_publicos = permitido'
);

-- 31. AUTHENTICATED INSERT en nutricionistas_publicos = bloqueado
select throws_ok(
  $$ insert into nutricionistas_publicos (id, nombre_completo, email, avatar_url) values ('10000000-0000-4000-8000-000000000098', 'Intruso 2', 'intruso2@test.local', null) $$,
  '42501',
  null,
  'AUTHENTICATED: INSERT en nutricionistas_publicos = bloqueado'
);

-- 32. AUTHENTICATED UPDATE en nutricionistas_publicos = bloqueado
select throws_ok(
  $$ update nutricionistas_publicos set nombre_completo = 'hack' where id = '10000000-0000-4000-8000-000000000003' $$,
  '42501',
  null,
  'AUTHENTICATED: UPDATE en nutricionistas_publicos = bloqueado'
);

-- 33. AUTHENTICATED DELETE en nutricionistas_publicos = bloqueado
select throws_ok(
  $$ delete from nutricionistas_publicos where id = '10000000-0000-4000-8000-000000000003' $$,
  '42501',
  null,
  'AUTHENTICATED: DELETE en nutricionistas_publicos = bloqueado'
);
reset role;

-- ══════════════════════════════════════════════════════════════════
-- SECCIÓN 57 — UNIQUE en perfiles.stripe_customer_id
-- ══════════════════════════════════════════════════════════════════

-- 34. Existe la constraint UNIQUE (catálogo, sin efectos secundarios)
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.perfiles'::regclass
      and conname = 'perfiles_stripe_customer_id_key'
      and contype = 'u'),
  1,
  'Sección 57: existe constraint UNIQUE perfiles_stripe_customer_id_key'
);

-- 35. Dos valores NO-NULL iguales son rechazados — usando UPDATE sobre
-- fixtures ya creados vía tests.create_user() (nunca INSERT manual, para
-- no confundir el UNIQUE que probamos con otras restricciones/triggers de
-- perfiles que no vienen al caso aquí). service_role bypasea el trigger
-- de columnas sensibles de la Sección 45, que restringe stripe_customer_id
-- a superadmin — no es lo que este test evalúa.
select tests.create_user('10000000-0000-4000-8000-000000000007'::uuid, 'stripe-unique-a@test.local', 'usuario');
select tests.create_user('10000000-0000-4000-8000-000000000008'::uuid, 'stripe-unique-b@test.local', 'usuario');

set role service_role;
update perfiles set stripe_customer_id = 'cus_test_unique_dup' where id = '10000000-0000-4000-8000-000000000007';
select throws_ok(
  $$ update perfiles set stripe_customer_id = 'cus_test_unique_dup' where id = '10000000-0000-4000-8000-000000000008' $$,
  '23505',
  null,
  'Sección 57: UNIQUE rechaza un stripe_customer_id duplicado'
);
reset role;

-- ══════════════════════════════════════════════════════════════════
-- SECCIÓN 62 — Defensa en profundidad: grants de tabla en suscripciones
-- ══════════════════════════════════════════════════════════════════

-- 36. RLS habilitada en suscripciones (ya lo estaba en producción; se
-- confirma que sigue siéndolo tras la migración de esta sección).
select ok(
  (select relrowsecurity from pg_class where oid = 'public.suscripciones'::regclass),
  'Sección 62: suscripciones tiene RLS habilitada'
);

-- 37. Cero policies — deny-by-default total, ningún consumidor de cliente
-- real lo necesita (el plan del paciente se sirve desde perfiles.plan_membresia).
select is(
  (select count(*)::int from pg_policy where polrelid = 'public.suscripciones'::regclass),
  0,
  'Sección 62: suscripciones no tiene ninguna policy'
);

-- 38. anon sin ningún privilegio de tabla.
select ok(
  not has_table_privilege('anon', 'public.suscripciones', 'SELECT')
  and not has_table_privilege('anon', 'public.suscripciones', 'INSERT')
  and not has_table_privilege('anon', 'public.suscripciones', 'UPDATE')
  and not has_table_privilege('anon', 'public.suscripciones', 'DELETE'),
  'Sección 62: anon sin privilegios de tabla en suscripciones'
);

-- 39. authenticated sin ningún privilegio de tabla.
select ok(
  not has_table_privilege('authenticated', 'public.suscripciones', 'SELECT')
  and not has_table_privilege('authenticated', 'public.suscripciones', 'INSERT')
  and not has_table_privilege('authenticated', 'public.suscripciones', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.suscripciones', 'DELETE'),
  'Sección 62: authenticated sin privilegios de tabla en suscripciones'
);

-- 40. Un usuario autenticado real (incluso dueño de una fila) no puede ni
-- intentar el SELECT — falla por falta de grant de tabla, ni siquiera
-- llega a evaluarse RLS.
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ select * from suscripciones $$,
  '42501', null,
  'Sección 62: authenticated SELECT en suscripciones = bloqueado (sin grant de tabla)'
);
reset role;

-- 41-42. service_role sigue operando con normalidad — el REVOKE de esta
-- sección solo apunta a anon/authenticated, el backend real
-- (stripe-webhook / reconcile-stripe.mjs) no se ve afectado.
set local role service_role;
select lives_ok(
  $$ insert into suscripciones (id, user_id, stripe_subscription_id, stripe_price_id, status)
     values ('10000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000001', 'sub_test_seccion62', 'price_test', 'active') $$,
  'Sección 62: service_role INSERT en suscripciones = permitido (backend)'
);
select lives_ok(
  $$ update suscripciones set status = 'canceled' where id = '10000000-0000-4000-8000-0000000000f1' $$,
  'Sección 62: service_role UPDATE en suscripciones = permitido (backend)'
);
reset role;

-- ══════════════════ last_active_at / registrar_actividad() (Sección 70, Radar R3) ══════════════════

-- 36. Usuario autenticado puede ejecutar registrar_actividad()
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ select public.registrar_actividad() $$,
  'registrar_actividad: usuario autenticado puede ejecutarla');
reset role;

-- 37. Solo modificó su propio last_active_at (quedó no-null)
select is(
  (select (last_active_at is not null) from perfiles where id = '10000000-0000-4000-8000-000000000001'),
  true, 'registrar_actividad: last_active_at del propio caller quedó establecido');

-- 38. No modificó otras columnas (nombre_completo intacto — el test 2 ya
--     lo había cambiado a 'Nuevo Nombre' antes de llegar aquí; el punto es
--     que registrar_actividad() no lo tocó, no cuál sea el valor original).
select is(
  (select nombre_completo from perfiles where id = '10000000-0000-4000-8000-000000000001'),
  'Nuevo Nombre', 'registrar_actividad: no modifica ninguna otra columna del perfil');

-- 39. Paciente A no pudo actualizar la actividad de Paciente B (el RPC no
--     recibe user_id — solo puede tocar auth.uid()).
select is(
  (select last_active_at from perfiles where id = '10000000-0000-4000-8000-000000000002'),
  null, 'registrar_actividad: no afecta el last_active_at de otro usuario');

-- 40. Llamada repetida no rompe nada (idempotente en el sentido de "no lanza error")
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ select public.registrar_actividad() $$,
  'registrar_actividad: una segunda llamada el mismo día no falla');
reset role;

-- Nota: se usa un literal fijo ('2099-01-01', nunca 'now()') como el
-- valor a intentar escribir. now() es constante durante TODA la
-- transacción en Postgres, y esta fila ya quedó con last_active_at =
-- now() por el test 36 — comparar contra ese mismo now() haría que "IS
-- DISTINCT FROM" viera un no-op (mismo valor) y el bloque de protección
-- del trigger ni siquiera se evaluaría, dando un falso "no lanzó
-- excepción" que no tiene nada que ver con la protección real.

-- 41. Paciente NO puede hacer UPDATE directo de su propio last_active_at
--     (el único requisito "MUY IMPORTANTE" de esta sección).
select tests.authenticate_as('10000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update perfiles set last_active_at = '2099-01-01T00:00:00Z'::timestamptz where id = '10000000-0000-4000-8000-000000000001' $$,
  null, null, 'perfiles: paciente UPDATE directo de last_active_at = bloqueado (fuera de registrar_actividad)');
reset role;

-- 42. Nutriólogo dueño tampoco puede falsear el last_active_at de su
--     paciente con un UPDATE directo (RLS de fila se lo permitiría, el
--     trigger de columna lo bloquea igual).
select tests.authenticate_as('10000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ update perfiles set last_active_at = '2099-01-01T00:00:00Z'::timestamptz where id = '10000000-0000-4000-8000-000000000001' $$,
  null, null, 'perfiles: nutriólogo dueño UPDATE directo de last_active_at de su paciente = bloqueado');
reset role;

-- 43. Ni siquiera superadmin puede falsearlo con UPDATE directo — la
--     columna es exclusiva de registrar_actividad(), sin excepción de rol.
select tests.authenticate_as('10000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ update perfiles set last_active_at = '2099-01-01T00:00:00Z'::timestamptz where id = '10000000-0000-4000-8000-000000000002' $$,
  null, null, 'perfiles: superadmin UPDATE directo de last_active_at = bloqueado');
reset role;

-- 44. authenticated tiene EXECUTE sobre registrar_actividad().
select ok(
  has_function_privilege('authenticated', 'public.registrar_actividad()', 'EXECUTE'),
  'registrar_actividad: authenticated tiene EXECUTE');

-- 45. anon NO tiene EXECUTE.
select ok(
  not has_function_privilege('anon', 'public.registrar_actividad()', 'EXECUTE'),
  'registrar_actividad: anon NO tiene EXECUTE');

-- ══════════════════════════════════════════════════════════════════════
-- Sección 82 — proteger al último superadmin (corrección de incidente
-- real: un superadmin se auto-degradó vía curl directo a PostgREST y
-- dejó el sistema sin ningún superadmin restante).
-- ══════════════════════════════════════════════════════════════════════

-- 46. Con 2+ superadmins, un superadmin SÍ puede degradar a OTRO
--     superadmin — no bloquea nada mientras quede al menos uno más.
select tests.authenticate_as('10000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update perfiles set rol = 'admin' where id = '10000000-0000-4000-8000-000000000006' $$,
  'Con 2 superadmins, degradar a uno de ellos SÍ se permite (queda uno restante)');
reset role;

-- Deshacer para no afectar los siguientes casos (mismo actor, mismo
-- chequeo — con 2 superadmins de nuevo, promover de vuelta también vive).
select tests.authenticate_as('10000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update perfiles set rol = 'superadmin' where id = '10000000-0000-4000-8000-000000000006' $$,
  'Restaurar a superadmin-b para los siguientes casos');
reset role;

-- 47. El ÚLTIMO superadmin NO puede degradar a otro superadmin si eso
--     dejaría CERO superadmins — se prueba degradando primero a uno de
--     los dos, dejando exactamente uno, y luego intentando degradar al
--     que queda.
select tests.authenticate_as('10000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
update perfiles set rol = 'admin' where id = '10000000-0000-4000-8000-000000000006';
reset role;

select is(
  (select count(*)::int from perfiles where rol = 'superadmin'),
  1, 'Precondición: solo queda un superadmin en el sistema');

select tests.authenticate_as('10000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ update perfiles set rol = 'usuario' where id = '10000000-0000-4000-8000-000000000005' $$,
  'P0001', null,
  'El último superadmin NO puede auto-degradarse — bloqueado por el trigger, igual vía UI que vía curl');
reset role;

select is(
  (select rol from perfiles where id = '10000000-0000-4000-8000-000000000005'),
  'superadmin', 'El intento bloqueado no dejó ningún cambio parcial — sigue siendo superadmin');

-- 48. Tampoco puede degradarse a 'admin' (no solo a 'usuario') — el
--     chequeo es "deja de ser superadmin", no un valor específico.
select tests.authenticate_as('10000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ update perfiles set rol = 'admin' where id = '10000000-0000-4000-8000-000000000005' $$,
  'P0001', null,
  'El último superadmin tampoco puede degradarse a admin');
reset role;

-- 49. Restaurar al segundo superadmin no está bloqueado por este chequeo
--     (no es un cambio de superadmin hacia otra cosa, es al revés).
select tests.authenticate_as('10000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update perfiles set rol = 'superadmin' where id = '10000000-0000-4000-8000-000000000006' $$,
  'Promover de vuelta a superadmin-b no está restringido por este chequeo');
reset role;

-- 50. Con 2 superadmins de nuevo, AHORA sí se puede degradar al primero.
select tests.authenticate_as('10000000-0000-4000-8000-000000000006'::uuid);
set local role authenticated;
select lives_ok(
  $$ update perfiles set rol = 'usuario' where id = '10000000-0000-4000-8000-000000000005' $$,
  'Con 2 superadmins restaurados, degradar a uno de ellos vuelve a estar permitido');
reset role;

select * from finish();
rollback;
