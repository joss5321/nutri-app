-- Pruebas RLS de public.rutinas, public.rutina_dias, public.rutina_ejercicios
-- y public.dias_completados (Secciones 48 y 68 de supabase_schema.sql).
-- Cobertura completa de la matriz de permisos: paciente propio/ajeno, admin
-- dueño/ajeno, superadmin — para cada comando realmente otorgado.
--
-- Fixtures 100% sintéticos, creados y descartados dentro de esta misma
-- transacción (BEGIN ... ROLLBACK) — nunca se commitea nada.

begin;
select plan(70);

-- ── Fixtures sintéticos ──────────────────────────────────────────────
select tests.create_user('30000000-0000-4000-8000-000000000003'::uuid, 'admin-a@test.local',    'admin');
select tests.create_user('30000000-0000-4000-8000-000000000004'::uuid, 'admin-b@test.local',    'admin');
select tests.create_user('30000000-0000-4000-8000-000000000005'::uuid, 'superadmin@test.local', 'superadmin');
select tests.create_user('30000000-0000-4000-8000-000000000001'::uuid, 'paciente-a@test.local', 'usuario', '30000000-0000-4000-8000-000000000003'::uuid, true, 'aprobado');
select tests.create_user('30000000-0000-4000-8000-000000000002'::uuid, 'paciente-b@test.local', 'usuario', '30000000-0000-4000-8000-000000000004'::uuid, true, 'aprobado');

-- Pacientes en los otros 3 estados de negocio, para probar que Sección 49
-- no debilitó la protección is_active/estatus (Sección 49 solo cambia
-- CÓMO se evalúa esa regla, no la regla en sí).
select tests.create_user('30000000-0000-4000-8000-000000000006'::uuid, 'paciente-pendiente@test.local',    'usuario', '30000000-0000-4000-8000-000000000004'::uuid, false, 'pendiente');
select tests.create_user('30000000-0000-4000-8000-000000000007'::uuid, 'paciente-rechazado@test.local',    'usuario', '30000000-0000-4000-8000-000000000004'::uuid, false, 'rechazado');
select tests.create_user('30000000-0000-4000-8000-000000000008'::uuid, 'paciente-deshabilitado@test.local', 'usuario', '30000000-0000-4000-8000-000000000004'::uuid, false, 'aprobado');

-- ejercicios no se llena desde supabase_schema.sql (se importa aparte).
insert into ejercicios (id, nombre) values ('30000000-0000-4000-8000-0000000000e1', 'Ejercicio Test');

-- Estructura completa preexistente de Paciente A (propia) y Paciente B
-- (ajena, para probar aislamiento). Todo insertado como el rol por defecto.
insert into rutinas (id, user_id, nombre)
values ('30000000-0000-4000-8000-0000000000f1', '30000000-0000-4000-8000-000000000001', 'Rutina A');
insert into rutina_dias (id, rutina_id, numero_dia, nombre_dia)
values ('30000000-0000-4000-8000-0000000000f2', '30000000-0000-4000-8000-0000000000f1', 1, 'Lunes');
insert into rutina_ejercicios (id, dia_id, ejercicio_id, orden)
values ('30000000-0000-4000-8000-0000000000f3', '30000000-0000-4000-8000-0000000000f2', '30000000-0000-4000-8000-0000000000e1', 1);

insert into rutinas (id, user_id, nombre)
values ('30000000-0000-4000-8000-0000000000f4', '30000000-0000-4000-8000-000000000002', 'Rutina B');
insert into rutina_dias (id, rutina_id, numero_dia, nombre_dia)
values ('30000000-0000-4000-8000-0000000000f5', '30000000-0000-4000-8000-0000000000f4', 1, 'Lunes');
insert into rutina_ejercicios (id, dia_id, ejercicio_id, orden)
values ('30000000-0000-4000-8000-0000000000f6', '30000000-0000-4000-8000-0000000000f5', '30000000-0000-4000-8000-0000000000e1', 1);

-- ══════════════════════════ rutinas ══════════════════════════
-- Permitido: paciente propio (SELECT únicamente), admin dueño (SELECT,
-- INSERT si paciente activo+aprobado, UPDATE, DELETE), superadmin (igual
-- que admin dueño, sobre cualquier paciente).

-- 1. Paciente A SELECT propia = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from rutinas where id = '30000000-0000-4000-8000-0000000000f1')::int, 1,
  'rutinas: paciente propio SELECT = permitido');
reset role;

-- 2. Paciente A INSERT propia = bloqueado (mobile-app nunca lo hace)
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into rutinas (user_id, nombre) values ('30000000-0000-4000-8000-000000000001', 'Hack') $$,
  '42501', null, 'rutinas: paciente propio INSERT = bloqueado');
reset role;

-- 3. Paciente A SELECT de Paciente B = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from rutinas where id = '30000000-0000-4000-8000-0000000000f4')::int, 0,
  'rutinas: paciente ajeno SELECT = bloqueado');
reset role;

-- 4. Admin A SELECT de su paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from rutinas where id = '30000000-0000-4000-8000-0000000000f1')::int, 1,
  'rutinas: admin dueño SELECT = permitido');
reset role;

-- 5. Admin A INSERT para su paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into rutinas (id, user_id, nombre)
     values ('30000000-0000-4000-8000-0000000000a1', '30000000-0000-4000-8000-000000000001', 'Rutina nueva') $$,
  'rutinas: admin dueño INSERT = permitido');
reset role;

-- 6. Admin A UPDATE esa rutina = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ update rutinas set nombre = 'Rutina renombrada' where id = '30000000-0000-4000-8000-0000000000a1' $$,
  'rutinas: admin dueño UPDATE = permitido');
reset role;

-- 7. Admin A DELETE esa rutina = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from rutinas where id = '30000000-0000-4000-8000-0000000000a1' $$,
  'rutinas: admin dueño DELETE = permitido');
reset role;

-- 8. Admin A SELECT de paciente ajeno = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from rutinas where id = '30000000-0000-4000-8000-0000000000f4')::int, 0,
  'rutinas: admin ajeno SELECT = bloqueado');
reset role;

-- 9. Admin A INSERT para paciente ajeno = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into rutinas (user_id, nombre) values ('30000000-0000-4000-8000-000000000002', 'Hack admin') $$,
  '42501', null, 'rutinas: admin ajeno INSERT = bloqueado');
reset role;

-- 10. Admin A UPDATE rutina de paciente ajeno = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with actualizado as (
  update rutinas set nombre = 'hack' where id = '30000000-0000-4000-8000-0000000000f4' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'rutinas: admin ajeno UPDATE = bloqueado');
reset role;

-- 11. Admin A DELETE rutina de paciente ajeno = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
with borrado as (
  delete from rutinas where id = '30000000-0000-4000-8000-0000000000f4' returning 1
)
select is((select count(*) from borrado)::int, 0, 'rutinas: admin ajeno DELETE = bloqueado');
reset role;

-- 12. Superadmin SELECT de cualquier paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from rutinas where id = '30000000-0000-4000-8000-0000000000f4')::int, 1,
  'rutinas: superadmin SELECT = permitido');
reset role;

-- 13. Superadmin INSERT para cualquier paciente aprobado+activo = permitido
--     (corregido en Sección 49: rutinas_insert usaba una subconsulta
--     directa contra perfiles para validar is_active/estatus, sujeta a la
--     RLS de perfiles — invisible para superadmin sobre pacientes ajenos.
--     Ahora usa la función SECURITY DEFINER get_perfil_activo_aprobado().)
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into rutinas (id, user_id, nombre)
     values ('30000000-0000-4000-8000-0000000000a5', '30000000-0000-4000-8000-000000000002', 'Rutina superadmin') $$,
  'rutinas: superadmin INSERT para paciente ajeno aprobado+activo = permitido');
reset role;

-- 13b-13d. La protección is_active/estatus sigue intacta para superadmin
-- (Sección 49 solo cambió cómo se evalúa, no la regla en sí).

-- 13b. Superadmin INSERT para paciente pendiente = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into rutinas (user_id, nombre) values ('30000000-0000-4000-8000-000000000006', 'Rutina pendiente') $$,
  '42501', null, 'rutinas: superadmin INSERT para paciente pendiente = bloqueado');
reset role;

-- 13c. Superadmin INSERT para paciente rechazado = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into rutinas (user_id, nombre) values ('30000000-0000-4000-8000-000000000007', 'Rutina rechazado') $$,
  '42501', null, 'rutinas: superadmin INSERT para paciente rechazado = bloqueado');
reset role;

-- 13d. Superadmin INSERT para paciente deshabilitado (aprobado pero is_active=false) = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into rutinas (user_id, nombre) values ('30000000-0000-4000-8000-000000000008', 'Rutina deshabilitado') $$,
  '42501', null, 'rutinas: superadmin INSERT para paciente deshabilitado = bloqueado');
reset role;

-- Fixture independiente para 14/15: rutinas_update y rutinas_delete NO
-- tienen la cláusula de is_active/estatus (solo rutinas_insert la tiene),
-- así que UPDATE/DELETE de superadmin sí funcionan sobre pacientes
-- ajenos — se prueban con su propia fila para no depender del bug de 13.
insert into rutinas (id, user_id, nombre)
values ('30000000-0000-4000-8000-0000000000a7', '30000000-0000-4000-8000-000000000002', 'Rutina superadmin fixture');

-- 14. Superadmin UPDATE rutina de cualquier paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ update rutinas set nombre = 'Rutina superadmin renombrada' where id = '30000000-0000-4000-8000-0000000000a7' $$,
  'rutinas: superadmin UPDATE = permitido');
reset role;

-- 15. Superadmin DELETE rutina de cualquier paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from rutinas where id = '30000000-0000-4000-8000-0000000000a7' $$,
  'rutinas: superadmin DELETE = permitido');
reset role;

-- ══════════════════════════ rutina_dias ══════════════════════════
-- Permitido: paciente propio (SELECT únicamente), admin dueño (SELECT,
-- INSERT, DELETE — nunca UPDATE), superadmin (igual, sobre cualquiera).

-- 16. Paciente A SELECT su propio día = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from rutina_dias where id = '30000000-0000-4000-8000-0000000000f2')::int, 1,
  'rutina_dias: paciente propio SELECT = permitido');
reset role;

-- 17. Paciente A SELECT día de Paciente B = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from rutina_dias where id = '30000000-0000-4000-8000-0000000000f5')::int, 0,
  'rutina_dias: paciente ajeno SELECT = bloqueado');
reset role;

-- 18. Admin A SELECT día de su paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from rutina_dias where id = '30000000-0000-4000-8000-0000000000f2')::int, 1,
  'rutina_dias: admin dueño SELECT = permitido');
reset role;

-- 19. Admin A INSERT día en rutina de su paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into rutina_dias (id, rutina_id, numero_dia, nombre_dia)
     values ('30000000-0000-4000-8000-0000000000a2', '30000000-0000-4000-8000-0000000000f1', 2, 'Martes') $$,
  'rutina_dias: admin dueño INSERT = permitido');
reset role;

-- 20. Admin A DELETE ese día = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from rutina_dias where id = '30000000-0000-4000-8000-0000000000a2' $$,
  'rutina_dias: admin dueño DELETE = permitido');
reset role;

-- 21. Admin A SELECT día de paciente ajeno = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from rutina_dias where id = '30000000-0000-4000-8000-0000000000f5')::int, 0,
  'rutina_dias: admin ajeno SELECT = bloqueado');
reset role;

-- 22. Admin A INSERT día en rutina de paciente ajeno = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into rutina_dias (rutina_id, numero_dia, nombre_dia)
     values ('30000000-0000-4000-8000-0000000000f4', 3, 'Miercoles') $$,
  '42501', null, 'rutina_dias: admin ajeno INSERT = bloqueado');
reset role;

-- 23. Superadmin SELECT día de cualquier paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from rutina_dias where id = '30000000-0000-4000-8000-0000000000f5')::int, 1,
  'rutina_dias: superadmin SELECT = permitido');
reset role;

-- 24. Superadmin INSERT día en rutina de cualquier paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into rutina_dias (id, rutina_id, numero_dia, nombre_dia)
     values ('30000000-0000-4000-8000-0000000000a6', '30000000-0000-4000-8000-0000000000f4', 2, 'Martes') $$,
  'rutina_dias: superadmin INSERT = permitido');
reset role;

-- 25. Superadmin DELETE ese día = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ delete from rutina_dias where id = '30000000-0000-4000-8000-0000000000a6' $$,
  'rutina_dias: superadmin DELETE = permitido');
reset role;

-- ══════════════════════════ rutina_ejercicios ══════════════════════════
-- Permitido: paciente propio (SELECT únicamente), admin dueño (SELECT,
-- INSERT — nunca UPDATE/DELETE, se limpia por cascada), superadmin (igual,
-- sobre cualquiera).

-- 26. Paciente A SELECT su propio ejercicio = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from rutina_ejercicios where id = '30000000-0000-4000-8000-0000000000f3')::int, 1,
  'rutina_ejercicios: paciente propio SELECT = permitido');
reset role;

-- 27. Paciente A SELECT ejercicio de Paciente B = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from rutina_ejercicios where id = '30000000-0000-4000-8000-0000000000f6')::int, 0,
  'rutina_ejercicios: paciente ajeno SELECT = bloqueado');
reset role;

-- 28. Admin A SELECT ejercicio de su paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from rutina_ejercicios where id = '30000000-0000-4000-8000-0000000000f3')::int, 1,
  'rutina_ejercicios: admin dueño SELECT = permitido');
reset role;

-- 29. Admin A INSERT ejercicio en día de su paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into rutina_ejercicios (dia_id, ejercicio_id, orden)
     values ('30000000-0000-4000-8000-0000000000f2', '30000000-0000-4000-8000-0000000000e1', 2) $$,
  'rutina_ejercicios: admin dueño INSERT = permitido');
reset role;

-- 30. Admin A SELECT ejercicio de paciente ajeno = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from rutina_ejercicios where id = '30000000-0000-4000-8000-0000000000f6')::int, 0,
  'rutina_ejercicios: admin ajeno SELECT = bloqueado');
reset role;

-- 31. Admin A INSERT ejercicio en día de paciente ajeno = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into rutina_ejercicios (dia_id, ejercicio_id, orden)
     values ('30000000-0000-4000-8000-0000000000f5', '30000000-0000-4000-8000-0000000000e1', 2) $$,
  '42501', null, 'rutina_ejercicios: admin ajeno INSERT = bloqueado');
reset role;

-- 32. Superadmin SELECT ejercicio de cualquier paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from rutina_ejercicios where id = '30000000-0000-4000-8000-0000000000f6')::int, 1,
  'rutina_ejercicios: superadmin SELECT = permitido');
reset role;

-- 33. Superadmin INSERT ejercicio en día de cualquier paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into rutina_ejercicios (dia_id, ejercicio_id, orden)
     values ('30000000-0000-4000-8000-0000000000f5', '30000000-0000-4000-8000-0000000000e1', 3) $$,
  'rutina_ejercicios: superadmin INSERT = permitido');
reset role;

-- ══════════════════════ flujo real de replaceDias ══════════════════════
-- 34-35. Admin A crea día + ejercicio hijo en su propia rutina, borra el
-- día, y confirma que el ejercicio hijo desaparece por ON DELETE CASCADE
-- (demuestra que NO hace falta policy DELETE en rutina_ejercicios).
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;

insert into rutina_dias (id, rutina_id, numero_dia, nombre_dia)
values ('30000000-0000-4000-8000-0000000000a3', '30000000-0000-4000-8000-0000000000f1', 4, 'Jueves');
insert into rutina_ejercicios (id, dia_id, ejercicio_id, orden)
values ('30000000-0000-4000-8000-0000000000a4', '30000000-0000-4000-8000-0000000000a3', '30000000-0000-4000-8000-0000000000e1', 1);

with borrado as (
  delete from rutina_dias where id = '30000000-0000-4000-8000-0000000000a3' returning 1
)
select is((select count(*) from borrado)::int, 1, 'rutina_dias: el DELETE del día afecta exactamente 1 fila');

select is((select count(*) from rutina_ejercicios where id = '30000000-0000-4000-8000-0000000000a4')::int, 0,
  'rutina_ejercicios: desaparece por ON DELETE CASCADE al borrar el día');
reset role;

-- ══════════════════ RPC guardar_rutina_completa (Sección 58) ══════════════════
-- Cobertura de atomicidad: caso exitoso, error a mitad de camino (día y
-- ejercicio inválidos), rollback total sin estado parcial, caller no
-- autorizado bloqueado, caller autorizado permitido.

-- 36. Caso exitoso: admin dueño crea una rutina nueva completa (2 días, uno
--     con 1 ejercicio) para su paciente, todo en una sola llamada.
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ select public.guardar_rutina_completa(
       '30000000-0000-4000-8000-000000000001'::uuid,
       null,
       'Rutina RPC nueva',
       'kg',
       '[
         {"numero_dia":1,"nombre_dia":"Lunes","es_descanso":false,"ejercicios":[
           {"ejercicio_id":"30000000-0000-4000-8000-0000000000e1","orden":1,"series":3,"repeticiones":"10","peso_sugerido_kg":20,"descanso_seg":60,"rir":2,"rpe":7,"tipo_esfuerzo":"reps","series_detalle":null,"unidad_peso":"kg"}
         ]},
         {"numero_dia":2,"nombre_dia":"Martes","es_descanso":true,"ejercicios":[]}
       ]'::jsonb
     ) $$,
  'guardar_rutina_completa: admin dueño crea rutina nueva completa = permitido');
reset role;

-- 37. Se crearon exactamente los 2 días esperados.
select is(
  (select count(*)::int from rutina_dias rd join rutinas r on r.id = rd.rutina_id
   where r.user_id = '30000000-0000-4000-8000-000000000001' and r.nombre = 'Rutina RPC nueva'),
  2, 'guardar_rutina_completa: crea los 2 días esperados en una sola llamada');

-- 38. El ejercicio del día 1 se insertó correctamente.
select is(
  (select count(*)::int from rutina_ejercicios re
   join rutina_dias rd on rd.id = re.dia_id join rutinas r on r.id = rd.rutina_id
   where r.nombre = 'Rutina RPC nueva' and rd.numero_dia = 1),
  1, 'guardar_rutina_completa: inserta el ejercicio del día 1');

-- 39. Error en día N: numero_dia=9 en el segundo día viola el CHECK
--     (1..7) sobre la rutina existente f1 (Paciente A) — la llamada entera
--     debe fallar, no solo el día inválido.
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_rutina_completa(
       '30000000-0000-4000-8000-000000000001'::uuid,
       '30000000-0000-4000-8000-0000000000f1'::uuid,
       'Rutina A',
       'kg',
       '[
         {"numero_dia":1,"nombre_dia":"Lunes","es_descanso":false,"ejercicios":[]},
         {"numero_dia":9,"nombre_dia":"Invalido","es_descanso":false,"ejercicios":[]}
       ]'::jsonb
     ) $$,
  '23514', null, 'guardar_rutina_completa: numero_dia inválido en día 2 = bloqueado (CHECK)');
reset role;

-- 40-41. Rollback total tras el error de día: el día original (f2) de la
-- rutina f1 sigue existiendo intacto y el nombre del padre no cambió — el
-- DELETE + el día 1 ya insertado antes del error también se revirtieron.
select is((select count(*)::int from rutina_dias where id = '30000000-0000-4000-8000-0000000000f2'), 1,
  'guardar_rutina_completa: tras el error de día, el día original NO se perdió (rollback total)');
select is((select nombre from rutinas where id = '30000000-0000-4000-8000-0000000000f1'), 'Rutina A',
  'guardar_rutina_completa: tras el error de día, el nombre del padre NO cambió (rollback total)');

-- 42. Error en ejercicio N: ejercicio_id inexistente en el día 2 viola el
--     FK — misma rutina f1, la llamada entera debe fallar.
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_rutina_completa(
       '30000000-0000-4000-8000-000000000001'::uuid,
       '30000000-0000-4000-8000-0000000000f1'::uuid,
       'Rutina A',
       'kg',
       '[
         {"numero_dia":1,"nombre_dia":"Lunes","es_descanso":false,"ejercicios":[]},
         {"numero_dia":2,"nombre_dia":"Martes","es_descanso":false,"ejercicios":[
           {"ejercicio_id":"30000000-0000-4000-8000-ffffffffffff","orden":1,"series":3,"repeticiones":"10","peso_sugerido_kg":20,"descanso_seg":60,"rir":2,"rpe":7,"tipo_esfuerzo":"reps","series_detalle":null,"unidad_peso":"kg"}
         ]}
       ]'::jsonb
     ) $$,
  '23503', null, 'guardar_rutina_completa: ejercicio_id inexistente en día 2 = bloqueado (FK)');
reset role;

-- 43-44. Rollback total tras el error de ejercicio: la rutina f1 sigue con
-- exactamente 1 día (el original), y ese día sigue siendo f2 (mismo id) —
-- ni el DELETE ni el INSERT del día 1 (que sí habría tenido éxito solo)
-- quedaron aplicados.
select is((select count(*)::int from rutina_dias where rutina_id = '30000000-0000-4000-8000-0000000000f1'), 1,
  'guardar_rutina_completa: tras el error de ejercicio, la rutina sigue con exactamente 1 día (rollback total)');
select is((select count(*)::int from rutina_dias where id = '30000000-0000-4000-8000-0000000000f2'), 1,
  'guardar_rutina_completa: tras el error de ejercicio, el día original (f2) sigue intacto (rollback total)');

-- 45. Caller no autorizado: Admin B intenta editar (UPDATE branch) la
--     rutina f1 de un paciente que no gestiona = bloqueado, con mensaje
--     explícito (RLS filtra el UPDATE, RETURNING no produce fila).
select tests.authenticate_as('30000000-0000-4000-8000-000000000004'::uuid);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_rutina_completa(
       '30000000-0000-4000-8000-000000000001'::uuid,
       '30000000-0000-4000-8000-0000000000f1'::uuid,
       'hack', 'kg', '[]'::jsonb
     ) $$,
  null, null, 'guardar_rutina_completa: admin ajeno UPDATE = bloqueado (rutina no editable, error explícito)');
reset role;

-- 46. Caller no autorizado: el propio paciente intenta crear una rutina
--     para sí mismo (INSERT branch) = bloqueado por rutinas_insert real.
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_rutina_completa(
       '30000000-0000-4000-8000-000000000001'::uuid,
       null, 'Hack rutina', 'kg', '[]'::jsonb
     ) $$,
  '42501', null, 'guardar_rutina_completa: paciente INSERT para sí mismo = bloqueado (RLS real)');
reset role;

-- 47-50. Caller autorizado permitido (UPDATE branch), sobre una fixture
-- dedicada: admin dueño reemplaza nombre/unidad_peso/días de su paciente.
insert into rutinas (id, user_id, nombre)
values ('30000000-0000-4000-8000-0000000000c1', '30000000-0000-4000-8000-000000000001', 'Rutina RPC update fixture');
insert into rutina_dias (id, rutina_id, numero_dia, nombre_dia)
values ('30000000-0000-4000-8000-0000000000c2', '30000000-0000-4000-8000-0000000000c1', 1, 'Lunes');

select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select lives_ok(
  $$ select public.guardar_rutina_completa(
       '30000000-0000-4000-8000-000000000001'::uuid,
       '30000000-0000-4000-8000-0000000000c1'::uuid,
       'Rutina RPC update fixture (editada)',
       'lbs',
       '[{"numero_dia":3,"nombre_dia":"Miercoles","es_descanso":false,"ejercicios":[]}]'::jsonb
     ) $$,
  'guardar_rutina_completa: admin dueño UPDATE (caller autorizado) = permitido');
reset role;

select is((select nombre from rutinas where id = '30000000-0000-4000-8000-0000000000c1'),
  'Rutina RPC update fixture (editada)', 'guardar_rutina_completa: nombre del padre actualizado');
select is((select unidad_peso from rutinas where id = '30000000-0000-4000-8000-0000000000c1'),
  'lbs', 'guardar_rutina_completa: unidad_peso del padre actualizada');
select is((select count(*)::int from rutina_dias where rutina_id = '30000000-0000-4000-8000-0000000000c1' and numero_dia = 1), 0,
  'guardar_rutina_completa: el día viejo (numero_dia=1) fue reemplazado');
select is((select count(*)::int from rutina_dias where rutina_id = '30000000-0000-4000-8000-0000000000c1' and numero_dia = 3), 1,
  'guardar_rutina_completa: el día nuevo (numero_dia=3) quedó insertado');

-- ══════════════════ guardar_rutina_completa — grants y SECURITY INVOKER ══════════════════
-- Corrección post-deploy: "revoke all ... from public" no bastó en
-- producción (anon tenía EXECUTE explícito). Se verifica aquí de forma
-- explícita el estado real de privilegios, no solo que la función exista.

-- 51. authenticated SÍ tiene EXECUTE.
select ok(
  has_function_privilege('authenticated', 'public.guardar_rutina_completa(uuid, uuid, text, text, jsonb)', 'EXECUTE'),
  'guardar_rutina_completa: authenticated tiene EXECUTE');

-- 52. anon NO tiene EXECUTE.
select ok(
  not has_function_privilege('anon', 'public.guardar_rutina_completa(uuid, uuid, text, text, jsonb)', 'EXECUTE'),
  'guardar_rutina_completa: anon NO tiene EXECUTE');

-- 53. PUBLIC NO tiene EXECUTE (sin fila de ACL con grantee=0).
select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join lateral aclexplode(p.proacl) a on true
    where n.nspname = 'public' and p.proname = 'guardar_rutina_completa'
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'guardar_rutina_completa: PUBLIC NO tiene EXECUTE');

-- 54. Sigue siendo SECURITY INVOKER (prosecdef = false).
select is(
  (select prosecdef from pg_proc where oid = 'public.guardar_rutina_completa(uuid, uuid, text, text, jsonb)'::regprocedure),
  false, 'guardar_rutina_completa: SECURITY INVOKER (prosecdef = false)');

-- ══════════════════ dias_completados (Sección 68, Radar R1) ══════════════════
-- Permitido: paciente propio (SELECT, INSERT), admin dueño (SELECT), admin
-- ajeno (bloqueado), superadmin (SELECT). Sin UPDATE/DELETE para nadie — el
-- flujo real (marcarDiaCompletado) solo hace upsert con ignoreDuplicates.

-- 55. Paciente A INSERT su propio día completado = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into dias_completados (id, user_id, dia_id, fecha)
     values ('30000000-0000-4000-8000-0000000000b1', '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-0000000000f2', current_date) $$,
  'dias_completados: paciente propio INSERT = permitido');
reset role;

-- 56. El registro persiste (visible para el propio paciente)
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from dias_completados where id = '30000000-0000-4000-8000-0000000000b1')::int, 1,
  'dias_completados: el registro persiste');
reset role;

-- 57. Doble envío el mismo día = idempotente (no duplica, mismo patrón que
--     usa marcarDiaCompletado: upsert con onConflict + ignoreDuplicates).
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select lives_ok(
  $$ insert into dias_completados (user_id, dia_id, fecha)
     values ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-0000000000f2', current_date)
     on conflict (user_id, dia_id, fecha) do nothing $$,
  'dias_completados: doble envío mismo día no falla (upsert idempotente)');
select is(
  (select count(*)::int from dias_completados
   where user_id = '30000000-0000-4000-8000-000000000001' and dia_id = '30000000-0000-4000-8000-0000000000f2' and fecha = current_date),
  1, 'dias_completados: doble envío mismo día no duplica la fila');
reset role;

-- 58. Paciente A INSERT suplantando a Paciente B (user_id ajeno) = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into dias_completados (user_id, dia_id, fecha)
     values ('30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-0000000000f5', current_date) $$,
  '42501', null, 'dias_completados: paciente INSERT para user_id ajeno = bloqueado');
reset role;

-- 59. Paciente A SELECT del día de Paciente B = bloqueado (aislamiento)
insert into dias_completados (id, user_id, dia_id, fecha)
values ('30000000-0000-4000-8000-0000000000b2', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-0000000000f5', current_date);

select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
select is((select count(*) from dias_completados where id = '30000000-0000-4000-8000-0000000000b2')::int, 0,
  'dias_completados: paciente ajeno SELECT = bloqueado');
reset role;

-- 60. Admin A (nutricionista_id real) SELECT del día de su Paciente A = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from dias_completados where id = '30000000-0000-4000-8000-0000000000b1')::int, 1,
  'dias_completados: nutriólogo dueño SELECT = permitido');
reset role;

-- 61. Admin A SELECT del día de Paciente B (no es su paciente) = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000003'::uuid);
set local role authenticated;
select is((select count(*) from dias_completados where id = '30000000-0000-4000-8000-0000000000b2')::int, 0,
  'dias_completados: nutriólogo ajeno SELECT = bloqueado');
reset role;

-- 62. Superadmin SELECT de cualquier paciente = permitido
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select is((select count(*) from dias_completados where id = '30000000-0000-4000-8000-0000000000b2')::int, 1,
  'dias_completados: superadmin SELECT = permitido');
reset role;

-- 63. Sin policy de UPDATE — paciente propio UPDATE = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with actualizado as (
  update dias_completados set fecha = current_date - 1 where id = '30000000-0000-4000-8000-0000000000b1' returning 1
)
select is((select count(*) from actualizado)::int, 0, 'dias_completados: paciente propio UPDATE = bloqueado (sin policy)');
reset role;

-- 64. Sin policy de DELETE — paciente propio DELETE = bloqueado
select tests.authenticate_as('30000000-0000-4000-8000-000000000001'::uuid);
set local role authenticated;
with borrado as (
  delete from dias_completados where id = '30000000-0000-4000-8000-0000000000b1' returning 1
)
select is((select count(*) from borrado)::int, 0, 'dias_completados: paciente propio DELETE = bloqueado (sin policy)');
reset role;

-- 65. UNIQUE(user_id, dia_id, fecha) sigue vigente (identifica un día
--     completado como paciente + rutina_dia + fecha, tal como define Radar).
select tests.authenticate_as('30000000-0000-4000-8000-000000000005'::uuid);
set local role authenticated;
select throws_ok(
  $$ insert into dias_completados (user_id, dia_id, fecha)
     values ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-0000000000f2', current_date) $$,
  '23505', null, 'dias_completados: UNIQUE(user_id, dia_id, fecha) sigue vigente');
reset role;

select * from finish();
rollback;
