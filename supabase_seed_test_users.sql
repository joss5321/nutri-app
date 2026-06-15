-- ============================================================
-- SEED: usuarios de prueba
-- Crea usuarios reales en auth.users (lo que dispara el trigger
-- on_auth_user_created y crea su fila en perfiles automáticamente)
-- y luego completa sus datos en perfiles (sexo, fecha de nacimiento,
-- altura, plan de membresía).
--
-- Ejecutar en el SQL Editor de Supabase. Es seguro re-ejecutarlo:
-- los correos ya existentes se ignoran (on conflict do nothing).
--
-- Contraseña de todos los usuarios de prueba: Test1234!
-- ============================================================

with nuevos as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  )
  select
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    email,
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', full_name),
    now(), now(), '', '', '', ''
  from (values
    ('juan.perez@test.com',       'Juan Pérez'),
    ('maria.garcia@test.com',     'María García'),
    ('carlos.rodriguez@test.com', 'Carlos Rodríguez'),
    ('ana.martinez@test.com',     'Ana Martínez'),
    ('luis.hernandez@test.com',   'Luis Hernández'),
    ('sofia.lopez@test.com',      'Sofía López')
  ) as t(email, full_name)
  where not exists (select 1 from auth.users u where u.email = t.email)
  returning id, email
)
update perfiles p
set sexo             = d.sexo,
    fecha_nacimiento = d.fecha_nacimiento,
    altura_cm        = d.altura_cm,
    plan_membresia   = d.plan_membresia
from nuevos n
join (values
  ('juan.perez@test.com',       'masculino', date '1995-03-12', 178.0, 'premium'),
  ('maria.garcia@test.com',     'femenino',  date '1998-07-22', 165.0, 'basico'),
  ('carlos.rodriguez@test.com', 'masculino', date '1990-11-05', 182.0, 'premium'),
  ('ana.martinez@test.com',     'femenino',  date '2000-01-30', 160.0, 'basico'),
  ('luis.hernandez@test.com',   'masculino', date '1988-05-18', 175.0, 'basico'),
  ('sofia.lopez@test.com',      'femenino',  date '1996-09-09', 168.0, 'premium')
) as d(email, sexo, fecha_nacimiento, altura_cm, plan_membresia)
  on d.email = n.email
where p.id = n.id;

-- Verifica el resultado
select id, nombre_completo, sexo, fecha_nacimiento, altura_cm, plan_membresia, created_at
from perfiles
order by created_at desc
limit 10;
