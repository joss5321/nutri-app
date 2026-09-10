-- Pruebas de MyFitTrack Radar — motor de métricas (Sección 74 de
-- supabase_schema.sql, R4B). Cubre calcular_radar_paciente(),
-- resolver_alerta_radar(), ejecutar_radar_diario() y el RLS mínimo de
-- score_snapshots / radar_alertas.
--
-- "Hoy" para todas las pruebas es la fecha fija 2026-03-16 (lunes,
-- verificado por cálculo antes de usarlo — importa para R4/entrenamientos,
-- que depende de qué tan avanzada está la semana calendario). Fijar la
-- fecha en vez de usar CURRENT_DATE hace las pruebas 100% deterministas,
-- independientes de cuándo se ejecuten.
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(85);

-- ── Nutriólogos ──────────────────────────────────────────────────────
select tests.create_user('a0000000-0000-4000-8000-000000000090'::uuid, 'nutri-dueno@test.local', 'admin');
select tests.create_user('a0000000-0000-4000-8000-000000000091'::uuid, 'nutri-ajeno@test.local', 'admin');
select tests.create_user('a0000000-0000-4000-8000-000000000092'::uuid, 'superadmin-radar@test.local', 'superadmin');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 1 — Caída real de adherencia (R3) → 🔴, + idempotencia + alerta única
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('a0000000-0000-4000-8000-000000000001'::uuid, 'p-caida@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60, last_active_at = '2026-03-16'::timestamptz
  where id = 'a0000000-0000-4000-8000-000000000001';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000001', 'Definición', true);
-- Cita vieja y jamás confirmada, fuera de la ventana de R2 — únicamente
-- para romper la condición de asistencia de R9 y evitar que R9 suprima
-- la caída real que este caso quiere probar.
insert into citas (user_id, fecha, hora, tipo, estado) values ('a0000000-0000-4000-8000-000000000001', '2026-03-16'::date - 60, '10:00', 'Seguimiento', 'pendiente');
-- Baseline de 4 semanas ~80%, alta confianza.
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, estado)
values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 7, 'v1.0', 90, 90, 80, 'verde'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 14, 'v1.0', 90, 90, 80, 'verde'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 21, 'v1.0', 90, 90, 80, 'verde'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 28, 'v1.0', 90, 90, 80, 'verde');
-- Semana actual: adherencia baja, confianza suficiente.
insert into nutricion_checks (user_id, fecha, estado) values
  ('a0000000-0000-4000-8000-000000000001', '2026-03-16'::date, 'no_seguido'),
  ('a0000000-0000-4000-8000-000000000001', '2026-03-16'::date - 1, 'no_seguido'),
  ('a0000000-0000-4000-8000-000000000001', '2026-03-16'::date - 2, 'parcial'),
  ('a0000000-0000-4000-8000-000000000001', '2026-03-16'::date - 3, 'no_seguido'),
  ('a0000000-0000-4000-8000-000000000001', '2026-03-16'::date - 4, 'parcial'),
  ('a0000000-0000-4000-8000-000000000001', '2026-03-16'::date - 5, 'no_seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-000000000001'::uuid, '2026-03-16'::date);

select is(
  (select estado from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000001' and snapshot_date = '2026-03-16'::date),
  'rojo', 'Caída real de adherencia produce estado rojo');

select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000001' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA' and estado_alerta = 'abierta'),
  1, 'Se abre exactamente una alerta R3 (una sola alerta por problema)');

select is(
  (select rules_version from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000001' and snapshot_date = '2026-03-16'::date),
  'v1.0', 'El snapshot guarda rules_version');

-- Idempotencia: correr el cálculo del mismo día dos veces no duplica nada.
select calcular_radar_paciente('a0000000-0000-4000-8000-000000000001'::uuid, '2026-03-16'::date);

select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000001' and snapshot_date = '2026-03-16'::date),
  1, 'Idempotencia: reejecutar el mismo día no duplica el snapshot');

select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000001' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA' and estado_alerta = 'abierta'),
  1, 'Idempotencia: reejecutar el mismo día no duplica la alerta abierta');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 2 — Confianza actual baja (sin R1/R7) → 🟡 (cierre de consistencia #1)
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('a0000000-0000-4000-8000-000000000002'::uuid, 'p-confbaja@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60, last_active_at = '2026-03-16'::timestamptz
  where id = 'a0000000-0000-4000-8000-000000000002';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000002', 'Definición', true);
insert into nutricion_checks (user_id, fecha, estado) values ('a0000000-0000-4000-8000-000000000002', '2026-03-16'::date, 'seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-000000000002'::uuid, '2026-03-16'::date);

select is(
  (select estado from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000002' and snapshot_date = '2026-03-16'::date),
  'amarillo', 'Confianza global <50% produce amarillo aunque R1/R7 no disparen');

select is(
  (select senal_insuficiente from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000002' and snapshot_date = '2026-03-16'::date),
  false, 'El amarillo por confianza no implica que R1 o R7 hayan disparado');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 3 — Paciente nuevo (R8) → ⚪
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('a0000000-0000-4000-8000-000000000003'::uuid, 'p-nuevo@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 5 where id = 'a0000000-0000-4000-8000-000000000003';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000003', 'Definición', true);

select calcular_radar_paciente('a0000000-0000-4000-8000-000000000003'::uuid, '2026-03-16'::date);

select is(
  (select estado from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000003' and snapshot_date = '2026-03-16'::date),
  'blanco', 'Paciente con menos de 14 días desde radar_started_at queda en blanco');

-- Paciente aprobado pero sin ningún dominio asignado aún: blanco aunque
-- ya lleve más de 14 días.
select tests.create_user('a0000000-0000-4000-8000-000000000013'::uuid, 'p-nuevo-sindominio@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60 where id = 'a0000000-0000-4000-8000-000000000013';

select calcular_radar_paciente('a0000000-0000-4000-8000-000000000013'::uuid, '2026-03-16'::date);

select is(
  (select estado from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000013' and snapshot_date = '2026-03-16'::date),
  'blanco', 'Paciente aprobado sin rutina ni plan asignado queda en blanco aunque ya lleve >14 días');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 4 — Dominio no aplicable (sin rutina) no penaliza
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('a0000000-0000-4000-8000-000000000004'::uuid, 'p-sinrutina@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60, last_active_at = '2026-03-16'::timestamptz
  where id = 'a0000000-0000-4000-8000-000000000004';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000004', 'Definición', true);
insert into nutricion_checks (user_id, fecha, estado) values
  ('a0000000-0000-4000-8000-000000000004', '2026-03-16'::date, 'seguido'),
  ('a0000000-0000-4000-8000-000000000004', '2026-03-16'::date - 1, 'seguido'),
  ('a0000000-0000-4000-8000-000000000004', '2026-03-16'::date - 2, 'seguido'),
  ('a0000000-0000-4000-8000-000000000004', '2026-03-16'::date - 3, 'parcial'),
  ('a0000000-0000-4000-8000-000000000004', '2026-03-16'::date - 4, 'seguido'),
  ('a0000000-0000-4000-8000-000000000004', '2026-03-16'::date - 5, 'seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-000000000004'::uuid, '2026-03-16'::date);

select is(
  (select training_adherence from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000004' and snapshot_date = '2026-03-16'::date),
  null, 'Sin rutina: training_adherence es null, no cero');

select is(
  (select training_confidence from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000004' and snapshot_date = '2026-03-16'::date),
  null, 'Sin rutina: training_confidence es null, no cero');

select ok(
  (select adherence_global from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000004' and snapshot_date = '2026-03-16'::date) > 80,
  'Sin rutina: adherence_global refleja solo nutrición, no se diluye con un training fantasma en cero');

select is(
  (select estado from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000004' and snapshot_date = '2026-03-16'::date),
  'verde', 'Paciente sin rutina pero con buena nutrición = verde');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 5 — R9 estable suprime una caída real
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('a0000000-0000-4000-8000-000000000005'::uuid, 'p-estable@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60, last_active_at = '2026-03-16'::timestamptz
  where id = 'a0000000-0000-4000-8000-000000000005';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000005', 'Definición', true);
insert into citas (user_id, fecha, hora, tipo, estado) values
  ('a0000000-0000-4000-8000-000000000005', '2026-03-16'::date - 40, '10:00', 'Seguimiento', 'confirmada'),
  ('a0000000-0000-4000-8000-000000000005', '2026-03-16'::date - 70, '10:00', 'Seguimiento', 'confirmada');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, estado)
values
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 7, 'v1.0', 90, 90, 80, 'verde'),
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 14, 'v1.0', 90, 90, 80, 'verde'),
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 21, 'v1.0', 90, 90, 82, 'verde'),
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 28, 'v1.0', 90, 90, 79, 'verde');
insert into nutricion_checks (user_id, fecha, estado) values
  ('a0000000-0000-4000-8000-000000000005', '2026-03-16'::date, 'no_seguido'),
  ('a0000000-0000-4000-8000-000000000005', '2026-03-16'::date - 1, 'no_seguido'),
  ('a0000000-0000-4000-8000-000000000005', '2026-03-16'::date - 2, 'no_seguido'),
  ('a0000000-0000-4000-8000-000000000005', '2026-03-16'::date - 3, 'parcial'),
  ('a0000000-0000-4000-8000-000000000005', '2026-03-16'::date - 4, 'no_seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-000000000005'::uuid, '2026-03-16'::date);

select is(
  ((select reglas_disparadas from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000005' and snapshot_date = '2026-03-16'::date)
    -> 8 ->> 'activa')::boolean,
  true, 'R9 (estable) se marca activa con historial de baja varianza y buena asistencia a citas');

select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000005' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA' and estado_alerta = 'abierta'),
  0, 'R9 activo suprime la apertura de la alerta R3 pese a la caída real');

select isnt(
  (select estado from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000005' and snapshot_date = '2026-03-16'::date),
  'rojo', 'Con R9 activo el estado no llega a rojo por la caída suprimida');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 6 — Cita sin confirmar (R2) → 🟠, auto-resolución y recurrencia
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('a0000000-0000-4000-8000-000000000006'::uuid, 'p-cita@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60, last_active_at = '2026-03-16'::timestamptz
  where id = 'a0000000-0000-4000-8000-000000000006';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000006', 'Definición', true);
insert into nutricion_checks (user_id, fecha, estado) values
  ('a0000000-0000-4000-8000-000000000006', '2026-03-16'::date, 'seguido'),
  ('a0000000-0000-4000-8000-000000000006', '2026-03-16'::date - 1, 'seguido'),
  ('a0000000-0000-4000-8000-000000000006', '2026-03-16'::date - 2, 'seguido');
insert into citas (id, user_id, fecha, hora, tipo, estado) values
  ('a0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-000000000006', '2026-03-16'::date + 2, '10:00', 'Seguimiento', 'pendiente');

select calcular_radar_paciente('a0000000-0000-4000-8000-000000000006'::uuid, '2026-03-16'::date);

select is(
  (select estado from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000006' and snapshot_date = '2026-03-16'::date),
  'naranja', 'Cita pendiente ≤72h produce naranja, no rojo (cierre de consistencia #3)');

select is(
  (select tier from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000006' and regla_principal = 'RADAR_R2_CITA_SIN_CONFIRMAR' and estado_alerta = 'abierta'),
  'alta', 'La alerta R2 registra su propio tier interno independientemente del color mostrado');

-- Día siguiente: se confirma la cita → auto-resolución inmediata (R2 no
-- requiere 2 días de gracia).
update citas set estado = 'confirmada' where id = 'a0000000-0000-4000-8000-0000000000c1';
select calcular_radar_paciente('a0000000-0000-4000-8000-000000000006'::uuid, '2026-03-16'::date + 1);

select is(
  (select motivo_resolucion from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000006' and regla_principal = 'RADAR_R2_CITA_SIN_CONFIRMAR' and estado_alerta = 'resuelta' order by fecha_resolucion desc limit 1),
  'auto_resuelta', 'La cita confirmada auto-resuelve la alerta R2 sin esperar 2 días de gracia');

select is(
  (select cooldown_until from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000006' and regla_principal = 'RADAR_R2_CITA_SIN_CONFIRMAR' and estado_alerta = 'resuelta' order by fecha_resolucion desc limit 1),
  null, 'Una resolución automática (sin intervención) no aplica cooldown');

-- Unos días después: aparece una NUEVA cita pendiente → nueva alerta, con
-- recurrencia hacia la anterior (ya resuelta, dentro de los últimos 30 días).
insert into citas (user_id, fecha, hora, tipo, estado) values
  ('a0000000-0000-4000-8000-000000000006', '2026-03-16'::date + 5, '10:00', 'Seguimiento', 'pendiente');
select calcular_radar_paciente('a0000000-0000-4000-8000-000000000006'::uuid, '2026-03-16'::date + 3);

select is(
  (select recurrence_of is not null from radar_alertas
    where paciente_id = 'a0000000-0000-4000-8000-000000000006'
      and regla_principal = 'RADAR_R2_CITA_SIN_CONFIRMAR'
      and estado_alerta = 'abierta'),
  true, 'La nueva alerta R2 queda enlazada como recurrencia de la anterior resuelta');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 7 — Baseline insuficiente (solo 1 semana previa) → R3 no dispara
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('a0000000-0000-4000-8000-000000000007'::uuid, 'p-baseline@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60, last_active_at = '2026-03-16'::timestamptz
  where id = 'a0000000-0000-4000-8000-000000000007';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000007', 'Definición', true);
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, estado)
values ('a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 7, 'v1.0', 90, 90, 80, 'verde');
insert into nutricion_checks (user_id, fecha, estado) values
  ('a0000000-0000-4000-8000-000000000007', '2026-03-16'::date, 'no_seguido'),
  ('a0000000-0000-4000-8000-000000000007', '2026-03-16'::date - 1, 'no_seguido'),
  ('a0000000-0000-4000-8000-000000000007', '2026-03-16'::date - 2, 'parcial'),
  ('a0000000-0000-4000-8000-000000000007', '2026-03-16'::date - 3, 'no_seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-000000000007'::uuid, '2026-03-16'::date);

select is(
  ((select reglas_disparadas from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000007' and snapshot_date = '2026-03-16'::date)
    -> 2 ->> 'activa')::boolean,
  false, 'Con una sola semana previa válida (se requieren ≥2), R3 no se evalúa como disparada');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 8 — Patrón de día de semana con muestra insuficiente (2 semanas)
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('a0000000-0000-4000-8000-000000000008'::uuid, 'p-patroninsuf@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60, last_active_at = '2026-03-16'::timestamptz
  where id = 'a0000000-0000-4000-8000-000000000008';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000008', 'Definición', true);
-- Sábados 2026-03-14 y 2026-03-07 (2 semanas ISO distintas) con no_seguido.
insert into nutricion_checks (user_id, fecha, estado) values
  ('a0000000-0000-4000-8000-000000000008', '2026-03-14'::date, 'no_seguido'),
  ('a0000000-0000-4000-8000-000000000008', '2026-03-07'::date, 'no_seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-000000000008'::uuid, '2026-03-16'::date);

select is(
  ((select reglas_disparadas from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000008' and snapshot_date = '2026-03-16'::date)
    -> 5 ->> 'activa')::boolean,
  false, 'Patrón de día de semana con solo 2 semanas distintas no dispara (se requieren ≥3)');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 9 — Patrón de día de semana válido (3 semanas distintas)
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('a0000000-0000-4000-8000-000000000009'::uuid, 'p-patronok@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60, last_active_at = '2026-03-16'::timestamptz
  where id = 'a0000000-0000-4000-8000-000000000009';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000009', 'Definición', true);
-- Sábados 2026-03-14, 2026-03-07 y 2026-02-28 (3 semanas ISO distintas).
insert into nutricion_checks (user_id, fecha, estado) values
  ('a0000000-0000-4000-8000-000000000009', '2026-03-14'::date, 'no_seguido'),
  ('a0000000-0000-4000-8000-000000000009', '2026-03-07'::date, 'no_seguido'),
  ('a0000000-0000-4000-8000-000000000009', '2026-02-28'::date, 'no_seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-000000000009'::uuid, '2026-03-16'::date);

select is(
  ((select reglas_disparadas from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000009' and snapshot_date = '2026-03-16'::date)
    -> 5 ->> 'activa')::boolean,
  true, 'Patrón de día de semana con 3 semanas distintas sí dispara');

select is(
  ((select reglas_disparadas from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000009' and snapshot_date = '2026-03-16'::date)
    -> 5 ->> 'dia')::int,
  6, 'El patrón detectado corresponde a sábado (dow=6)');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 10 — Cooldown: una alerta resuelta por intervención no reabre
-- durante los 14 días siguientes aunque la condición cruda se repita.
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('a0000000-0000-4000-8000-00000000000a'::uuid, 'p-cooldown@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60, last_active_at = '2026-03-16'::timestamptz
  where id = 'a0000000-0000-4000-8000-00000000000a';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-00000000000a', 'Definición', true);
insert into citas (user_id, fecha, hora, tipo, estado) values ('a0000000-0000-4000-8000-00000000000a', '2026-03-16'::date - 60, '10:00', 'Seguimiento', 'pendiente');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, estado)
values
  ('a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 7, 'v1.0', 90, 90, 85, 'verde'),
  ('a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 14, 'v1.0', 90, 90, 85, 'verde'),
  ('a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 21, 'v1.0', 90, 90, 85, 'verde');
insert into nutricion_checks (user_id, fecha, estado) values
  ('a0000000-0000-4000-8000-00000000000a', '2026-03-16'::date, 'no_seguido'),
  ('a0000000-0000-4000-8000-00000000000a', '2026-03-16'::date - 1, 'no_seguido'),
  ('a0000000-0000-4000-8000-00000000000a', '2026-03-16'::date - 2, 'parcial'),
  ('a0000000-0000-4000-8000-00000000000a', '2026-03-16'::date - 3, 'no_seguido'),
  ('a0000000-0000-4000-8000-00000000000a', '2026-03-16'::date - 4, 'no_seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-00000000000a'::uuid, '2026-03-16'::date);

select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000a' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA' and estado_alerta = 'abierta'),
  1, 'Caída real abre la alerta R3 (caso cooldown, antes de resolver)');

-- El nutriólogo resuelve la alerta como intervención (14 días de cooldown).
select tests.authenticate_as('a0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select lives_ok(
  $$ select resolver_alerta_radar(
       (select id from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000a' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA' and estado_alerta = 'abierta'),
       'intervencion'
     ) $$,
  'El nutriólogo dueño puede resolver la alerta de su paciente');
reset role;

-- resolver_alerta_radar usa el now() real (una intervención se resuelve en
-- el momento real en que ocurre, no en la fecha ficticia simulada por las
-- demás pruebas de este archivo) — se compara el OFFSET contra
-- fecha_resolucion, nunca una fecha absoluta ligada a "hoy" de la
-- simulación.
select is(
  (select cooldown_until - fecha_resolucion from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000a' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA' order by fecha_resolucion desc limit 1),
  14, 'Resolver por intervención fija un cooldown de 14 días después de la fecha de resolución real');

-- Una semana después la condición cruda se repite (baseline vuelve a
-- encontrar 3 semanas válidas de ~85% más el snapshot real de "hoy" con
-- adherencia baja, y la nutrición sigue mal) — pero sigue dentro del
-- cooldown, así que NO debe abrirse una alerta nueva.
insert into nutricion_checks (user_id, fecha, estado) values
  ('a0000000-0000-4000-8000-00000000000a', '2026-03-16'::date + 7, 'no_seguido'),
  ('a0000000-0000-4000-8000-00000000000a', '2026-03-16'::date + 6, 'no_seguido'),
  ('a0000000-0000-4000-8000-00000000000a', '2026-03-16'::date + 5, 'parcial'),
  ('a0000000-0000-4000-8000-00000000000a', '2026-03-16'::date + 4, 'no_seguido'),
  ('a0000000-0000-4000-8000-00000000000a', '2026-03-16'::date + 3, 'no_seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-00000000000a'::uuid, '2026-03-16'::date + 7);

select is(
  ((select reglas_disparadas from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-00000000000a' and snapshot_date = '2026-03-16'::date + 7)
    -> 2 ->> 'activa')::boolean,
  true, 'La condición cruda de R3 vuelve a cumplirse (transparencia: se sigue reportando)');

select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000a' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA' and estado_alerta = 'abierta'),
  0, 'Pero en cooldown NO se abre una nueva alerta R3');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 11 — Histéresis: la alerta R3 no se resuelve por un solo día bueno
-- ══════════════════════════════════════════════════════════════════════
select tests.create_user('a0000000-0000-4000-8000-00000000000b'::uuid, 'p-histeresis@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60, last_active_at = '2026-03-16'::timestamptz
  where id = 'a0000000-0000-4000-8000-00000000000b';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-00000000000b', 'Definición', true);
insert into citas (user_id, fecha, hora, tipo, estado) values ('a0000000-0000-4000-8000-00000000000b', '2026-03-16'::date - 60, '10:00', 'Seguimiento', 'pendiente');
insert into score_snapshots (paciente_id, nutriologo_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, adherence_global, estado)
values
  ('a0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 7, 'v1.0', 90, 90, 80, 'verde'),
  ('a0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000090', '2026-03-16'::date - 14, 'v1.0', 90, 90, 80, 'verde');
insert into nutricion_checks (user_id, fecha, estado) values
  ('a0000000-0000-4000-8000-00000000000b', '2026-03-16'::date, 'no_seguido'),
  ('a0000000-0000-4000-8000-00000000000b', '2026-03-16'::date - 1, 'no_seguido'),
  ('a0000000-0000-4000-8000-00000000000b', '2026-03-16'::date - 2, 'parcial'),
  ('a0000000-0000-4000-8000-00000000000b', '2026-03-16'::date - 3, 'no_seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-00000000000b'::uuid, '2026-03-16'::date);

select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000b' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA' and estado_alerta = 'abierta'),
  1, 'Histéresis: la caída real abre la alerta R3 el día 1');

-- Día 2: al desplazarse la ventana de baseline (hoy+1-7, ..., hoy+1-28) ya
-- no coincide con ningún snapshot fijo de este fixture → baseline
-- insuficiente → la condición cruda de R3 se vuelve falsa. Sirve para
-- probar el mecanismo de histéresis en sí (1 día de gracia) sin necesitar
-- construir una "recuperación" real de adherencia.
select calcular_radar_paciente('a0000000-0000-4000-8000-00000000000b'::uuid, '2026-03-16'::date + 1);

select is(
  (select estado_alerta from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000b' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA'),
  'abierta', 'Histéresis: la alerta sigue abierta tras un solo día sin la condición (día de gracia)');

select is(
  (select dias_condicion_ausente from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000b' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA'),
  1, 'Histéresis: se contabilizó 1 día de ausencia de la condición');

select is(
  (select estado from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-00000000000b' and snapshot_date = '2026-03-16'::date + 1),
  'rojo', 'Histéresis: el estado se mantiene rojo durante el día de gracia');

-- Día 3: segundo día consecutivo sin la condición → ahora sí se resuelve.
select calcular_radar_paciente('a0000000-0000-4000-8000-00000000000b'::uuid, '2026-03-16'::date + 2);

select is(
  (select estado_alerta from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000b' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA'),
  'resuelta', 'Histéresis: al segundo día consecutivo sin la condición, la alerta se resuelve');

select is(
  (select motivo_resolucion from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000b' and regla_principal = 'RADAR_R3_CAIDA_ADHERENCIA'),
  'auto_resuelta', 'La resolución por histéresis queda registrada como auto_resuelta');

-- ══════════════════════════════════════════════════════════════════════
-- Caso 12 — Entrenamientos omitidos (R4) → 🔴
-- ══════════════════════════════════════════════════════════════════════
-- Semana calendario del 2026-03-16 (lunes) al 2026-03-22 (domingo); se
-- evalúa el domingo para que training_confidence sea 100% (semana
-- completa transcurrida).
select tests.create_user('a0000000-0000-4000-8000-00000000000c'::uuid, 'p-r4@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60, last_active_at = '2026-03-22'::timestamptz
  where id = 'a0000000-0000-4000-8000-00000000000c';
insert into rutinas (id, user_id, nombre, activa) values ('a0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-00000000000c', 'Rutina R4', true);
insert into rutina_dias (id, rutina_id, numero_dia, nombre_dia, es_descanso) values
  ('a0000000-0000-4000-8000-0000000000d2', 'a0000000-0000-4000-8000-0000000000d1', 1, 'Día 1', false),
  ('a0000000-0000-4000-8000-0000000000d3', 'a0000000-0000-4000-8000-0000000000d1', 2, 'Día 2', false),
  ('a0000000-0000-4000-8000-0000000000d4', 'a0000000-0000-4000-8000-0000000000d1', 3, 'Día 3', false),
  ('a0000000-0000-4000-8000-0000000000d5', 'a0000000-0000-4000-8000-0000000000d1', 4, 'Día 4', false),
  ('a0000000-0000-4000-8000-0000000000d6', 'a0000000-0000-4000-8000-0000000000d1', 5, 'Descanso', true);
insert into dias_completados (user_id, dia_id, fecha) values
  ('a0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-0000000000d2', '2026-03-18'::date);
insert into nutricion_checks (user_id, fecha, estado) values
  ('a0000000-0000-4000-8000-00000000000c', '2026-03-22'::date, 'seguido'),
  ('a0000000-0000-4000-8000-00000000000c', '2026-03-21'::date, 'seguido'),
  ('a0000000-0000-4000-8000-00000000000c', '2026-03-20'::date, 'seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-00000000000c'::uuid, '2026-03-22'::date);

select is(
  (select training_adherence from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-00000000000c' and snapshot_date = '2026-03-22'::date),
  25.00, '1 de 4 sesiones completadas en la semana = 25% de adherencia de entrenamiento');

select is(
  (select estado from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-00000000000c' and snapshot_date = '2026-03-22'::date),
  'rojo', 'Entrenamientos omitidos con confianza suficiente produce rojo (R4)');

select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000c' and regla_principal = 'RADAR_R4_ENTRENAMIENTOS_OMITIDOS' and estado_alerta = 'abierta'),
  1, 'Se abre la alerta R4');

-- ══════════════════════════════════════════════════════════════════════
-- ejecutar_radar_diario(): corre el lote sin explotar y calcula a todos
-- los pacientes aprobados.
-- ══════════════════════════════════════════════════════════════════════
-- Se usa una fecha posterior a todas las evaluaciones ya realizadas en
-- este archivo (la más tardía es 2026-03-23, caso cooldown) — nunca una
-- anterior: llamar calcular_radar_paciente "hacia atrás" después de que
-- una alerta ya avanzó a un estado más reciente reabriría alertas ya
-- resueltas por accidente de orden de ejecución, no por diseño real.
select lives_ok(
  $$ select ejecutar_radar_diario('2026-04-01'::date) $$,
  'ejecutar_radar_diario corre sobre todos los pacientes aprobados sin error');

select ok(
  (select count(*)::int from score_snapshots where snapshot_date = '2026-04-01'::date) >= 10,
  'ejecutar_radar_diario generó snapshots para el lote de pacientes aprobados');

-- ══════════════════════════════════════════════════════════════════════
-- RLS mínimo — score_snapshots / radar_alertas: solo nutriólogo dueño y
-- superadmin, nunca el propio paciente, nunca un nutriólogo ajeno.
-- ══════════════════════════════════════════════════════════════════════
select tests.authenticate_as('a0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000001'),
  -- 4 filas de baseline insertadas como fixture + 1 calculada el "hoy" de
  -- la simulación (idempotente pese a 2 corridas) + 1 de ejecutar_radar_diario.
  6, 'Nutriólogo dueño ve los score_snapshots calculados de su paciente');
reset role;

select tests.authenticate_as('a0000000-0000-4000-8000-000000000091'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000001'),
  0, 'Nutriólogo ajeno NO ve los score_snapshots de un paciente que no es suyo');
reset role;

select tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000001'),
  0, 'El propio paciente todavía NO ve sus score_snapshots (sin dashboard/traducción todavía)');
select throws_ok(
  $$ insert into score_snapshots (paciente_id, snapshot_date, rules_version, nutrition_confidence, data_confidence_global, estado)
     values ('a0000000-0000-4000-8000-000000000001', '2099-01-01', 'v1.0', 0, 0, 'verde') $$,
  '42501', null, 'Ningún cliente puede insertar directamente en score_snapshots (sin policy de INSERT)');
reset role;

select tests.authenticate_as('a0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000001'),
  6, 'Superadmin ve los score_snapshots de cualquier paciente');
select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000001'),
  1, 'Superadmin ve las radar_alertas de cualquier paciente');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Casos de la auditoría de seguridad previa a R5 (Sección 75)
-- ══════════════════════════════════════════════════════════════════════

-- Caso 13 — Bypass NULL-safe en resolver_alerta_radar: paciente sin
-- nutriólogo asignado (nutricionista_id NULL, ej. el nutriólogo original
-- fue eliminado). Un nutriólogo NO relacionado, ni superadmin, no debe
-- poder resolver su alerta.
select tests.create_user('a0000000-0000-4000-8000-00000000000d'::uuid, 'p-nulowner@test.local', 'usuario', null::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60 where id = 'a0000000-0000-4000-8000-00000000000d';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-00000000000d', 'Definición', true);
insert into citas (user_id, fecha, hora, tipo, estado) values ('a0000000-0000-4000-8000-00000000000d', '2026-03-16'::date + 1, '10:00', 'Seguimiento', 'pendiente');

select calcular_radar_paciente('a0000000-0000-4000-8000-00000000000d'::uuid, '2026-03-16'::date);

select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-00000000000d'),
  1, 'calcular_radar_paciente no falla con un paciente sin nutriólogo asignado (nutricionista_id NULL)');

select is(
  (select nutriologo_id from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000d' and regla_principal = 'RADAR_R2_CITA_SIN_CONFIRMAR'),
  null, 'La alerta hereda nutriologo_id NULL del paciente sin nutriólogo asignado');

-- Se captura el id real en una tabla temporal (sin RLS) para poder
-- referenciarlo después de cambiar de rol — un nutriólogo ajeno no podría
-- verlo vía SELECT normal (RLS), pero eso no debe ser lo único que lo
-- detenga: la función misma debe rechazarlo.
create temp table tmp_alerta_nulowner as
  select id from radar_alertas
    where paciente_id = 'a0000000-0000-4000-8000-00000000000d'
      and regla_principal = 'RADAR_R2_CITA_SIN_CONFIRMAR' and estado_alerta = 'abierta';
-- Una tabla temporal no tiene RLS, pero SÍ requiere GRANT explícito para
-- que el rol "authenticated" (usado tras set local role) pueda leerla.
grant select on tmp_alerta_nulowner to authenticated;

select tests.authenticate_as('a0000000-0000-4000-8000-000000000091'::uuid);
set local role authenticated;
select throws_ok(
  $$ select resolver_alerta_radar((select id from tmp_alerta_nulowner), 'intervencion') $$,
  null, null, 'Sin nutriólogo asignado, un nutriólogo NO relacionado no puede resolver la alerta (fix del bypass NULL)');
reset role;

select tests.authenticate_as('a0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select lives_ok(
  $$ select resolver_alerta_radar((select id from tmp_alerta_nulowner), 'intervencion') $$,
  'Superadmin sí puede resolver la alerta de un paciente sin nutriólogo asignado');
reset role;

select is(
  (select estado_alerta from radar_alertas where id = (select id from tmp_alerta_nulowner)),
  'resuelta', 'La alerta quedó resuelta por el superadmin');

-- resolver_alerta_radar ya no acepta 'auto_resuelta' de un caller humano.
select tests.create_user('a0000000-0000-4000-8000-00000000000e'::uuid, 'p-motivo@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60 where id = 'a0000000-0000-4000-8000-00000000000e';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-00000000000e', 'Definición', true);
insert into citas (user_id, fecha, hora, tipo, estado) values ('a0000000-0000-4000-8000-00000000000e', '2026-03-16'::date + 1, '10:00', 'Seguimiento', 'pendiente');
select calcular_radar_paciente('a0000000-0000-4000-8000-00000000000e'::uuid, '2026-03-16'::date);

select tests.authenticate_as('a0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select throws_ok(
  $$ select resolver_alerta_radar(
       (select id from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000e' and estado_alerta = 'abierta'),
       'auto_resuelta'
     ) $$,
  null, null, 'Un caller humano ya no puede resolver con motivo auto_resuelta (reservado al motor)');
reset role;

-- Caso 14 — Carrera resuelta por resolver_alerta_radar: una segunda
-- resolución de la misma alerta (ya sea secuencial o, en producción,
-- concurrente tras el fix del UPDATE con "and estado_alerta='abierta'")
-- debe fallar en vez de pisar en silencio la resolución anterior.
select tests.authenticate_as('a0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select lives_ok(
  $$ select resolver_alerta_radar(
       (select id from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000e' and estado_alerta = 'abierta'),
       'intervencion'
     ) $$,
  'Primera resolución de la alerta: exitosa');
select throws_ok(
  $$ select resolver_alerta_radar(
       (select id from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000e' and regla_principal = 'RADAR_R2_CITA_SIN_CONFIRMAR' order by created_at desc limit 1),
       'intervencion'
     ) $$,
  null, null, 'Segunda resolución de la misma alerta ya resuelta: falla en vez de pisar la primera');
reset role;

-- Caso 15 — ON CONFLICT en _radar_gestionar_alerta: no se puede simular
-- una carrera real de dos transacciones concurrentes dentro de un único
-- archivo pgTAP (una sola conexión, secuencial). Esta prueba verifica en
-- su lugar, de forma aislada, que un segundo INSERT contra el mismo
-- índice único parcial — la condición exacta que produciría una carrera
-- real perdida — no lanza unique_violation gracias al ON CONFLICT que
-- ahora usa la función.
select tests.create_user('a0000000-0000-4000-8000-00000000000f'::uuid, 'p-race@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
insert into radar_alertas (paciente_id, nutriologo_id, regla_principal, tier, fecha_apertura, ultima_fecha_evaluada, rules_version)
values ('a0000000-0000-4000-8000-00000000000f', 'a0000000-0000-4000-8000-000000000090', 'RADAR_R2_CITA_SIN_CONFIRMAR', 'alta', '2026-03-16', '2026-03-16', 'v1.0');

select lives_ok(
  $$ insert into radar_alertas (paciente_id, nutriologo_id, regla_principal, tier, fecha_apertura, ultima_fecha_evaluada, rules_version)
     values ('a0000000-0000-4000-8000-00000000000f', 'a0000000-0000-4000-8000-000000000090', 'RADAR_R2_CITA_SIN_CONFIRMAR', 'alta', '2026-03-16', '2026-03-16', 'v1.0')
     on conflict (paciente_id, regla_principal) where estado_alerta = 'abierta' do nothing $$,
  'Un INSERT que perdería la carrera real no lanza unique_violation gracias a ON CONFLICT');

select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000f' and regla_principal = 'RADAR_R2_CITA_SIN_CONFIRMAR' and estado_alerta = 'abierta'),
  1, 'Sigue existiendo exactamente una alerta abierta pese al intento duplicado');

-- Caso 16 — Una regla reabre correctamente DESPUÉS de que su cooldown ya
-- expiró (los tests previos solo cubrían "sigue bloqueada DURANTE el
-- cooldown").
select tests.create_user('a0000000-0000-4000-8000-000000000010'::uuid, 'p-cooldownexp@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60 where id = 'a0000000-0000-4000-8000-000000000010';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000010', 'Definición', true);
insert into citas (user_id, fecha, hora, tipo, estado) values ('a0000000-0000-4000-8000-000000000010', '2026-03-16'::date + 1, '10:00', 'Seguimiento', 'pendiente');
select calcular_radar_paciente('a0000000-0000-4000-8000-000000000010'::uuid, '2026-03-16'::date);

select tests.authenticate_as('a0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select resolver_alerta_radar(
  (select id from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000010' and estado_alerta = 'abierta'),
  'intervencion');
reset role;

-- Se fuerza que el cooldown ya haya expirado (simula el paso de más de 14
-- días reales desde la resolución), sin depender del reloj real de la
-- máquina donde corre la prueba.
update radar_alertas set cooldown_until = '2020-01-01'::date
  where paciente_id = 'a0000000-0000-4000-8000-000000000010' and regla_principal = 'RADAR_R2_CITA_SIN_CONFIRMAR';

insert into citas (user_id, fecha, hora, tipo, estado) values ('a0000000-0000-4000-8000-000000000010', '2026-03-20'::date, '10:00', 'Seguimiento', 'pendiente');
select calcular_radar_paciente('a0000000-0000-4000-8000-000000000010'::uuid, '2026-03-17'::date);

select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000010' and regla_principal = 'RADAR_R2_CITA_SIN_CONFIRMAR' and estado_alerta = 'abierta'),
  1, 'Tras expirar el cooldown, la regla puede volver a abrir una alerta nueva');

select is(
  (select recurrence_of is not null from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000010' and regla_principal = 'RADAR_R2_CITA_SIN_CONFIRMAR' and estado_alerta = 'abierta'),
  true, 'La nueva alerta post-cooldown queda enlazada como recurrencia de la anterior');

-- Caso 17 — Paciente desactivado (is_active=false, estatus sigue
-- 'aprobado') ya no acumula snapshots ni alertas.
select tests.create_user('a0000000-0000-4000-8000-000000000011'::uuid, 'p-inactivo@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, false, 'aprobado');
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000011', 'Definición', true);
insert into nutricion_checks (user_id, fecha, estado) values ('a0000000-0000-4000-8000-000000000011', '2026-03-16'::date, 'no_seguido');

select calcular_radar_paciente('a0000000-0000-4000-8000-000000000011'::uuid, '2026-03-16'::date);

select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000011'),
  0, 'calcular_radar_paciente no genera snapshot para un paciente desactivado (is_active=false)');

-- Fecha posterior a TODAS las evaluaciones anteriores de este archivo
-- (incluida la corrida de ejecutar_radar_diario a 2026-04-01) — nunca una
-- anterior, por la misma razón documentada en el caso del lote más arriba.
select lives_ok(
  $$ select ejecutar_radar_diario('2026-04-02'::date) $$,
  'ejecutar_radar_diario corre sin error con un paciente desactivado en el lote');

select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000011'),
  0, 'ejecutar_radar_diario tampoco genera snapshot para el paciente desactivado');

-- ══════════════════════════════════════════════════════════════════════
-- Segunda ronda de correcciones (Sección 76)
-- ══════════════════════════════════════════════════════════════════════

-- Caso 19 — resolver_alerta_radar acepta 'sin_accion' (el nutriólogo
-- revisó la alerta y decidió explícitamente no intervenir) con el mismo
-- cooldown que 'intervencion'.
select tests.create_user('a0000000-0000-4000-8000-000000000014'::uuid, 'p-sinaccion@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60 where id = 'a0000000-0000-4000-8000-000000000014';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000014', 'Definición', true);
insert into citas (user_id, fecha, hora, tipo, estado) values ('a0000000-0000-4000-8000-000000000014', '2026-03-16'::date + 1, '10:00', 'Seguimiento', 'pendiente');
select calcular_radar_paciente('a0000000-0000-4000-8000-000000000014'::uuid, '2026-03-16'::date);

select tests.authenticate_as('a0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select lives_ok(
  $$ select resolver_alerta_radar(
       (select id from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000014' and estado_alerta = 'abierta'),
       'sin_accion'
     ) $$,
  'resolver_alerta_radar acepta motivo sin_accion');
reset role;

select is(
  (select motivo_resolucion from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000014'),
  'sin_accion', 'El motivo queda registrado como sin_accion');

select is(
  (select cooldown_until from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000014'),
  (select fecha_resolucion + 14 from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000014'),
  'sin_accion recibe el mismo cooldown de 14 días que intervencion (decisión documentada, no inventada)');

-- Caso 20 — rechaza NULL y texto vacío como motivo.
select tests.create_user('a0000000-0000-4000-8000-000000000015'::uuid, 'p-nullmotivo@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60 where id = 'a0000000-0000-4000-8000-000000000015';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000015', 'Definición', true);
insert into citas (user_id, fecha, hora, tipo, estado) values ('a0000000-0000-4000-8000-000000000015', '2026-03-16'::date + 1, '10:00', 'Seguimiento', 'pendiente');
select calcular_radar_paciente('a0000000-0000-4000-8000-000000000015'::uuid, '2026-03-16'::date);

select tests.authenticate_as('a0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select throws_ok(
  $$ select resolver_alerta_radar(
       (select id from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000015' and estado_alerta = 'abierta'),
       null
     ) $$,
  null, null, 'resolver_alerta_radar rechaza motivo NULL (chequeo NULL-safe explícito, no "<>")');
select throws_ok(
  $$ select resolver_alerta_radar(
       (select id from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000015' and estado_alerta = 'abierta'),
       ''
     ) $$,
  null, null, 'resolver_alerta_radar rechaza motivo de texto vacío');
reset role;

select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000015' and estado_alerta = 'abierta'),
  1, 'La alerta sigue abierta e intacta tras los dos intentos rechazados');

-- Caso 21 — una segunda resolución (ya resuelta) no altera motivo, fecha
-- ni cooldown originales.
select tests.create_user('a0000000-0000-4000-8000-000000000016'::uuid, 'p-unaltered@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60 where id = 'a0000000-0000-4000-8000-000000000016';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000016', 'Definición', true);
insert into citas (user_id, fecha, hora, tipo, estado) values ('a0000000-0000-4000-8000-000000000016', '2026-03-16'::date + 1, '10:00', 'Seguimiento', 'pendiente');
select calcular_radar_paciente('a0000000-0000-4000-8000-000000000016'::uuid, '2026-03-16'::date);

select tests.authenticate_as('a0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select resolver_alerta_radar(
  (select id from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000016' and estado_alerta = 'abierta'),
  'intervencion');
reset role;

create temp table tmp_original_16 as
  select motivo_resolucion, fecha_resolucion, cooldown_until from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000016';
grant select on tmp_original_16 to authenticated;

select tests.authenticate_as('a0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select throws_ok(
  $$ select resolver_alerta_radar(
       (select id from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000016' order by created_at desc limit 1),
       'sin_accion'
     ) $$,
  null, null, 'Segunda resolución sobre una alerta ya resuelta falla');
reset role;

select is(
  (select motivo_resolucion from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000016'),
  (select motivo_resolucion from tmp_original_16),
  'motivo_resolucion no cambió tras el intento fallido');
select is(
  (select fecha_resolucion from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000016'),
  (select fecha_resolucion from tmp_original_16),
  'fecha_resolucion no cambió tras el intento fallido');
select is(
  (select cooldown_until from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-000000000016'),
  (select cooldown_until from tmp_original_16),
  'cooldown_until no cambió tras el intento fallido');

-- Caso 22 — snapshot/alerta de un paciente huérfano (sin nutriólogo)
-- visibles SOLO para superadmin (extiende el Caso 13 con la verificación
-- RLS directa que faltaba).
select tests.authenticate_as('a0000000-0000-4000-8000-000000000091'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-00000000000d'),
  0, 'Nutriólogo ajeno no ve el score_snapshot del paciente huérfano');
select is(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000d'),
  0, 'Nutriólogo ajeno no ve las radar_alertas del paciente huérfano');
reset role;

select tests.authenticate_as('a0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-00000000000d'),
  -- 1 del cálculo individual del Caso 13 + 1 del lote ejecutar_radar_diario('2026-04-01') que corre más arriba.
  2, 'Superadmin sí ve el score_snapshot del paciente huérfano');
select ok(
  (select count(*)::int from radar_alertas where paciente_id = 'a0000000-0000-4000-8000-00000000000d') >= 1,
  'Superadmin sí ve las radar_alertas del paciente huérfano');
reset role;

-- Caso 23 — aislamiento de errores del lote + registro durable. Se
-- inyecta una falla determinista (sin tocar el código real de
-- calcular_radar_paciente) mediante un trigger temporal que falla
-- EXCLUSIVAMENTE para el paciente de prueba "P_ROTO" — así se puede
-- probar de forma reproducible que el fallo de un paciente no revierte
-- el resultado ya exitoso de otro, sin depender de encontrar un bug real
-- para forzarlo.
create or replace function public._test_fallar_para_prueba_radar()
returns trigger language plpgsql as $$
begin
  if new.paciente_id = 'a0000000-0000-4000-8000-000000000012' then
    raise exception 'Falla inyectada deliberadamente para la prueba de aislamiento de errores.';
  end if;
  return new;
end;
$$;

create trigger trg_test_fallar_radar
  before insert on score_snapshots
  for each row execute function public._test_fallar_para_prueba_radar();

select tests.create_user('a0000000-0000-4000-8000-000000000012'::uuid, 'p-roto@test.local', 'usuario', 'a0000000-0000-4000-8000-000000000090'::uuid, true, 'aprobado');
update perfiles set radar_started_at = '2026-03-16'::date - 60 where id = 'a0000000-0000-4000-8000-000000000012';
insert into planes_nutricionales (user_id, objetivo, activo) values ('a0000000-0000-4000-8000-000000000012', 'Definición', true);
insert into nutricion_checks (user_id, fecha, estado) values ('a0000000-0000-4000-8000-000000000012', '2026-03-16'::date, 'seguido');

-- Fecha nueva, posterior a todo lo demás en este archivo — ejecutar_radar_diario
-- procesará a P_ROTO junto con el resto del lote (incluye a P_SINRUTINA,
-- paciente sano, para comprobar que SÍ tiene éxito pese al fallo ajeno).
select lives_ok(
  $$ select ejecutar_radar_diario('2026-04-03'::date) $$,
  'ejecutar_radar_diario no propaga la falla de un paciente al resto del lote');

select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000012' and snapshot_date = '2026-04-03'::date),
  0, 'El paciente cuya escritura falló no tiene snapshot para esa fecha (su subtransacción se revirtió)');

select is(
  (select count(*)::int from score_snapshots where paciente_id = 'a0000000-0000-4000-8000-000000000004' and snapshot_date = '2026-04-03'::date),
  1, 'Otro paciente del mismo lote sí tiene su snapshot — el fallo ajeno no revirtió su resultado');

select is(
  (select count(*)::int from radar_ejecucion_errores where paciente_id = 'a0000000-0000-4000-8000-000000000012' and fecha_ejecucion = '2026-04-03'::date),
  1, 'El error del paciente roto quedó registrado en radar_ejecucion_errores');

select ok(
  (select mensaje_error from radar_ejecucion_errores where paciente_id = 'a0000000-0000-4000-8000-000000000012' and fecha_ejecucion = '2026-04-03'::date) like '%inyectada deliberadamente%',
  'El mensaje de error registrado corresponde a la falla real capturada, no a un texto genérico');

drop trigger if exists trg_test_fallar_radar on score_snapshots;
drop function if exists public._test_fallar_para_prueba_radar();

-- Caso 24 — RLS de radar_ejecucion_errores: solo superadmin lee, nadie
-- inserta directamente (ni siquiera superadmin — solo el motor).
select tests.authenticate_as('a0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from radar_ejecucion_errores where paciente_id = 'a0000000-0000-4000-8000-000000000012'),
  0, 'El nutriólogo dueño del paciente NO puede leer radar_ejecucion_errores (solo superadmin)');
reset role;

select tests.authenticate_as('a0000000-0000-4000-8000-000000000092'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from radar_ejecucion_errores where paciente_id = 'a0000000-0000-4000-8000-000000000012'),
  1, 'Superadmin sí puede leer radar_ejecucion_errores');
select throws_ok(
  $$ insert into radar_ejecucion_errores (paciente_id, fecha_ejecucion) values ('a0000000-0000-4000-8000-000000000012', '2026-01-01') $$,
  '42501', null, 'Ni siquiera superadmin puede insertar directamente en radar_ejecucion_errores (sin policy de INSERT, solo el motor SECURITY DEFINER)');
reset role;

-- Caso 25 — permisos efectivos de _radar_gestionar_alerta: EXECUTE
-- revocado de public/authenticated (hallazgo 6 de la auditoría).
select tests.authenticate_as('a0000000-0000-4000-8000-000000000090'::uuid);
set local role authenticated;
select throws_ok(
  $$ select public._radar_gestionar_alerta('a0000000-0000-4000-8000-000000000001'::uuid, null, 'FAKE_REGLA_DE_PRUEBA', 'baja', true, false, '2026-01-01'::date, 'v1.0', '{}'::jsonb) $$,
  '42501', null, 'EXECUTE en _radar_gestionar_alerta está revocado de public/authenticated');
reset role;

select * from finish();
rollback;
