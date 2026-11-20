-- ============================================================
-- Migración 0093 — RPCs atómicas: guardar_equivalentes_plan,
-- crear_receta_completa extendida (issues #8, #10)
-- ============================================================
-- Archivo independiente, listo para pegar y correr de principio a fin en
-- Supabase Dashboard → SQL Editor. También queda documentado como Sección
-- 93 al final de supabase_schema.sql.
--
-- Qué hace:
--   1. Crea guardar_equivalentes_plan(uuid, jsonb) — reemplaza el
--      DELETE+INSERT manual de saveEquivalentes() (admin-web) por una
--      sola transacción de servidor (issue #8).
--   2. Extiende crear_receta_completa (ya existía, Sección 63, pero sin
--      grant para "authenticated" y sin soporte de receta_base_id/
--      foto_url/foto_storage_path) para que createReceta()/el clonado en
--      saveRecetaPersonalizada() (admin-web) la usen en vez de un INSERT
--      seguido de un Promise.all de dos operaciones separadas (issue #10).
--
-- Qué NO hace: no cambia ninguna policy de RLS existente — ambas
-- funciones son SECURITY INVOKER, así que quedan sujetas exactamente a
-- las mismas policies que ya rigen el INSERT/DELETE directo.

-- ============================================================
-- PASO 1 — Verificación ANTES (solo lectura)
-- ============================================================
-- Confirma que crear_receta_completa hoy NO tiene grant para
-- "authenticated" (resultado esperado: 0 filas o solo "service_role"/roles
-- internos, nunca "authenticated").
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_name = 'crear_receta_completa' and privilege_type = 'EXECUTE';

-- ============================================================
-- PASO 2 — El cambio real
-- ============================================================
create or replace function public.guardar_equivalentes_plan(
  p_plan_id uuid,
  p_rows jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row jsonb;
begin
  delete from public.plan_equivalentes where plan_id = p_plan_id;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    insert into public.plan_equivalentes (plan_id, grupo, icono, desayuno, colacion_1, comida, colacion_2, cena)
    values (
      p_plan_id,
      v_row->>'grupo',
      v_row->>'icono',
      coalesce((v_row->>'desayuno')::int, 0),
      coalesce((v_row->>'colacion_1')::int, 0),
      coalesce((v_row->>'comida')::int, 0),
      coalesce((v_row->>'colacion_2')::int, 0),
      coalesce((v_row->>'cena')::int, 0)
    );
  end loop;
end;
$$;

revoke execute on function public.guardar_equivalentes_plan(uuid, jsonb) from public, anon;
grant execute on function public.guardar_equivalentes_plan(uuid, jsonb) to authenticated;

drop function if exists public.crear_receta_completa(
  uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb
);

create or replace function public.crear_receta_completa(
  p_user_id uuid,
  p_nombre text,
  p_emoji text,
  p_tipo text,
  p_categoria_nutricional text,
  p_tags text,
  p_tiempo_prep_min int,
  p_tiempo_coccion_min int,
  p_tiempo_min int,
  p_nivel text,
  p_calorias int,
  p_porciones text,
  p_proteinas_g numeric,
  p_carbohidratos_g numeric,
  p_grasas_g numeric,
  p_ingredientes jsonb,
  p_pasos jsonb,
  p_receta_base_id uuid default null,
  p_foto_url text default null,
  p_foto_storage_path text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_receta_id uuid;
  v_ing jsonb;
  v_paso jsonb;
  v_descripcion text;
  v_orden int := 0;
  v_numero int := 0;
begin
  insert into public.recetas (
    user_id, nombre, emoji, tipo, categoria_nutricional, tags,
    tiempo_prep_min, tiempo_coccion_min, tiempo_min, nivel, calorias,
    porciones, proteinas_g, carbohidratos_g, grasas_g,
    receta_base_id, foto_url, foto_storage_path
  ) values (
    p_user_id, p_nombre, p_emoji, p_tipo, p_categoria_nutricional, p_tags,
    p_tiempo_prep_min, p_tiempo_coccion_min, p_tiempo_min, p_nivel, p_calorias,
    p_porciones, p_proteinas_g, p_carbohidratos_g, p_grasas_g,
    p_receta_base_id, p_foto_url, p_foto_storage_path
  )
  returning id into v_receta_id;

  for v_ing in select * from jsonb_array_elements(coalesce(p_ingredientes, '[]'::jsonb))
  loop
    if coalesce(trim(v_ing->>'descripcion'), '') = '' then
      continue;
    end if;
    v_orden := v_orden + 1;
    insert into public.receta_ingredientes (receta_id, orden, descripcion, alimento_id, cantidad, unidad)
    values (
      v_receta_id,
      v_orden,
      trim(v_ing->>'descripcion'),
      (v_ing->>'alimento_id')::uuid,
      (v_ing->>'cantidad')::numeric,
      v_ing->>'unidad'
    );
  end loop;

  for v_paso in select * from jsonb_array_elements(coalesce(p_pasos, '[]'::jsonb))
  loop
    v_descripcion := trim(v_paso #>> '{}');
    if coalesce(v_descripcion, '') = '' then
      continue;
    end if;
    v_numero := v_numero + 1;
    insert into public.receta_pasos (receta_id, numero, descripcion)
    values (v_receta_id, v_numero, v_descripcion);
  end loop;

  return v_receta_id;
end;
$$;

revoke execute on function public.crear_receta_completa(
  uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb, uuid, text, text
) from public, anon;
grant execute on function public.crear_receta_completa(
  uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb, uuid, text, text
) to authenticated;

-- ============================================================
-- PASO 3 — Verificación DESPUÉS (correr la misma consulta del Paso 1)
-- ============================================================
-- Resultado esperado ahora: una fila con grantee='authenticated',
-- privilege_type='EXECUTE'.
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_name = 'crear_receta_completa' and privilege_type = 'EXECUTE';

-- ============================================================
-- PASO 4 — Verificación funcional (con la app real, no se puede simular
-- aquí porque depende de auth.uid() real)
-- ============================================================
-- 1. Como nutriólogo real en admin-web: editar los equivalentes de un
--    paciente y guardar — confirmar que persisten tras recargar.
-- 2. Crear una receta nueva en el catálogo base (admin) con ingredientes
--    y pasos — confirmar que se guardan correctamente.
-- 3. Duplicar una receta existente — confirmar que la copia tiene sus
--    propios ingredientes/pasos (no los de la original por referencia).
-- 4. Si aplica: personalizar una receta base para un paciente específico
--    (clonado) — confirmar que queda ligada a ese paciente con
--    receta_base_id apuntando a la original.
-- Si los 4 funcionan igual que antes del cambio, confirma en los issues
-- #8/#10 con esta evidencia antes de cerrarlos.

-- ============================================================
-- ROLLBACK — Referencia, NO ejecutar salvo que se decida revertir:
--
-- drop function if exists public.guardar_equivalentes_plan(uuid, jsonb);
--
-- drop function if exists public.crear_receta_completa(
--   uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb, uuid, text, text
-- );
-- -- recrear la versión original de 17 parámetros (ver Sección 63 de
-- -- supabase_schema.sql para el cuerpo completo) y:
-- revoke all on function public.crear_receta_completa(
--   uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb
-- ) from public, anon, authenticated;
-- ============================================================
