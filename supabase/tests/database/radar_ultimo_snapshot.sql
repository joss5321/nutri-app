-- Pruebas de la vista public.radar_ultimo_snapshot (Sección 79 de
-- supabase_schema.sql, R5) — la única pieza de backend nueva de R5.
-- No es una función privilegiada: es una vista de solo lectura con
-- security_invoker=true, así que estas pruebas verifican exactamente que
-- la RLS de score_snapshots (ya probada exhaustivamente en radar.sql) se
-- sigue respetando cuando se consulta A TRAVÉS de la vista, y que
-- DISTINCT ON realmente selecciona el snapshot más reciente por paciente.
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(11);

select tests.create_user('c0000000-0000-4000-8000-000000000090'::uuid, 'nutri-dueno-vista@test.local', 'admin');
select tests.create_user('c0000000-0000-4000-8000-000000000091'::uuid, 'nutri-ajeno-vista@test.local', 'admin');
select tests.create_user('c0000000-0000-4000-8000-000000000092'::uuid, 'superadmin-vista@test.local', 'superadmin');

select tests.create_user('c0000000-0000-4000-8000-000000000001'::uuid, 'p1-vista@test.local', 'usuario', 'c0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
select tests.create_user('c0000000-0000-4000-8000-000000000002'::uuid, 'p2-vista@test.local', 'usuario', 'c0000000-0000-4000-8000-000000000091'::uuid, true, 'aprobado');

-- P1 (dueño = admin 090) tiene 3 snapshots en fechas distintas — la vista
-- debe devolver SOLO el más reciente (2026-03-16), no los otros dos.
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, estado)
values
  ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000090', '2026-03-01'::date, 'v1.0', 90, 90, 60, 'verde'),
  ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000090', '2026-03-10'::date, 'v1.0', 90, 90, 55, 'amarillo'),
  ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000090', '2026-03-16'::date, 'v1.0', 90, 90, 40, 'rojo');

-- P2 (dueño = admin 091, "ajeno" para admin 090) tiene 1 snapshot.
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, estado)
values ('c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000091', '2026-03-16'::date, 'v1.0', 85, 85, 70, 'verde');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 1 — la vista selecciona el snapshot MÁS RECIENTE, no cualquiera.
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('c0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from radar_ultimo_snapshot where paciente_id = 'c0000000-0000-4000-8000-000000000001'),
  1, 'La vista devuelve exactamente 1 fila para P1 pese a tener 3 snapshots históricos');
select is(
  (select snapshot_date from radar_ultimo_snapshot where paciente_id = 'c0000000-0000-4000-8000-000000000001'),
  '2026-03-16'::date, 'La vista elige el snapshot con la fecha más reciente (2026-03-16, no 2026-03-01 ni 2026-03-10)');
select is(
  (select estado from radar_ultimo_snapshot where paciente_id = 'c0000000-0000-4000-8000-000000000001'),
  'rojo', 'El estado devuelto corresponde al snapshot más reciente (rojo), no a uno histórico');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Caso 2 — RLS: nutriólogo dueño ve solo sus propios pacientes vía la vista.
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('c0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from radar_ultimo_snapshot),
  1, 'El nutriólogo dueño ve exactamente 1 fila en la vista (la de su propio paciente P1)');
select is(
  (select count(*)::int from radar_ultimo_snapshot where paciente_id = 'c0000000-0000-4000-8000-000000000002'),
  0, 'El nutriólogo dueño NO ve, vía la vista, al paciente de otro nutriólogo (P2)');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Caso 3 — RLS: nutriólogo ajeno no ve nada de P1 vía la vista.
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('c0000000-0000-4000-8000-000000000091'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from radar_ultimo_snapshot where paciente_id = 'c0000000-0000-4000-8000-000000000001'),
  0, 'Un nutriólogo ajeno no ve, vía la vista, al paciente de otro nutriólogo (P1)');
select is(
  (select count(*)::int from radar_ultimo_snapshot where paciente_id = 'c0000000-0000-4000-8000-000000000002'),
  1, 'Ese mismo nutriólogo sí ve a su propio paciente (P2) vía la vista');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Caso 4 — RLS: superadmin ve a todos vía la vista.
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('c0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from radar_ultimo_snapshot),
  2, 'Superadmin ve, vía la vista, el último snapshot de AMBOS pacientes (1 fila por paciente)');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Caso 5 — RLS: el propio paciente no ve nada vía la vista.
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from radar_ultimo_snapshot),
  0, 'El propio paciente no ve nada en la vista (mismo diseño que score_snapshots — sin dashboard de paciente todavía)');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Caso 6 — la vista es de solo lectura para cualquier cliente.
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('c0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into radar_ultimo_snapshot (paciente_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, estado)
     values ('c0000000-0000-4000-8000-000000000001', '2099-01-01', 'v1.0', 0, 0, 'verde') $$,
  null, null, 'Ni siquiera superadmin puede insertar a través de la vista (DISTINCT ON no es actualizable)');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Caso 7 — anon no tiene acceso alguno.
-- ══════════════════════════════════════════════════════════════════════
select is(
  has_table_privilege('anon', 'radar_ultimo_snapshot', 'SELECT'),
  false, 'anon no tiene SELECT en la vista');

select * from finish();
rollback;
