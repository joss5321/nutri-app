-- Pruebas de observabilidad de la corrida diaria de Radar (Sección 77 de
-- supabase_schema.sql, R4C-1): radar_ejecuciones, el vínculo
-- radar_ejecucion_errores.ejecucion_id, y los entrypoints
-- radar_ejecutar_manual() / radar_cron_tick().
--
-- Corre en su PROPIO archivo (transacción aislada) a propósito: para
-- probar "0 pacientes candidatos" y "todos los candidatos fallan" se
-- necesita control total y exacto de la población de perfiles, algo que
-- ya no es posible dentro de radar.sql (que para cuando llega a esta
-- sección ya tiene ~20 pacientes aprobados creados por sus propios casos).
--
-- Advertencia de diseño importante, verificada antes de escribir estas
-- pruebas: now() es constante durante TODA la transacción de un archivo
-- pgTAP (BEGIN...ROLLBACK = una sola transacción), así que dos llamadas a
-- radar_ejecutar_manual() en este mismo archivo comparten el MISMO
-- now() congelado. Esto es inofensivo para pacientes_con_error (el guard
-- "ejecucion_id is null" en la correlación de errores desambigua
-- correctamente entre corridas secuenciales, verificado explícitamente
-- más abajo) pero SÍ haría ambiguo alertas_abiertas/alertas_resueltas_
-- automaticamente si dos corridas del mismo archivo tocaran la MISMA
-- alerta persistente — por eso la prueba de alertas usa un paciente que
-- solo se evalúa una vez dentro de este archivo, no encadenada con las
-- demás corridas.
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(41);

select tests.create_user('b0000000-0000-4000-8000-000000000090'::uuid, 'nutri-r4c@test.local', 'admin');
select tests.create_user('b0000000-0000-4000-8000-000000000092'::uuid, 'superadmin-r4c@test.local', 'superadmin');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 1 — permisos: un nutriólogo (no superadmin) NO puede ejecutar
-- Radar manualmente.
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select throws_ok(
  $$ select radar_ejecutar_manual() $$,
  null, null, 'Un nutriólogo (no superadmin) no puede llamar radar_ejecutar_manual()');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Caso 2 — 0 pacientes candidatos → exitoso (no "nada que hacer" no es falla).
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select lives_ok(
  $$ select radar_ejecutar_manual() $$,
  'Superadmin puede ejecutar Radar manualmente (0 candidatos)');
reset role;

select is(
  (select pacientes_candidatos from radar_ejecuciones order by iniciado_at desc limit 1),
  0, 'Con 0 perfiles aprobados+usuario+activos, pacientes_candidatos = 0');
select is(
  (select resultado from radar_ejecuciones order by iniciado_at desc limit 1),
  'exitoso', '0 candidatos se clasifica como exitoso, no como fallo');
select is(
  (select trigger_origen from radar_ejecuciones order by iniciado_at desc limit 1),
  'manual', 'trigger_origen queda correctamente marcado como manual');
select ok(
  (select finalizado_at from radar_ejecuciones order by iniciado_at desc limit 1) is not null,
  'La corrida queda marcada como finalizada (finalizado_at no nulo)');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 3 — ejecución normal con candidatos, todos exitosos.
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('b0000000-0000-4000-8000-000000000001'::uuid, 'p1-r4c@test.local', 'usuario', 'b0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
select tests.create_user('b0000000-0000-4000-8000-000000000002'::uuid, 'p2-r4c@test.local', 'usuario', 'b0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = (now() at time zone 'America/Mexico_City')::date - 60
  where id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
insert into planes_nutricionales (user_id, objetivo, activo) values
  ('b0000000-0000-4000-8000-000000000001', 'Definición', true),
  ('b0000000-0000-4000-8000-000000000002', 'Definición', true);

select tests.authenticate_as('b0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select lives_ok($$ select radar_ejecutar_manual() $$, 'Segunda corrida manual, ahora con 2 candidatos');
reset role;

select is((select pacientes_candidatos from radar_ejecuciones order by iniciado_at desc limit 1), 2, 'pacientes_candidatos = 2');
select is((select pacientes_procesados from radar_ejecuciones order by iniciado_at desc limit 1), 2, 'pacientes_procesados = 2 (ninguno falló)');
select is((select pacientes_con_error from radar_ejecuciones order by iniciado_at desc limit 1), 0, 'pacientes_con_error = 0');
select is((select snapshots_generados from radar_ejecuciones order by iniciado_at desc limit 1), 2, 'snapshots_generados = pacientes_procesados = 2');
select is((select resultado from radar_ejecuciones order by iniciado_at desc limit 1), 'exitoso', 'resultado = exitoso');
select is((select alertas_abiertas from radar_ejecuciones order by iniciado_at desc limit 1), 0, 'Sin citas/caídas configuradas, esta corrida no abre ninguna alerta');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 4 — un paciente falla, los demás no → parcial. Se inyecta una
-- falla determinista (mismo mecanismo ya usado en radar.sql Caso 23) sin
-- tocar el código real del motor.
-- ══════════════════════════════════════════════════════════════════════
create or replace function public._test_fallar_para_prueba_r4c()
returns trigger language plpgsql as $$
begin
  if new.paciente_id = 'b0000000-0000-4000-8000-000000000003' then
    raise exception 'Falla inyectada deliberadamente para probar radar_ejecuciones (Caso 4).';
  end if;
  return new;
end;
$$;
create trigger trg_test_fallar_r4c before insert on score_snapshots
  for each row execute function public._test_fallar_para_prueba_r4c();

select tests.create_user('b0000000-0000-4000-8000-000000000003'::uuid, 'p3-r4c@test.local', 'usuario', 'b0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = (now() at time zone 'America/Mexico_City')::date - 60
  where id = 'b0000000-0000-4000-8000-000000000003';
insert into planes_nutricionales (user_id, objetivo, activo) values ('b0000000-0000-4000-8000-000000000003', 'Definición', true);

select tests.authenticate_as('b0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select lives_ok($$ select radar_ejecutar_manual() $$, 'Tercera corrida manual, ahora con 1 paciente roto');
reset role;

select is((select pacientes_candidatos from radar_ejecuciones order by iniciado_at desc limit 1), 3, 'pacientes_candidatos = 3 (P1, P2, P3)');
select is((select pacientes_procesados from radar_ejecuciones order by iniciado_at desc limit 1), 2, 'pacientes_procesados = 2 (P1, P2)');
select is((select pacientes_con_error from radar_ejecuciones order by iniciado_at desc limit 1), 1, 'pacientes_con_error = 1 (P3)');
select is((select resultado from radar_ejecuciones order by iniciado_at desc limit 1), 'parcial', 'resultado = parcial (al menos uno ok, al menos uno con error)');

-- El error de P3 queda asociado exactamente a ESTA ejecución, no a la
-- anterior (que no tuvo errores) ni a ninguna futura.
select is(
  (select r.ejecucion_id from radar_ejecucion_errores r
     join radar_ejecuciones e on e.id = r.ejecucion_id
     where r.paciente_id = 'b0000000-0000-4000-8000-000000000003'
     order by r.created_at desc limit 1),
  (select id from radar_ejecuciones order by iniciado_at desc limit 1),
  'El error de P3 queda vinculado al id de radar_ejecuciones de esta corrida (Caso parcial)');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 5 — TODOS los candidatos fallan → fallo_total. Se desactivan P1/P2
-- (dejan de ser candidatos) y P3 sigue fallando por el mismo trigger.
-- ══════════════════════════════════════════════════════════════════════
update perfiles set is_active = false where id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');

select tests.authenticate_as('b0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select lives_ok($$ select radar_ejecutar_manual() $$, 'Cuarta corrida manual, únicamente con el candidato roto');
reset role;

select is((select pacientes_candidatos from radar_ejecuciones order by iniciado_at desc limit 1), 1, 'pacientes_candidatos = 1 (P1/P2 quedaron inactivos)');
select is((select pacientes_procesados from radar_ejecuciones order by iniciado_at desc limit 1), 0, 'pacientes_procesados = 0');
select is((select pacientes_con_error from radar_ejecuciones order by iniciado_at desc limit 1), 1, 'pacientes_con_error = 1');
select is((select resultado from radar_ejecuciones order by iniciado_at desc limit 1), 'fallo_total', 'resultado = fallo_total (hubo candidatos, ninguno se procesó)');

-- El nuevo error de P3 queda asociado a ESTA corrida (Caso 5), no a la
-- del Caso 4 — prueba directa de que el guard "ejecucion_id is null"
-- desambigua corridas secuenciales pese a que now() está congelado para
-- todo este archivo.
select is(
  (select count(distinct r.ejecucion_id)::int from radar_ejecucion_errores r where r.paciente_id = 'b0000000-0000-4000-8000-000000000003'),
  2, 'Los 2 errores acumulados de P3 (Caso 4 y Caso 5) tienen ejecucion_id DISTINTOS entre sí');

drop trigger if exists trg_test_fallar_r4c on score_snapshots;
drop function if exists public._test_fallar_para_prueba_r4c();

-- ══════════════════════════════════════════════════════════════════════
-- Caso 6 — idempotencia: reactivar P1 y correr dos veces seguidas no
-- duplica su snapshot del día.
-- ══════════════════════════════════════════════════════════════════════
update perfiles set is_active = true where id = 'b0000000-0000-4000-8000-000000000001';

select tests.authenticate_as('b0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select radar_ejecutar_manual();
select radar_ejecutar_manual();
reset role;

select is(
  (select count(*)::int from score_snapshots where paciente_id = 'b0000000-0000-4000-8000-000000000001' and snapshot_date = (now() at time zone 'America/Mexico_City')::date),
  1, 'Dos corridas seguidas el mismo día no duplican el snapshot de P1 (upsert)');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 7 — alertas_abiertas cuenta lo tocado en ESTA corrida (paciente
-- nuevo, no encadenado con las corridas anteriores, para no toparse con
-- la limitación de now() congelado documentada arriba).
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('b0000000-0000-4000-8000-000000000004'::uuid, 'p4-r4c@test.local', 'usuario', 'b0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = (now() at time zone 'America/Mexico_City')::date - 60
  where id = 'b0000000-0000-4000-8000-000000000004';
insert into planes_nutricionales (user_id, objetivo, activo) values ('b0000000-0000-4000-8000-000000000004', 'Definición', true);
insert into citas (user_id, fecha, hora, tipo, estado) values
  ('b0000000-0000-4000-8000-000000000004', (now() at time zone 'America/Mexico_City')::date + 1, '10:00', 'Seguimiento', 'pendiente');

select tests.authenticate_as('b0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select lives_ok($$ select radar_ejecutar_manual() $$, 'Quinta corrida manual, con un paciente que dispara una alerta nueva');
reset role;

select is((select alertas_abiertas from radar_ejecuciones order by iniciado_at desc limit 1), 1, 'alertas_abiertas = 1 (la cita pendiente de P4)');
select is((select alertas_resueltas_automaticamente from radar_ejecuciones order by iniciado_at desc limit 1), 0, 'alertas_resueltas_automaticamente = 0 (nada se resolvió en esta corrida)');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 8 — regresión del hueco de grants encontrado al desplegar a
-- Supabase hosted por primera vez (Sección 78): en un proyecto hosted
-- real, la plataforma otorga EXECUTE a anon/authenticated como grants
-- directos a esos roles (no vía PUBLIC) sobre toda función nueva de
-- public — "revoke ... from public" no alcanza a retirar eso. Estas
-- pruebas verifican el estado deseado con has_function_privilege()
-- (que si existiera ese mismo hueco aquí en local también lo detectaría)
-- y con una invocación real como authenticated.
select is(
  has_function_privilege('anon', '_radar_ejecutar_con_observabilidad(text)', 'EXECUTE'),
  false, 'anon no tiene EXECUTE en _radar_ejecutar_con_observabilidad');
select is(
  has_function_privilege('authenticated', '_radar_ejecutar_con_observabilidad(text)', 'EXECUTE'),
  false, 'authenticated no tiene EXECUTE en _radar_ejecutar_con_observabilidad');
select is(
  has_function_privilege('anon', '_radar_gestionar_alerta(uuid,uuid,text,text,boolean,boolean,date,text,jsonb)', 'EXECUTE'),
  false, 'anon no tiene EXECUTE en _radar_gestionar_alerta');
select is(
  has_function_privilege('authenticated', '_radar_gestionar_alerta(uuid,uuid,text,text,boolean,boolean,date,text,jsonb)', 'EXECUTE'),
  false, 'authenticated no tiene EXECUTE en _radar_gestionar_alerta');

select tests.authenticate_as('b0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select throws_ok(
  $$ select public._radar_ejecutar_con_observabilidad('manual') $$,
  '42501', null, 'Un nutriólogo autenticado no puede invocar _radar_ejecutar_con_observabilidad directamente (bypass de radar_ejecutar_manual)');
reset role;

-- Los caminos públicos autorizados siguen funcionando: radar_ejecutar_manual
-- (superadmin) y resolver_alerta_radar (nutriólogo dueño) ya se probaron
-- exitosamente arriba en este mismo archivo — esta corrida adicional
-- confirma que el fix de grants no rompió el camino correcto.
select tests.authenticate_as('b0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select lives_ok(
  $$ select radar_ejecutar_manual() $$,
  'radar_ejecutar_manual sigue funcionando para superadmin tras el fix de grants (camino público correcto intacto)');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- RLS de radar_ejecuciones / radar_ejecucion_errores — paciente y
-- nutriólogo sin acceso, superadmin con SELECT, nadie con escritura.
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select is((select count(*)::int from radar_ejecuciones), 0, 'El nutriólogo NO puede leer radar_ejecuciones');
select is((select count(*)::int from radar_ejecucion_errores), 0, 'El nutriólogo NO puede leer radar_ejecucion_errores');
select throws_ok(
  $$ insert into radar_ejecuciones (fecha_evaluada, iniciado_at, trigger_origen) values (current_date, now(), 'manual') $$,
  '42501', null, 'Ningún cliente puede insertar directamente en radar_ejecuciones (sin policy de INSERT)');
reset role;

select tests.authenticate_as('b0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select ok(
  (select count(*)::int from radar_ejecuciones) > 0,
  'Superadmin sí puede leer radar_ejecuciones');
select ok(
  (select count(*)::int from radar_ejecucion_errores) > 0,
  'Superadmin sí puede leer radar_ejecucion_errores');
select throws_ok(
  $$ insert into radar_ejecuciones (fecha_evaluada, iniciado_at, trigger_origen) values (current_date, now(), 'manual') $$,
  '42501', null, 'Ni siquiera superadmin puede insertar directamente en radar_ejecuciones (solo el motor SECURITY DEFINER)');
reset role;

select * from finish();
rollback;
