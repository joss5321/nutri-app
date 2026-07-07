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