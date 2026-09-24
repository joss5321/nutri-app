-- Pruebas de MyFitTrack Radar — medición post-intervención (Sección 81 de
-- supabase_schema.sql, R7). Cubre evaluar_resultado_intervencion(), su
-- integración con ejecutar_radar_diario()/_radar_ejecutar_con_observabilidad(),
-- y la inmutabilidad del resultado.
--
-- Técnica de fechas: cada caso registra su intervención vía el RPC real
-- (para pasar por toda la validación real) y LUEGO retrocede
-- manualmente su created_at a un ancla fija ('2026-01-01 12:00:00'
-- America/Mexico_City, salvo que el caso indique otra) — así la ventana
-- de 14 días queda en el pasado de forma 100% determinista sin depender
-- de cuándo se ejecuta esta prueba. El snapshot "antes" se inserta ANTES
-- de registrar, con una fecha ya elegida para caer dentro de la ventana
-- "antes" (ancla-7 .. ancla-1) una vez retrocedida la intervención.
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(44);

select tests.create_user('d0000000-0000-4000-8000-000000000090'::uuid, 'nutri-r7@test.local', 'admin');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 1 — Mejora (delta_adherence > +10, confianza suficiente en ambos
-- lados) → 'mejoro'
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-000000000001'::uuid, 'p-r7-mejora@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 90, 90, 40, 30, 'rojo');

select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000001'::uuid, null, 'contacto', 'whatsapp', null, null);
reset role;

update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000001';

-- Snapshot "después" dentro de [2026-01-02, 2026-01-15], adherencia +18.
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000090', '2026-01-10', 'v1.0', 85, 85, 58, 5, 'verde');

-- Caso 1a: llamar ANTES de que cierre la ventana (día 10) — no debe pasar nada.
select lives_ok(
  $$ select evaluar_resultado_intervencion(
       (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
       '2026-01-10'::date
     ) $$,
  'evaluar_resultado_intervencion no falla si se llama antes de que cierre la ventana');
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
  'pendiente', 'Antes de los 14 días, el resultado permanece pendiente (test #1 de la lista obligatoria)');

-- Caso 1b: llamar exactamente el día en que cierra (fecha_intervencion+14 = 2026-01-15).
select lives_ok(
  $$ select evaluar_resultado_intervencion(
       (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
       '2026-01-15'::date
     ) $$,
  'evaluar_resultado_intervencion calcula al cerrar la ventana');
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
  'mejoro', 'delta_adherence = +18 (>10), confianza suficiente en ambos lados → mejoro');
select is(
  (select adherence_despues from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
  58::numeric(5,2), 'adherence_despues toma el snapshot más reciente de la ventana de 14 días');
select is(
  (select risk_points_despues from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
  5, 'risk_points_despues correcto');
select is(
  (select confianza_despues from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
  85::numeric(5,2), 'confianza_despues correcto');
select isnt(
  (select snapshot_id_despues from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
  null, 'snapshot_id_despues queda ligado al snapshot real usado');
select is(
  (select rules_version_resultado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
  'radar-resultado-v1', 'rules_version_resultado identifica la versión del algoritmo de clasificación');
select is(
  (select rules_version from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
  'v1.0', 'rules_version (del snapshot "antes") no se toca ni se confunde con rules_version_resultado');
select isnt(
  (select resultado_calculado_at from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
  null, 'resultado_calculado_at queda registrado');

-- Caso 1c: inmutabilidad — una segunda llamada NO recalcula, aunque
-- cambien los datos subyacentes después.
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000090', '2026-01-16', 'v1.0', 10, 10, 5, 90, 'rojo');
select lives_ok(
  $$ select evaluar_resultado_intervencion(
       (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
       '2026-01-20'::date
     ) $$,
  'Una segunda llamada (incluso con más datos nuevos y otra fecha) no falla — es un no-op');
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
  'mejoro', 'El resultado queda congelado: la segunda llamada NO recalcula (test obligatorio "resultado congelado")');
select is(
  (select adherence_despues from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000001'),
  58::numeric(5,2), 'adherence_despues tampoco cambia — ignora el snapshot nuevo posterior al cálculo');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 2 — Estable (delta dentro de [-10, +10])
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-000000000002'::uuid, 'p-r7-estable@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 80, 80, 60, 10, 'amarillo');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000002'::uuid, null, 'motivacion_seguimiento', null, null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000002';
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 75, 75, 65, 8, 'amarillo');

select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000002'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000002'),
  'estable', 'delta_adherence = +5 (dentro de [-10,+10]) → estable');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 3 — Empeoró (delta < -10)
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-000000000003'::uuid, 'p-r7-empeoro@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 85, 85, 70, 5, 'verde');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000003'::uuid, null, 'reagendar_cita', null, null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000003';
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 80, 80, 50, 20, 'naranja');

select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000003'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000003'),
  'empeoro', 'delta_adherence = -20 (<-10) → empeoro');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 4 — confidence_before insuficiente → inconcluso
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-000000000004'::uuid, 'p-r7-confbefore@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 20, 20, 40, 0, 'amarillo');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000004'::uuid, null, 'contacto', 'llamada', null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000004';
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 90, 90, 90, 0, 'verde');

select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000004'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000004'),
  'inconcluso', 'confianza_antes=20% (<50) → inconcluso, aunque adherencia subió muchísimo (test obligatorio: no debe decir "mejoró")');
select is(
  (select confianza_despues from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000004'),
  90::numeric(5,2), 'Aun así, confianza_despues queda guardada (información útil para el futuro, aunque el resultado sea inconcluso)');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 5 — confidence_after insuficiente → inconcluso
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-000000000005'::uuid, 'p-r7-confafter@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 90, 90, 50, 10, 'rojo');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000005'::uuid, null, 'ajuste_alimentacion', 'cambio_alimentos', null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000005';
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 15, 15, 90, 0, 'amarillo');

select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000005'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000005'),
  'inconcluso', 'confianza_despues=15% (<50) → inconcluso, aunque confianza_antes fuera suficiente');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 6 — Sección 8: cambio de registro ≠ cambio de adherencia (la
-- confianza SUBE de 20% a 85%, pero como confidence_before era
-- insuficiente, sigue siendo inconcluso — nunca "mejoró")
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-000000000006'::uuid, 'p-r7-registro@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 20, 20, 10, 0, 'amarillo');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000006'::uuid, null, 'contacto', 'whatsapp', null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000006';
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 85, 85, 88, 0, 'verde');

select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000006'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000006'),
  'inconcluso', 'Confianza aumentó de 20% a 85% pero confidence_before era insuficiente → inconcluso, nunca "mejoró" (Sección 8 del alcance)');
select is(
  (select confianza_antes from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000006'),
  20::numeric(5,2), 'confianza_antes=20% queda guardada');
select is(
  (select confianza_despues from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000006'),
  85::numeric(5,2), 'confianza_despues=85% queda guardada — dato útil aunque el resultado sea inconcluso');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 7 — Segunda intervención dentro de la ventana → confundido
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-000000000007'::uuid, 'p-r7-confundido1@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 90, 90, 40, 20, 'rojo');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000007'::uuid, null, 'contacto', 'whatsapp', null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000007';

-- Segunda intervención real, día 4 (dentro de la ventana [+1,+14]).
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000007'::uuid, null, 'ajuste_alimentacion', 'cambio_alimentos', null, null);
reset role;
update intervenciones set created_at = ('2026-01-05 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000007' and tipo = 'ajuste_alimentacion';

insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 85, 85, 70, 0, 'verde');

select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000007' and tipo = 'contacto'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000007' and tipo = 'contacto'),
  'confundido', 'Existe otra intervención (día 4) dentro de la ventana de 14 días → confundido');
select is(
  (select confound_detalle from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000007' and tipo = 'contacto'),
  'Se registró otra intervención el 05/01/2026.', 'confound_detalle explica cuál y cuándo');
-- La segunda intervención mantiene su propia ventana independiente — no
-- se ve afectada por ser "la causa" del confounder de la primera.
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000007' and tipo = 'ajuste_alimentacion'),
  'pendiente', 'La segunda intervención conserva su propia ventana independiente (no se resuelve junto con la primera)');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 8 — Consulta confirmada dentro de la ventana → confundido
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-000000000008'::uuid, 'p-r7-confundido2@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 90, 90, 45, 10, 'naranja');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000008'::uuid, null, 'motivacion_seguimiento', null, null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000008';
insert into citas (user_id, fecha, hora, tipo, estado) values
  ('d0000000-0000-4000-8000-000000000008', '2026-01-08', '10:00', 'Seguimiento', 'confirmada');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 85, 85, 75, 0, 'verde');

select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000008'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000008'),
  'confundido', 'Cita confirmada dentro de la ventana → confundido');
select is(
  (select confound_detalle from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000008'),
  'Hubo una consulta confirmada el 08/01/2026 durante la ventana de seguimiento.', 'confound_detalle explica la fecha de la consulta');

-- Cita CANCELADA no debe contar como confounder.
select tests.create_user('d0000000-0000-4000-8000-00000000000c'::uuid, 'p-r7-citacancelada@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000c', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 90, 90, 50, 0, 'verde');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-00000000000c'::uuid, null, 'motivacion_seguimiento', null, null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-00000000000c';
insert into citas (user_id, fecha, hora, tipo, estado) values
  ('d0000000-0000-4000-8000-00000000000c', '2026-01-08', '10:00', 'Seguimiento', 'cancelada');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000c', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 85, 85, 55, 0, 'verde');
select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000c'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000c'),
  'estable', 'Una cita CANCELADA no cuenta como confounder (solo "confirmada")');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 9 — Intervención SIN alerta también se mide (Sección 11)
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-000000000009'::uuid, 'p-r7-sinalerta@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 90, 90, 55, 0, 'verde');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000009'::uuid, null, 'motivacion_seguimiento', null, null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000009';
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 85, 85, 70, 0, 'verde');
select is((select alerta_id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000009'), null, 'Precondición: la intervención no tiene alerta_id');
select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000009'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000009'),
  'mejoro', 'Una intervención sin alerta_id se mide exactamente igual (delta=+15)');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 10 — 'sin_accion' también entra al sistema de resultados (Sección 12)
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-00000000000a'::uuid, 'p-r7-sinaccion@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 90, 90, 60, 0, 'amarillo');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-00000000000a'::uuid, null, 'sin_accion', null, null, 'no_relevante');
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-00000000000a';
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 85, 85, 62, 0, 'amarillo');
select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000a'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000a'),
  'estable', 'sin_accion también se mide (delta=+2 → estable) — señal futura para calibrar falsos positivos');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 11 — Límites exactos de la ventana "después": día 0 excluido, día
-- 14 incluido (usa el snapshot más reciente DENTRO de la ventana)
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-00000000000b'::uuid, 'p-r7-limites@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000b', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 90, 90, 50, 0, 'verde');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-00000000000b'::uuid, null, 'motivacion_seguimiento', null, null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-00000000000b';
-- Día 0 (2026-01-01, el día de la intervención): valor extremo — NO debe
-- ser usado como "después" (la ventana empieza en día 1).
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000b', 'd0000000-0000-4000-8000-000000000090', '2026-01-01', 'v1.0', 95, 95, 5, 50, 'rojo');
-- Día 10: valor intermedio.
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000b', 'd0000000-0000-4000-8000-000000000090', '2026-01-10', 'v1.0', 85, 85, 55, 0, 'verde');
-- Día 14 (2026-01-15, último día de la ventana): este es el que debe usarse.
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000b', 'd0000000-0000-4000-8000-000000000090', '2026-01-15', 'v1.0', 88, 88, 58, 0, 'verde');

select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000b'), '2026-01-15'::date);
select is(
  (select adherence_despues from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000b'),
  58::numeric(5,2), 'Usa el snapshot del día 14 (el más reciente DENTRO de la ventana), no el del día 0 ni el del día 10');
select is(
  (select snapshot_id_despues from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000b'),
  (select id from score_snapshots where paciente_id = 'd0000000-0000-4000-8000-00000000000b' and snapshot_date = '2026-01-15'),
  'snapshot_id_despues apunta exactamente al snapshot del día 14');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 12 — Ventana "antes" no fresca (hueco de datos >7 días) → inconcluso
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-00000000000e'::uuid, 'p-r7-antesviejo@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
-- Snapshot "antes" fechado 20 días antes de la intervención (fuera de la
-- ventana de 7 días) — es el único snapshot que existe al momento de
-- registrar, así que R6 lo toma igual como "el más reciente disponible".
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000e', 'd0000000-0000-4000-8000-000000000090', '2025-12-12', 'v1.0', 90, 90, 50, 0, 'verde');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-00000000000e'::uuid, null, 'motivacion_seguimiento', null, null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-00000000000e';
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000e', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 90, 90, 90, 0, 'verde');
select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000e'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000e'),
  'inconcluso', 'El snapshot "antes" tiene 20 días de antigüedad (>7) al momento de la intervención → no comparable, inconcluso');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 13 — Sin ningún snapshot en la ventana "después" → inconcluso, sin
-- rellenar nada
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-00000000000f'::uuid, 'p-r7-sindespues@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000f', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 90, 90, 50, 0, 'verde');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-00000000000f'::uuid, null, 'motivacion_seguimiento', null, null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-00000000000f';
-- Sin ningún snapshot nuevo — el paciente quedó inactivo tras la intervención.
select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000f'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000f'),
  'inconcluso', 'Sin snapshots en la ventana de después → inconcluso, nunca se rellena silenciosamente');
select is(
  (select adherence_despues from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000f'),
  null, 'adherence_despues queda NULL — no se inventa un valor');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 14 — Cambio en el conjunto de dominios evaluables (entre antes y
-- después) → inconcluso, aunque ambas confianzas globales sean >=50%
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-00000000000d'::uuid, 'p-r7-dominios@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
-- Antes: nutrición Y entrenamiento aplicables (training_confidence no nulo).
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, training_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000d', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 60, 55, 58, 40, 0, 'amarillo');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-00000000000d'::uuid, null, 'motivacion_seguimiento', null, null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-00000000000d';
-- Después: el dominio de entrenamiento desapareció (training_confidence
-- NULL, ej. rutina desactivada) — la confianza global "sube" solo porque
-- hay un dominio menos que arrastre el promedio hacia abajo.
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, training_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-00000000000d', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 92, null, 92, 68, 0, 'verde');

select evaluar_resultado_intervencion(
  (select id from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000d'), '2026-01-15'::date);
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000d'),
  'inconcluso', 'El dominio de entrenamiento desapareció entre antes y después → inconcluso (no debe leerse como mejora real de datos)');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 15 — Integración con ejecutar_radar_diario: un error midiendo UNA
-- intervención no detiene la evaluación de otras
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-000000000010'::uuid, 'p-r7-batch-ok@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 90, 90, 40, 0, 'verde');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000010'::uuid, null, 'motivacion_seguimiento', null, null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000010';
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 85, 85, 60, 0, 'verde');

select tests.create_user('d0000000-0000-4000-8000-000000000011'::uuid, 'p-r7-batch-falla@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000090', '2025-12-30', 'v1.0', 90, 90, 40, 0, 'verde');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000011'::uuid, null, 'motivacion_seguimiento', null, null, null);
reset role;
update intervenciones set created_at = ('2026-01-01 12:00:00'::timestamp at time zone 'America/Mexico_City')
  where paciente_id = 'd0000000-0000-4000-8000-000000000011';
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000090', '2026-01-14', 'v1.0', 85, 85, 60, 0, 'verde');

-- ejecutar_radar_diario recorre TODOS los pacientes aprobados/activos
-- (incluidos los de los casos 1-14, ya evaluados) y llama a
-- calcular_radar_paciente para cada uno con p_fecha='2026-01-15' —
-- insertaría un snapshot REAL (datos vacíos, radar_started_at nulo) para
-- esa fecha en cualquier paciente aprobado/activo, incluidos estos dos, lo
-- que contaminaría justo la ventana "después" que ya armamos a mano. Se
-- desactivan (is_active=false) para excluirlos del PRIMER loop — el
-- SEGUNDO loop (evaluación de intervenciones) no filtra por is_active, así
-- que sus intervenciones pendientes se siguen evaluando con normalidad.
update perfiles set is_active = false where id in (
  'd0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000011'
);

-- Falla inyectada deliberadamente (mismo mecanismo ya usado en radar.sql/
-- radar_ejecuciones.sql) — dispara solo cuando la intervención de
-- "p-r7-batch-falla" intenta salir de 'pendiente'.
create or replace function public._test_fallar_evaluar_r7()
returns trigger language plpgsql as $$
begin
  if new.paciente_id = 'd0000000-0000-4000-8000-000000000011' and new.resultado_estado <> 'pendiente' then
    raise exception 'Falla inyectada deliberadamente para probar aislamiento de errores en evaluar_resultado_intervencion (R7).';
  end if;
  return new;
end;
$$;
create trigger trg_test_fallar_r7 before update on intervenciones
  for each row execute function public._test_fallar_evaluar_r7();

select lives_ok(
  $$ select ejecutar_radar_diario('2026-01-15'::date) $$,
  'ejecutar_radar_diario no falla aunque una intervención individual sí falle al evaluarse');
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000010'),
  'mejoro', 'La intervención SIN falla inyectada sí se evaluó correctamente en el mismo batch');
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-000000000011'),
  'pendiente', 'La intervención con la falla inyectada queda intacta (su UPDATE se revirtió) — no queda en un estado corrupto');
select is(
  (select count(*)::int from radar_ejecucion_errores
     where paciente_id = 'd0000000-0000-4000-8000-000000000011' and mensaje_error like 'INTERVENCION %'),
  1, 'Se registró el error aislado con el prefijo INTERVENCION en radar_ejecucion_errores');

drop trigger trg_test_fallar_r7 on intervenciones;
drop function public._test_fallar_evaluar_r7();

-- ══════════════════════════════════════════════════════════════════════
-- Caso 16 — Observabilidad: _radar_ejecutar_con_observabilidad puebla
-- intervenciones_evaluadas / intervenciones_con_error
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('d0000000-0000-4000-8000-000000000012'::uuid, 'p-r7-observ@test.local', 'usuario', 'd0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000090', current_date - 45, 'v1.0', 90, 90, 40, 0, 'verde');
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select registrar_intervencion_radar('d0000000-0000-4000-8000-000000000012'::uuid, null, 'motivacion_seguimiento', null, null, null);
reset role;
-- Se retrocede exactamente 30 días (bien pasada la ventana de 14) usando
-- el ahora REAL, para que _radar_ejecutar_con_observabilidad (que fija su
-- propia fecha con now()) la encuentre ya cerrada al correr con la fecha real de hoy.
update intervenciones set created_at = now() - interval '30 days'
  where paciente_id = 'd0000000-0000-4000-8000-000000000012';
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('d0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000090', current_date - 20, 'v1.0', 85, 85, 60, 0, 'verde');

select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select throws_ok(
  $$ select radar_ejecutar_manual() $$,
  null, null, 'Un nutriólogo (no superadmin) no puede ejecutar Radar manualmente');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- RLS — inmutabilidad del resultado
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('d0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select lives_ok(
  $$ update intervenciones set resultado_estado = 'mejoro' where paciente_id = 'd0000000-0000-4000-8000-00000000000f' $$,
  'Un UPDATE directo del resultado no lanza error (RLS lo filtra a 0 filas en silencio)');
reset role;
select is(
  (select resultado_estado from intervenciones where paciente_id = 'd0000000-0000-4000-8000-00000000000f'),
  'inconcluso', 'El intento directo de modificar resultado_estado vía UPDATE de cliente no tuvo ningún efecto — RLS lo sigue impidiendo');

select * from finish();
rollback;
