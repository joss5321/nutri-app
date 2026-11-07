-- ============================================================
-- Migración 0092 — Revocar EXECUTE excesivo (issues #11, #20)
-- ============================================================
-- Archivo independiente a propósito: NO requiere correr
-- supabase_schema.sql completo. Pegar y correr este archivo solo,
-- de principio a fin, en Supabase Dashboard → SQL Editor.
--
-- También queda documentado como Sección 92 al final de
-- supabase_schema.sql (consistencia con el resto del historial de
-- migraciones del proyecto) — este archivo es la versión standalone,
-- lista para ejecutar sin tocar nada más.
--
-- Funciones y firmas exactas afectadas:
--   1. get_current_user_is_active()            — supabase_schema.sql línea 914
--   2. get_perfil_activo_aprobado(uuid)         — supabase_schema.sql línea 2047 (aprox., sección 49)
--   3. get_user_rol()                            — supabase_schema.sql línea 1076
--
-- Qué hace y qué NO hace este cambio:
--   - Revoca el permiso de ejecutar estas 3 funciones directamente
--     (ej. vía supabase.rpc(...) desde el cliente) a los roles
--     "public" y "anon".
--   - NO afecta su uso normal: las 3 se siguen usando libremente desde
--     DENTRO de policies de RLS (el motor de Postgres las ejecuta ahí
--     con privilegios de definer/propias de la policy, sin pasar por
--     el permiso EXECUTE del rol que hace la query).
--   - NO cambia qué datos devuelven ni su lógica — es puramente un
--     permiso de quién puede invocarlas directamente.
--   - Ninguna de las 3 acepta hoy un parámetro que un caller externo
--     pudiera usar para leer datos ajenos (confirmado leyendo su
--     definición) — este cambio es defensa en profundidad, no el
--     cierre de un hueco ya explotable hoy.

-- ============================================================
-- PASO 1 — Verificación ANTES (ejecutar primero, solo lectura)
-- ============================================================
-- Resultado esperado hoy (el problema que este archivo corrige):
-- puede_ejecutar = true para rolname IN ('anon') en las 3 filas.
select
  p.proname,
  r.rolname,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as puede_ejecutar
from pg_proc p
cross join (select oid, rolname from pg_roles where rolname in ('public', 'anon', 'authenticated')) r
where p.proname in ('get_current_user_is_active', 'get_perfil_activo_aprobado', 'get_user_rol')
  and p.pronamespace = 'public'::regnamespace
order by p.proname, r.rolname;

-- ============================================================
-- PASO 2 — El cambio real
-- ============================================================
revoke execute on function get_current_user_is_active() from public, anon;
revoke execute on function get_perfil_activo_aprobado(uuid) from public, anon;
revoke execute on function get_user_rol() from public, anon;

-- ============================================================
-- PASO 3 — Verificación DESPUÉS (correr la misma consulta del Paso 1)
-- ============================================================
-- Resultado esperado ahora: puede_ejecutar = false para rolname = 'anon'
-- y rolname = 'public' en las 3 filas; sigue true para 'authenticated'
-- NO fue tocado a propósito (estas funciones se usan desde sesiones de
-- usuarios autenticados reales en otras partes del esquema; solo se
-- quita el acceso de 'anon'/'public', que nunca debió tenerlo).
select
  p.proname,
  r.rolname,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as puede_ejecutar
from pg_proc p
cross join (select oid, rolname from pg_roles where rolname in ('public', 'anon', 'authenticated')) r
where p.proname in ('get_current_user_is_active', 'get_perfil_activo_aprobado', 'get_user_rol')
  and p.pronamespace = 'public'::regnamespace
order by p.proname, r.rolname;

-- ============================================================
-- PASO 4 — Verificación funcional (que nada real se rompió)
-- ============================================================
-- Correr esto DESPUÉS del Paso 2, con una sesión real de un usuario
-- autenticado normal (no superadmin) desde la app o admin-web — no se
-- puede simular aquí porque depende de auth.uid() real:
--   1. Que una pantalla que dependa de get_current_user_is_active() (el
--      middleware/guard que bloquea cuentas desactivadas) siga
--      funcionando igual que antes.
--   2. Que un nutriólogo normal siga viendo correctamente sus propios
--      pacientes (depende de get_perfil_activo_aprobado vía RLS).
--   3. Que el panel de admin-web siga distinguiendo roles correctamente
--      (depende de get_user_rol() vía RLS).
-- Si los 3 funcionan igual que antes del cambio, confirma en el issue
-- #11/#20 con esta evidencia antes de cerrarlos — no basta con que el
-- Paso 3 dé el resultado esperado.

-- ============================================================
-- ROLLBACK — Referencia, NO ejecutar salvo que se decida revertir
-- este cambio (restauraría el permiso excesivo original):
--
-- grant execute on function get_current_user_is_active() to public;
-- grant execute on function get_perfil_activo_aprobado(uuid) to public;
-- grant execute on function get_user_rol() to public;
-- ============================================================
