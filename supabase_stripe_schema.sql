-- Guardamos el customer de Stripe en el perfil
alter table perfiles
  add column stripe_customer_id text;

-- Tabla de suscripciones
create table suscripciones (
  id                     uuid default uuid_generate_v4() primary key,
  user_id                uuid references auth.users(id) on delete cascade,
  stripe_subscription_id text unique not null,
  stripe_price_id        text not null,
  status                 text not null, -- active, past_due, canceled, trialing...
  current_period_end     timestamptz,
  created_at             timestamptz not null default now()
);

-- ============================================================
-- 57. MIGRACIÓN — UNIQUE en perfiles.stripe_customer_id
-- ============================================================
-- Auditoría de riesgos residuales de stripe-webhook (post-hotfix P0 +
-- reconciliación histórica) el 2026-08-31. No existe ninguna razón
-- funcional para que dos perfiles compartan el mismo Stripe Customer:
-- crear-checkout siempre resuelve/crea el customer scoped a auth.uid()
-- propio (Sección P0), nunca adjunta un customer existente a un perfil
-- distinto. Confirmado con pg real de producción: 0 duplicados de
-- stripe_customer_id antes de aplicar esta sección.
--
-- Va en ESTE archivo (no en supabase_schema.sql) porque stripe_customer_id
-- es una columna de supabase_stripe_schema.sql — drift ya documentado
-- (este archivo se corrió aparte en producción y nunca se fusionó a
-- supabase_schema.sql). Ponerla en supabase_schema.sql rompe la
-- reconstrucción local, porque el harness aplica schema.sql ANTES que
-- este archivo, y la columna todavía no existiría en ese punto.
--
-- UNIQUE estándar (no índice parcial): en Postgres una constraint UNIQUE
-- sobre una columna nullable ya permite múltiples NULL sin conflicto
-- (NULL nunca se compara como igual a otro NULL) — no hace falta
-- "WHERE stripe_customer_id IS NOT NULL".
--
-- Idempotente (drop + add) para que "supabase db reset" pueda reconstruir
-- el schema completo desde cero repetidamente sin error.

alter table public.perfiles
  drop constraint if exists perfiles_stripe_customer_id_key;

alter table public.perfiles
  add constraint perfiles_stripe_customer_id_key
  unique (stripe_customer_id);

-- ============================================================
-- ROLLBACK Sección 57 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- alter table public.perfiles
--   drop constraint if exists perfiles_stripe_customer_id_key;
-- ============================================================

-- ============================================================
-- 62. MIGRACIÓN — Defensa en profundidad: cierra grants de tabla
--     sobre public.suscripciones para anon/authenticated
-- ============================================================
-- Hallazgo del barrido final de auditoría (H3): suscripciones ya tenía
-- row level security ENABLED (confirmado en producción vía pg_class:
-- relrowsecurity=true, relforcerowsecurity=false) y CERO policies — por
-- lo tanto anon/authenticated ya estaban deny-by-default a nivel de fila,
-- sin exposición cross-tenant real. No es RLS deshabilitada, a diferencia
-- del hallazgo original de la Sección 56 (nutricionistas_publicos).
--
-- Sin embargo, information_schema.role_table_grants confirmó en
-- producción que anon/authenticated seguían teniendo grants amplios de
-- TABLA sobre suscripciones (el auto-expose de Supabase sobre objetos
-- nuevos de "public", mismo mecanismo de fondo que la Sección 56, nunca
-- corregido aquí porque esta tabla vive en el archivo de drift separado).
-- Esto no es explotable hoy porque RLS ya bloquea cualquier fila, pero es
-- una capa de protección redundante y barata: cierra el grant en el nivel
-- de tabla además del nivel de fila, consistente con el patrón "cero
-- privilegios salvo necesidad real demostrada" (Sección 58-61).
--
-- Consumidores reales de suscripciones (grep completo del repo, sin
-- resultados en mobile-app ni admin-web): únicamente
-- supabase/functions/stripe-webhook/index.ts y scripts/reconcile-stripe.mjs,
-- ambos vía SUPABASE_SERVICE_ROLE_KEY. Ningún rol de cliente
-- (paciente/admin/superadmin) lee o escribe esta tabla — el "plan actual"
-- que ve el paciente en mobile-app (perfil.tsx) se sirve desde
-- perfiles.plan_membresia, no desde suscripciones. Por eso no se agrega
-- ninguna policy de SELECT: no hay necesidad real que la justifique.
--
-- No se tocan los privilegios de service_role/postgres (contexto
-- administrativo/servidor de confianza, igual que en las Secciones 58-61).
--
-- "enable row level security" se incluye aquí de forma explícita e
-- idempotente aunque el diagnóstico de producción ya la mostró en true:
-- sin esta línea, un "supabase db reset" desde cero (o un proyecto nuevo
-- que aplique este archivo por primera vez) NO la habilitaría, porque
-- ningún statement previo de supabase_stripe_schema.sql lo hacía — el
-- estado real de producción se llegó a él fuera de este archivo, y sin
-- esta línea el archivo no sería fuente de verdad reproducible.
alter table public.suscripciones enable row level security;
revoke all on public.suscripciones from anon, authenticated;

-- ============================================================
-- ROLLBACK Sección 62 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- grant all on public.suscripciones to anon, authenticated;
-- alter table public.suscripciones disable row level security;
-- ============================================================