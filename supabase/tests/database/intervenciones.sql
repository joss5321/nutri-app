-- Pruebas de MyFitTrack Radar — intervenciones (Sección 80 de
-- supabase_schema.sql, R6). Cubre registrar_intervencion_radar() y el RLS
-- de la tabla intervenciones.
--
-- Los fixtures de score_snapshots/radar_alertas se insertan directamente
-- (sin correr calcular_radar_paciente) porque este archivo prueba
-- exclusivamente el flujo de intervención sobre una alerta/snapshot ya
-- existente, no el motor de cálculo — ese motor ya está cubierto por
-- radar.sql. "Hoy" es la fecha real (now()) porque
-- registrar_intervencion_radar usa now()/CURRENT_DATE internamente, igual
-- que resolver_alerta_radar (ver radar.sql, Caso 10).
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(53);

-- ── Nutriólogos ──────────────────────────────────────────────────────
select tests.create_user('b0000000-0000-4000-8000-000000000090'::uuid, 'nutri-dueno-int@test.local', 'admin');
select tests.create_user('b0000000-0000-4000-8000-000000000091'::uuid, 'nutri-ajeno-int@test.local', 'admin');
select tests.create_user('b0000000-0000-4000-8000-000000000092'::uuid, 'superadmin-int@test.local', 'superadmin');

-- ── Pacientes ────────────────────────────────────────────────────────
-- Paciente A: tiene snapshot reciente + una alerta abierta (caso principal).
select tests.create_user('b0000000-0000-4000-8000-000000000001'::uuid, 'p-int-a@test.local', 'usuario', 'b0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, riesgo_confirmado_puntos, estado)
values ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000090', current_date, 'v1.0', 70, 70, 50, 30, 'rojo');
insert into radar_alertas (paciente_id, nutriologo_id, regla_principal, tier, fecha_apertura, ultima_fecha_evaluada, rules_version)
values ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000090', 'RADAR_R3_CAIDA_ADHERENCIA', 'alta', current_date, current_date, 'v1.0');

-- Paciente B: SIN ningún snapshot todavía (para probar snapshot "antes" NULL).
select tests.create_user('b0000000-0000-4000-8000-000000000002'::uuid, 'p-int-b@test.local', 'usuario', 'b0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');

-- Paciente D: para el caso de nutriólogo ajeno.
select tests.create_user('b0000000-0000-4000-8000-000000000004'::uuid, 'p-int-d@test.local', 'usuario', 'b0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into radar_alertas (paciente_id, nutriologo_id, regla_principal, tier, fecha_apertura, ultima_fecha_evaluada, rules_version)
values ('b0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000090', 'RADAR_R2_CITA_SIN_CONFIRMAR', 'media', current_date, current_date, 'v1.0');

-- Paciente E: alerta de un tipo distinto, usada para el caso "segundo
-- intento sobre alerta ya resuelta".
select tests.create_user('b0000000-0000-4000-8000-000000000005'::uuid, 'p-int-e@test.local', 'usuario', 'b0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into radar_alertas (paciente_id, nutriologo_id, regla_principal, tier, fecha_apertura, ultima_fecha_evaluada, rules_version)
values ('b0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000090', 'RADAR_R2_CITA_SIN_CONFIRMAR', 'media', current_date, current_date, 'v1.0');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 1 — Nutriólogo dueño registra una intervención ligada a una alerta
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select lives_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000001'::uuid,
       (select id from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000001' and estado_alerta = 'abierta'),
       'contacto', 'whatsapp', 'Hablé con ella por WhatsApp', null
     ) $$,
  'El nutriólogo dueño puede registrar una intervención sobre su paciente');
reset role;

select is(
  (select count(*)::int from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  1, 'Se creó exactamente una intervención');

select is(
  (select nutriologo_id from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  'b0000000-0000-4000-8000-000000000090'::uuid,
  'nutriologo_id se toma de auth.uid(), nunca de un parámetro del frontend');

select is(
  (select tipo from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  'contacto', 'tipo guardado correctamente');

select is(
  (select subtipo from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  'whatsapp', 'subtipo guardado correctamente');

select is(
  (select nota from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  'Hablé con ella por WhatsApp', 'nota guardada correctamente');

select is(
  (select resultado_estado from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  'pendiente', 'resultado_estado inicia en pendiente (R7 no calcula nada todavía)');

-- Snapshot "antes" congelado.
select is(
  (select adherence_antes from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  50::numeric(5,2), 'adherence_antes congela el snapshot vigente al momento de intervenir');

select is(
  (select risk_points_antes from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  30, 'risk_points_antes congela riesgo_confirmado_puntos');

select is(
  (select confianza_antes from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  70::numeric(5,2), 'confianza_antes congela data_confidence_global');

select isnt(
  (select snapshot_id from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  null, 'snapshot_id queda ligado al snapshot real, no reconstruido después');

select is(
  (select rules_version from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  'v1.0', 'rules_version congelado desde el snapshot');

-- La alerta quedó resuelta atómicamente.
select is(
  (select estado_alerta from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  'resuelta', 'La alerta pasó a resuelta junto con el registro de la intervención');

select is(
  (select motivo_resolucion from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  'intervencion', 'motivo_resolucion queda como intervencion');

select is(
  (select intervention_id from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  (select id from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  'radar_alertas.intervention_id apunta a la intervención recién creada');

select is(
  (select cooldown_until - fecha_resolucion from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  14, 'La alerta entra en cooldown de 14 días');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 2 — Nutriólogo ajeno NO puede registrar sobre un paciente que no
-- es suyo, aunque la alerta exista y esté abierta
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000091'::uuid);
set local role authenticated;
select throws_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000004'::uuid,
       (select id from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000004' and estado_alerta = 'abierta'),
       'contacto', 'llamada', null, null
     ) $$,
  null, null, 'Un nutriólogo ajeno no puede registrar una intervención sobre un paciente que no es suyo');
reset role;

select is(
  (select estado_alerta from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000004'),
  'abierta', 'La alerta del paciente ajeno sigue abierta tras el intento rechazado');

select is(
  (select count(*)::int from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000004'),
  0, 'No quedó ninguna intervención huérfana del intento rechazado');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 3 — El propio paciente no puede registrar intervenciones
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000001'::uuid, null, 'motivacion_seguimiento', null, null, null
     ) $$,
  null, null, 'Un paciente no puede registrar una intervención (ni siquiera sobre sí mismo)');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Caso 4 — Superadmin NO puede registrar sobre un paciente ajeno solo por
-- ser superadmin (corrección post-R6: una intervención es una acción
-- profesional real, no un privilegio administrativo). Superadmin SÍ puede
-- registrar cuando además es el nutricionista_id vigente del paciente —
-- exactamente la misma condición que cualquier otro nutriólogo.
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select throws_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000004'::uuid,
       (select id from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000004' and estado_alerta = 'abierta'),
       'reagendar_cita', null, null, null
     ) $$,
  null, null, 'Superadmin NO asignado no puede registrar una intervención solo por su rol');
reset role;

select is(
  (select count(*)::int from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000004'),
  0, 'El intento de superadmin no asignado no dejó ninguna intervención');

select is(
  (select estado_alerta from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000004'),
  'abierta', 'La alerta del paciente ajeno sigue abierta tras el intento rechazado de superadmin');

-- Paciente F: asignado directamente al superadmin (superadmin actuando
-- como el nutriólogo vigente) — debe poder registrar por esa relación,
-- igual que cualquier otro nutriólogo dueño.
select tests.create_user('b0000000-0000-4000-8000-000000000006'::uuid, 'p-int-f@test.local', 'usuario', 'b0000000-0000-4000-8000-000000000092'::uuid, true, 'aprobado');
insert into radar_alertas (paciente_id, nutriologo_id, regla_principal, tier, fecha_apertura, ultima_fecha_evaluada, rules_version)
values ('b0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000092', 'RADAR_R2_CITA_SIN_CONFIRMAR', 'media', current_date, current_date, 'v1.0');

select tests.authenticate_as('b0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select lives_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000006'::uuid,
       (select id from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000006' and estado_alerta = 'abierta'),
       'reagendar_cita', null, null, null
     ) $$,
  'Superadmin SÍ puede registrar sobre un paciente donde él mismo es el nutricionista_id vigente');
reset role;

select is(
  (select nutriologo_id from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000006'),
  'b0000000-0000-4000-8000-000000000092'::uuid,
  'La intervención queda atribuida al superadmin actuando como nutriólogo asignado');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 5 — Intervención SIN alerta (desde RadarTab, sin seleccionar una
-- alerta puntual) — permitida, no se fuerza una alerta ficticia
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select lives_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000002'::uuid, null, 'motivacion_seguimiento', null, 'Seguimiento general', null
     ) $$,
  'Se permite registrar una intervención sin alerta_id (flujo desde RadarTab)');
reset role;

select is(
  (select alerta_id from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000002'),
  null, 'alerta_id queda NULL cuando no se liga a una alerta puntual');

-- Paciente B no tiene ningún snapshot: el snapshot "antes" queda NULL sin
-- que la función falle.
select is(
  (select adherence_antes from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000002'),
  null, 'Sin snapshot previo, adherence_antes queda NULL (no se inventa un snapshot ficticio)');

select is(
  (select snapshot_id from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000002'),
  null, 'Sin snapshot previo, snapshot_id queda NULL');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 6 — "Sin acción" exige motivo válido; una intervención normal lo
-- prohíbe
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select throws_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000002'::uuid, null, 'sin_accion', null, null, null
     ) $$,
  null, null, 'sin_accion exige motivo_sin_accion (rechaza NULL)');

select throws_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000002'::uuid, null, 'sin_accion', null, null, 'motivo_inventado'
     ) $$,
  null, null, 'sin_accion rechaza un motivo_sin_accion fuera del catálogo');

select throws_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000002'::uuid, null, 'contacto', 'llamada', null, 'ya_hable_recientemente'
     ) $$,
  null, null, 'Una intervención normal (no sin_accion) prohíbe motivo_sin_accion');

select lives_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000002'::uuid, null, 'sin_accion', null, 'No lo vi relevante hoy', 'no_relevante'
     ) $$,
  'sin_accion con motivo válido se registra correctamente');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Caso 7 — "Sin acción" también resuelve la alerta si viene ligada a una
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select lives_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000005'::uuid,
       (select id from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000005' and estado_alerta = 'abierta'),
       'sin_accion', null, null, 'esperare_consulta'
     ) $$,
  'sin_accion ligado a una alerta se registra correctamente');
reset role;

select is(
  (select estado_alerta from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000005'),
  'resuelta', 'sin_accion también resuelve la alerta');

select is(
  (select motivo_resolucion from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000005'),
  'sin_accion', 'motivo_resolucion queda como sin_accion (distinguible de intervencion)');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 8 — Segundo intento sobre una alerta ya resuelta: falla limpiamente
-- y NO genera una segunda intervención (prueba real de atomicidad: el
-- INSERT ya se ejecutó dentro de la función antes de que el UPDATE
-- fallara, y aun así queda revertido)
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select throws_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000005'::uuid,
       (select id from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000005'),
       'contacto', 'llamada', null, null
     ) $$,
  null, null, 'Un segundo intento sobre la misma alerta ya resuelta falla en vez de crear otra intervención');
reset role;

select is(
  (select count(*)::int from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000005'),
  1, 'Atomicidad confirmada: el intento fallido no dejó una segunda intervención huérfana');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 9 — Validaciones de tipo/subtipo
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select throws_ok(
  $$ select registrar_intervencion_radar('b0000000-0000-4000-8000-000000000002'::uuid, null, 'tipo_inventado', null, null, null) $$,
  null, null, 'Un tipo fuera del catálogo es rechazado');

select throws_ok(
  $$ select registrar_intervencion_radar('b0000000-0000-4000-8000-000000000002'::uuid, null, 'contacto', 'cambio_ejercicios', null, null) $$,
  null, null, 'Un subtipo que no corresponde al tipo (mezcla de categorías) es rechazado');

select throws_ok(
  $$ select registrar_intervencion_radar('b0000000-0000-4000-8000-000000000002'::uuid, null, 'reagendar_cita', 'whatsapp', null, null) $$,
  null, null, 'Un tipo sin paso 2 (reagendar_cita) rechaza cualquier subtipo');

select lives_ok(
  $$ select registrar_intervencion_radar('b0000000-0000-4000-8000-000000000002'::uuid, null, 'ajuste_alimentacion', 'cambio_equivalentes', null, null) $$,
  'Un subtipo correctamente emparejado con su tipo se acepta');

select lives_ok(
  $$ select registrar_intervencion_radar('b0000000-0000-4000-8000-000000000002'::uuid, null, 'ajuste_rutina', null, null, null) $$,
  'subtipo es opcional: un tipo con paso 2 sin subtipo elegido también es válido');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 10 — La alerta debe pertenecer al paciente indicado
-- ══════════════════════════════════════════════════════════════════════
select throws_ok(
  $$ select registrar_intervencion_radar(
       'b0000000-0000-4000-8000-000000000002'::uuid,
       (select id from radar_alertas where paciente_id = 'b0000000-0000-4000-8000-000000000004'),
       'contacto', 'llamada', null, null
     ) $$,
  null, null, 'Una alerta que pertenece a OTRO paciente es rechazada aunque el nutriólogo sea dueño de ambos');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- RLS — inmutabilidad y visibilidad de intervenciones
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('b0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  1, 'Nutriólogo dueño ve las intervenciones de su paciente');
-- Sin policy de UPDATE/DELETE, RLS no lanza una excepción — simplemente no
-- hay ninguna fila visible para la operación (USING evalúa a falso para
-- todas), así que actualiza/borra 0 filas en silencio. La prueba real de
-- inmutabilidad es que el dato quede intacto después, no una excepción.
select lives_ok(
  $$ update intervenciones set nota = 'editado' where paciente_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'Un UPDATE directo no lanza error (RLS lo filtra a 0 filas en silencio)');
select isnt(
  (select nota from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  'editado', 'El UPDATE directo no modificó nada: intervenciones es inmutable sin policy de UPDATE');
select lives_ok(
  $$ delete from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'Un DELETE directo no lanza error (RLS lo filtra a 0 filas en silencio)');
select is(
  (select count(*)::int from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  1, 'El DELETE directo no borró nada: intervenciones no expone DELETE ni para el dueño');
select throws_ok(
  $$ insert into intervenciones (paciente_id, tipo) values ('b0000000-0000-4000-8000-000000000001', 'otra') $$,
  '42501', null, 'Nadie puede hacer INSERT directo sobre intervenciones (todo pasa por el RPC)');
reset role;

select tests.authenticate_as('b0000000-0000-4000-8000-000000000091'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  0, 'Nutriólogo ajeno NO ve las intervenciones de un paciente que no es suyo');
reset role;

select tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from intervenciones where paciente_id = 'b0000000-0000-4000-8000-000000000001'),
  0, 'El paciente NO ve sus propias intervenciones (cero acceso, como pide el alcance)');
reset role;

select tests.authenticate_as('b0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from intervenciones), '>=', 5,
  'Superadmin ve intervenciones de cualquier paciente');
reset role;

select * from finish();
rollback;
