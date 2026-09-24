-- Pruebas de Perfil profesional de nutriólogos (Sección 83 de
-- supabase_schema.sql, Fase A). Cubre nutriologo_perfiles, especialidades,
-- las tablas hijas (servicios/certificaciones/experiencia/consultorios/
-- disponibilidad), las vistas públicas, el storage privado de
-- certificaciones, y patient_nutritionists (solo lectura en esta fase).
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(49);

-- ── Fixtures ─────────────────────────────────────────────────────────
select tests.create_user('c0000000-0000-4000-8000-000000000001'::uuid, 'nutri-a@test.local', 'admin');
select tests.create_user('c0000000-0000-4000-8000-000000000002'::uuid, 'nutri-b@test.local', 'admin');
select tests.create_user('c0000000-0000-4000-8000-000000000003'::uuid, 'superadmin-np@test.local', 'superadmin');
select tests.create_user('c0000000-0000-4000-8000-000000000004'::uuid, 'paciente-a@test.local', 'usuario', 'c0000000-0000-4000-8000-000000000001'::uuid, true, 'aprobado');
select tests.create_user('c0000000-0000-4000-8000-000000000005'::uuid, 'paciente-suelto@test.local', 'usuario', 'c0000000-0000-4000-8000-000000000002'::uuid, true, 'aprobado');

-- ══════════════════════════════════════════════════════════════════════
-- especialidades — catálogo compartido (molde suplementos)
-- ══════════════════════════════════════════════════════════════════════

-- 1. Cualquier authenticated puede leer el catálogo (incluido un paciente).
select tests.authenticate_as('c0000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from especialidades), '>=', 12,
  'Un paciente puede leer el catálogo de especialidades (>=12 sembradas)');
reset role;

-- 2. Un paciente NO puede insertar una especialidad nueva.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into especialidades (nombre) values ('Especialidad falsa') $$,
  '42501', null, 'Un paciente no puede insertar en especialidades');
reset role;

-- 3. Un nutriólogo (admin) SÍ puede insertar una especialidad.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into especialidades (nombre) values ('Especialidad de prueba') $$,
  'Un nutriólogo (admin) puede insertar en especialidades');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- nutriologo_perfiles — 1:1, RLS de dueño/superadmin, columnas protegidas
-- ══════════════════════════════════════════════════════════════════════

-- 4. Nutriólogo A crea su propio perfil profesional.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into nutriologo_perfiles (perfil_id, titulo_profesional, perfil_visible)
     values ('c0000000-0000-4000-8000-000000000001', 'Lic. en Nutrición', true) $$,
  'Nutriólogo A puede crear su propio nutriologo_perfiles');
reset role;

-- 5. Nutriólogo B crea el suyo, NO visible.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000002'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into nutriologo_perfiles (perfil_id, titulo_profesional, perfil_visible)
     values ('c0000000-0000-4000-8000-000000000002', 'Nutrióloga Clínica', false) $$,
  'Nutriólogo B puede crear el suyo (perfil_visible=false)');
reset role;

-- 6. El trigger set_updated_at existe y está activo sobre nutriologo_perfiles.
--    (No se compara updated_at contra created_at tras un UPDATE real porque
--    now() es constante dentro de una misma transacción en Postgres — y
--    pgTAP envuelve todo este archivo en una sola transacción — así que
--    ambas columnas siempre coincidirían aquí sin importar si el trigger
--    corrió o no; esta es la forma correcta de probarlo en este contexto.)
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
update nutriologo_perfiles set titulo_profesional = 'Lic. en Nutrición Clínica' where perfil_id = 'c0000000-0000-4000-8000-000000000001';
reset role;
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'trg_nutriologo_perfiles_updated_at'
      and tgrelid = 'nutriologo_perfiles'::regclass
      and not tgisinternal
  ),
  'trg_nutriologo_perfiles_updated_at existe y está activo sobre nutriologo_perfiles');

-- 7. Nutriólogo A NO puede editar el perfil de Nutriólogo B (RLS de fila:
--    0 filas afectadas, sin excepción).
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update nutriologo_perfiles set titulo_profesional = 'Hackeado'
    where perfil_id = 'c0000000-0000-4000-8000-000000000002'
  returning 1
)
select is((select count(*)::int from actualizado), 0, 'Nutriólogo A no puede editar el perfil de Nutriólogo B');
reset role;

-- 8. Nutriólogo A NO puede marcarse verificado a sí mismo.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update nutriologo_perfiles set verificado = true where perfil_id = 'c0000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Nutriólogo A no puede cambiar su propio verificado');
reset role;

-- 9. Tampoco puede tocar destacado.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update nutriologo_perfiles set destacado = true where perfil_id = 'c0000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Nutriólogo A no puede cambiar su propio destacado');
reset role;

-- 10. Tampoco orden_directorio.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update nutriologo_perfiles set orden_directorio = 1 where perfil_id = 'c0000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Nutriólogo A no puede cambiar su propio orden_directorio');
reset role;

-- 11. Superadmin SÍ puede marcar verificado/destacado/orden_directorio.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update nutriologo_perfiles set verificado = true, destacado = true, orden_directorio = 1
     where perfil_id = 'c0000000-0000-4000-8000-000000000001' $$,
  'Superadmin sí puede modificar verificado/destacado/orden_directorio');
reset role;
select is(
  (select verificado from nutriologo_perfiles where perfil_id = 'c0000000-0000-4000-8000-000000000001'),
  true, 'verificado quedó en true tras el cambio de superadmin');

-- 12. Un paciente NO ve ninguna fila de la tabla base nutriologo_perfiles.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from nutriologo_perfiles), 0,
  'Un paciente no ve ninguna fila de la tabla base nutriologo_perfiles');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Validaciones / constraints reales en Postgres
-- ══════════════════════════════════════════════════════════════════════

-- 13. anio_egreso futuro rechazado.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000002'::uuid);
set local role authenticated;
select throws_ok(
  $$ update nutriologo_perfiles set anio_egreso = extract(year from now())::int + 1
     where perfil_id = 'c0000000-0000-4000-8000-000000000002' $$,
  '23514', null, 'anio_egreso futuro es rechazado por constraint');

-- 14. URL de red social sin esquema http(s) rechazada.
select throws_ok(
  $$ update nutriologo_perfiles set instagram_url = 'instagram.com/algo'
     where perfil_id = 'c0000000-0000-4000-8000-000000000002' $$,
  '23514', null, 'instagram_url sin esquema http(s) es rechazada');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- nutriologo_especialidades — junction
-- ══════════════════════════════════════════════════════════════════════

-- 15. Nutriólogo A se asigna una especialidad real.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into nutriologo_especialidades (nutriologo_id, especialidad_id)
     select 'c0000000-0000-4000-8000-000000000001', id from especialidades where nombre = 'Nutrición clínica' $$,
  'Nutriólogo A puede asignarse una especialidad');
reset role;

-- 16. Nutriólogo B NO puede asignar una especialidad a Nutriólogo A.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000002'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into nutriologo_especialidades (nutriologo_id, especialidad_id)
     select 'c0000000-0000-4000-8000-000000000001', id from especialidades where nombre = 'Diabetes' $$,
  '42501', null, 'Nutriólogo B no puede asignar una especialidad a Nutriólogo A');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- nutriologo_servicios — precio/duración/modalidad
-- ══════════════════════════════════════════════════════════════════════

-- 17. Servicio válido se crea sin problema.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into nutriologo_servicios (nutriologo_id, nombre, precio, modalidad, duracion_min, incluye)
     values ('c0000000-0000-4000-8000-000000000001', 'Primera consulta', 700, 'ambas', 60,
             array['Evaluación inicial', 'Plan nutricional']) $$,
  'Servicio válido se crea correctamente');

-- 18. Precio negativo rechazado.
select throws_ok(
  $$ insert into nutriologo_servicios (nutriologo_id, nombre, precio, modalidad)
     values ('c0000000-0000-4000-8000-000000000001', 'Servicio inválido', -100, 'online') $$,
  '23514', null, 'Precio negativo es rechazado por constraint');

-- 19. Duración <= 0 rechazada.
select throws_ok(
  $$ insert into nutriologo_servicios (nutriologo_id, nombre, precio, modalidad, duracion_min)
     values ('c0000000-0000-4000-8000-000000000001', 'Servicio inválido', 100, 'online', 0) $$,
  '23514', null, 'duracion_min = 0 es rechazada por constraint');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- nutriologo_experiencia — fechas coherentes
-- ══════════════════════════════════════════════════════════════════════

select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;

-- 20. fecha_fin anterior a fecha_inicio rechazada.
select throws_ok(
  $$ insert into nutriologo_experiencia (nutriologo_id, puesto, institucion, fecha_inicio, fecha_fin)
     values ('c0000000-0000-4000-8000-000000000001', 'Nutrióloga', 'Clínica X', '2024-01-01', '2023-01-01') $$,
  '23514', null, 'fecha_fin anterior a fecha_inicio es rechazada');

-- 21. actualidad=true con fecha_fin no nula rechazada.
select throws_ok(
  $$ insert into nutriologo_experiencia (nutriologo_id, puesto, institucion, actualidad, fecha_fin)
     values ('c0000000-0000-4000-8000-000000000001', 'Nutrióloga', 'Clínica X', true, '2024-01-01') $$,
  '23514', null, 'actualidad=true con fecha_fin no nula es rechazada');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- nutriologo_consultorios — lat/long
-- ══════════════════════════════════════════════════════════════════════

select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;

-- 22. Latitud fuera de rango rechazada.
select throws_ok(
  $$ insert into nutriologo_consultorios (nutriologo_id, direccion, latitud, longitud)
     values ('c0000000-0000-4000-8000-000000000001', 'Calle Falsa 123', 200, 0) $$,
  '23514', null, 'Latitud fuera de rango [-90,90] es rechazada');

-- 23. Longitud fuera de rango rechazada.
select throws_ok(
  $$ insert into nutriologo_consultorios (nutriologo_id, direccion, latitud, longitud)
     values ('c0000000-0000-4000-8000-000000000001', 'Calle Falsa 123', 0, 200) $$,
  '23514', null, 'Longitud fuera de rango [-180,180] es rechazada');

-- 24. Consultorio válido se crea sin problema.
select lives_ok(
  $$ insert into nutriologo_consultorios (nutriologo_id, nombre, direccion, ciudad, estado, latitud, longitud)
     values ('c0000000-0000-4000-8000-000000000001', 'Consultorio Centro', 'Calle Falsa 123', 'CDMX', 'CDMX', 19.4326, -99.1332) $$,
  'Consultorio válido se crea correctamente');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- nutriologo_disponibilidad — hora_inicio < hora_fin
-- ══════════════════════════════════════════════════════════════════════

select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;

-- 25. hora_inicio >= hora_fin rechazada cuando disponible=true.
select throws_ok(
  $$ insert into nutriologo_disponibilidad (nutriologo_id, dia_semana, disponible, hora_inicio, hora_fin)
     values ('c0000000-0000-4000-8000-000000000001', 1, true, '18:00', '09:00') $$,
  '23514', null, 'hora_inicio >= hora_fin es rechazada cuando disponible=true');

-- 26. Día no disponible no requiere horas.
select lives_ok(
  $$ insert into nutriologo_disponibilidad (nutriologo_id, dia_semana, disponible)
     values ('c0000000-0000-4000-8000-000000000001', 3, false) $$,
  'Día marcado no disponible no requiere hora_inicio/hora_fin');

-- 27. Día disponible con horas correctas se crea sin problema.
select lives_ok(
  $$ insert into nutriologo_disponibilidad (nutriologo_id, dia_semana, disponible, hora_inicio, hora_fin)
     values ('c0000000-0000-4000-8000-000000000001', 1, true, '09:00', '18:00') $$,
  'Día disponible con horas correctas se crea correctamente');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Vistas públicas — superficie mínima, solo perfil_visible=true
-- ══════════════════════════════════════════════════════════════════════

-- 28. El paciente ve a Nutriólogo A (perfil_visible=true) en el directorio.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from nutriologos_directorio_publico where id = 'c0000000-0000-4000-8000-000000000001'),
  1, 'El paciente ve a Nutriólogo A (perfil_visible=true) en el directorio público');

-- 29. El paciente NO ve a Nutriólogo B (perfil_visible=false).
select is(
  (select count(*)::int from nutriologos_directorio_publico where id = 'c0000000-0000-4000-8000-000000000002'),
  0, 'El paciente NO ve a Nutriólogo B (perfil_visible=false) en el directorio público');

-- 30. precio_desde refleja el mínimo de servicios activos (700 sembrado arriba).
select is(
  (select precio_desde from nutriologos_directorio_publico where id = 'c0000000-0000-4000-8000-000000000001'),
  700::numeric(10,2), 'precio_desde refleja el precio mínimo de servicios activos');

-- 31. especialidades viene agregado como array con al menos "Nutrición clínica".
select ok(
  (select 'Nutrición clínica' = any(especialidades) from nutriologos_directorio_publico where id = 'c0000000-0000-4000-8000-000000000001'),
  'especialidades del directorio incluye "Nutrición clínica"');

-- 32. La vista de directorio NO expone correo_profesional ni telefono_profesional
--     (columnas ni siquiera existen en la vista — falla en tiempo de parseo).
select throws_ok(
  $$ select correo_profesional from nutriologos_directorio_publico limit 1 $$,
  '42703', null, 'nutriologos_directorio_publico no expone correo_profesional (columna no existe en la vista)');
select throws_ok(
  $$ select telefono_profesional from nutriologos_directorio_publico limit 1 $$,
  '42703', null, 'nutriologos_directorio_publico no expone telefono_profesional (columna no existe en la vista)');
reset role;

-- 33. Certificación de Nutriólogo A: el paciente ve nombre/institución/año/
--     descripción vía la vista pública, pero la vista NUNCA expone el
--     documento (columna inexistente en la vista).
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
insert into nutriologo_certificaciones (nutriologo_id, nombre, institucion, anio, documento_url, documento_storage_path)
values ('c0000000-0000-4000-8000-000000000001', 'Diplomado en Nutrición Deportiva', 'UNAM', 2022,
        'https://example.test/doc.pdf', 'c0000000-0000-4000-8000-000000000001/doc.pdf');
reset role;

select tests.authenticate_as('c0000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from nutriologo_certificaciones_publico where nutriologo_id = 'c0000000-0000-4000-8000-000000000001' and nombre = 'Diplomado en Nutrición Deportiva'),
  1, 'El paciente ve la certificación pública de Nutriólogo A');
select throws_ok(
  $$ select documento_url from nutriologo_certificaciones_publico limit 1 $$,
  '42703', null, 'nutriologo_certificaciones_publico no expone documento_url (columna no existe en la vista)');
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Storage — certificaciones-nutriologos es PRIVADO
-- ══════════════════════════════════════════════════════════════════════

-- 34. El bucket certificaciones-nutriologos NO es público.
select is(
  (select public from storage.buckets where id = 'certificaciones-nutriologos'),
  false, 'El bucket certificaciones-nutriologos se creó como privado (public=false)');

-- 35. Los 4 buckets preexistentes siguen siendo públicos (nada se rompió).
select is(
  (select count(*)::int from storage.buckets where id in ('avatars','videos-ejercicios','recetas-fotos','exercise-gifs') and public = true),
  4, 'Los 4 buckets preexistentes siguen públicos, sin cambios');

-- ══════════════════════════════════════════════════════════════════════
-- patient_nutritionists — solo lectura en esta fase
-- ══════════════════════════════════════════════════════════════════════

-- 36. El paciente ve su propia fila (poblada por el backfill si existía
--     nutricionista_id al momento del reset; si no, simplemente 0 filas —
--     se prueba la policy, no el backfill en sí).
select tests.authenticate_as('c0000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select lives_ok(
  $$ select * from patient_nutritionists where paciente_id = 'c0000000-0000-4000-8000-000000000004' $$,
  'El paciente puede consultar patient_nutritionists filtrado a sí mismo, sin error');
reset role;

-- 37. Sin policy de INSERT: ni el propio paciente puede escribir.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into patient_nutritionists (paciente_id, nutriologo_id, estado)
     values ('c0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'activo') $$,
  '42501', null, 'Nadie puede insertar en patient_nutritionists desde el cliente todavía (sin policy de INSERT)');
reset role;

-- 38. Insertar manualmente (como postgres, fuera de RLS) para probar
--     visibilidad cruzada nutriólogo/paciente ajeno.
insert into patient_nutritionists (paciente_id, nutriologo_id, estado, asignado_por)
values ('c0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'activo', 'c0000000-0000-4000-8000-000000000002');

-- 39. El nutriólogo dueño (B) ve la asignación de su paciente.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000002'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from patient_nutritionists where paciente_id = 'c0000000-0000-4000-8000-000000000005'),
  1, 'Nutriólogo B ve la asignación activa de su paciente en patient_nutritionists');
reset role;

-- 40. Un paciente ajeno (paciente-a, de otro nutriólogo) NO ve esa fila.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select is(
  (select count(*)::int from patient_nutritionists where paciente_id = 'c0000000-0000-4000-8000-000000000005'),
  0, 'Un paciente ajeno no ve la asignación de otro paciente en patient_nutritionists');
reset role;

-- 41. Superadmin ve todo.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from patient_nutritionists), '>=', 1,
  'Superadmin ve filas de patient_nutritionists sin restricción');
reset role;

-- 42. Como máximo una fila 'activo' por paciente (índice único parcial).
select throws_ok(
  $$ insert into patient_nutritionists (paciente_id, nutriologo_id, estado)
     values ('c0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'activo') $$,
  '23505', null, 'No se puede insertar una segunda fila activo para el mismo paciente (índice único parcial)');

-- ══════════════════════════════════════════════════════════════════════
-- Confirmación de que nada existente se rompió
-- ══════════════════════════════════════════════════════════════════════

-- 43. nutricionistas_publicos (Sección 56, usada por mobile-app register.tsx)
--     sigue intacta y funcionando igual.
select is(
  (select count(*)::int from information_schema.columns
     where table_schema = 'public' and table_name = 'nutricionistas_publicos'),
  4, 'nutricionistas_publicos conserva exactamente sus 4 columnas originales');

-- 44. perfiles.nutricionista_id sigue siendo editable solo por superadmin
--     (trigger de la Sección 82, sin cambios).
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ update perfiles set nutricionista_id = 'c0000000-0000-4000-8000-000000000002'
     where id = 'c0000000-0000-4000-8000-000000000004' $$,
  'P0001', null, 'perfiles.nutricionista_id sigue protegido igual que antes de esta migración (Sección 82 intacta)');
reset role;

-- 45. especialidades: DELETE también restringido a admin/superadmin.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
with borrado as (
  delete from especialidades where nombre = 'Especialidad de prueba' returning 1
)
select is((select count(*)::int from borrado), 0, 'Un paciente no puede borrar una especialidad (0 filas afectadas)');
reset role;

-- 47. Certificaciones: solo el dueño o superadmin pueden borrar.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000002'::uuid);
set local role authenticated;
with borrado as (
  delete from nutriologo_certificaciones where nutriologo_id = 'c0000000-0000-4000-8000-000000000001' returning 1
)
select is((select count(*)::int from borrado), 0, 'Nutriólogo B no puede borrar una certificación de Nutriólogo A');
reset role;

-- 48. Superadmin sí puede borrar cualquier certificación.
select tests.authenticate_as('c0000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from nutriologo_certificaciones where nutriologo_id = 'c0000000-0000-4000-8000-000000000001' returning 1
)
select is((select count(*)::int from borrado), 1, 'Superadmin sí puede borrar una certificación de cualquier nutriólogo');
reset role;

select * from finish();
rollback;
