-- ============================================================
-- MyFitTrack — Schema completo
-- Pegar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PERFILES
-- ============================================================
create table perfiles (
  id               uuid        references auth.users(id) on delete cascade primary key,
  nombre_completo  text,
  sexo             text        check (sexo in ('masculino', 'femenino', 'otro')),
  fecha_nacimiento date,
  altura_cm        numeric(5,1),
  avatar_url       text,
  plan_membresia   text        not null default 'basico'
                               check (plan_membresia in ('basico', 'premium')),
  created_at       timestamptz not null default now()
);

-- Crea el perfil automáticamente cuando el usuario se registra
create or replace function crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer as $$
begin
  insert into public.perfiles (id, nombre_completo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure crear_perfil_nuevo_usuario();

-- ============================================================
-- 2. CATÁLOGO DE EJERCICIOS (lo gestiona el coach/admin)
-- ============================================================
create table ejercicios (
  id                 uuid        default uuid_generate_v4() primary key,
  nombre             text        not null,
  emoji              text        not null default '💪',
  grupo_muscular     text,
  grupos_secundarios text[]      not null default '{}',
  descripcion        text,
  instrucciones      text,
  -- Para videos de YouTube o Vimeo pega el link directo
  -- Para videos propios sube el archivo al bucket 'videos-ejercicios'
  -- y guarda la URL pública aquí también
  video_url          text,
  -- Ruta dentro del bucket de Supabase Storage (ej: 'press-banca.mp4')
  -- Útil para generar URLs firmadas o eliminar archivos
  video_storage_path text,
  created_at         timestamptz not null default now()
);

-- ============================================================
-- 3. RUTINAS
-- ============================================================
create table rutinas (
  id           uuid        default uuid_generate_v4() primary key,
  user_id      uuid        references auth.users(id) on delete cascade not null,
  nombre       text        not null,
  fecha_inicio date,
  fecha_fin    date,
  activa       boolean     not null default true,
  created_at   timestamptz not null default now()
);

create table rutina_dias (
  id          uuid    default uuid_generate_v4() primary key,
  rutina_id   uuid    references rutinas(id) on delete cascade not null,
  numero_dia  int     not null check (numero_dia between 1 and 7),
  nombre_dia  text    not null,
  es_descanso boolean not null default false
);

create table rutina_ejercicios (
  id               uuid          default uuid_generate_v4() primary key,
  dia_id           uuid          references rutina_dias(id) on delete cascade not null,
  ejercicio_id     uuid          references ejercicios(id) not null,
  orden            int           not null,
  series           int,
  repeticiones     text,
  peso_sugerido_kg numeric(6,2),
  descanso_seg     int,
  rir              int
);

create table dias_completados (
  id         uuid        default uuid_generate_v4() primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  dia_id     uuid        references rutina_dias(id) on delete cascade not null,
  fecha      date        not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, dia_id, fecha)
);

create table registros_ejercicio (
  id                  uuid        default uuid_generate_v4() primary key,
  user_id             uuid        references auth.users(id) on delete cascade not null,
  rutina_ejercicio_id uuid        references rutina_ejercicios(id) on delete cascade not null,
  fecha               date        not null default current_date,
  peso_usado_kg       numeric(6,2),
  repeticiones_reales int,
  series_completadas  int,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- 4. MEDIDAS / PROGRESO
-- ============================================================
create table medidas (
  id                uuid        default uuid_generate_v4() primary key,
  user_id           uuid        references auth.users(id) on delete cascade not null,
  fecha             date        not null default current_date,
  peso_kg           numeric(5,2),
  cintura_cm        numeric(5,1),
  cadera_cm         numeric(5,1),
  masa_muscular_pct numeric(4,1),
  grasa_pct         numeric(4,1),
  brazo_cm          numeric(5,1),
  pantorrilla_cm    numeric(5,1),
  -- La app calcula: peso_kg / (altura_cm / 100)^2 y lo manda ya calculado
  imc               numeric(5,2),
  created_at        timestamptz not null default now()
);

-- ============================================================
-- 5. PLAN NUTRICIONAL
-- ============================================================
create table planes_nutricionales (
  id          uuid        default uuid_generate_v4() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  objetivo    text,
  descripcion text,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now()
);

create table plan_equivalentes (
  id         uuid default uuid_generate_v4() primary key,
  plan_id    uuid references planes_nutricionales(id) on delete cascade not null,
  grupo      text not null,
  icono      text,
  desayuno   int  not null default 0,
  colacion_1 int  not null default 0,
  comida     int  not null default 0,
  colacion_2 int  not null default 0,
  cena       int  not null default 0
);

-- ============================================================
-- 6. RECETAS
-- ============================================================
create table recetas (
  id                   uuid        default uuid_generate_v4() primary key,
  nombre               text        not null,
  emoji                text,
  tipo                 text        check (tipo in ('Desayuno', 'Almuerzo', 'Cena', 'Snack')),
  categoria_nutricional text,
  tags                 text,
  tiempo_prep_min      int,
  tiempo_coccion_min   int,
  tiempo_min           int,
  nivel                text        check (nivel in ('Fácil', 'Medio', 'Difícil')),
  calorias             int,
  porciones            text,
  proteinas_g          numeric(5,1),
  carbohidratos_g      numeric(5,1),
  grasas_g             numeric(5,1),
  created_at           timestamptz not null default now()
);

create table receta_ingredientes (
  id          uuid default uuid_generate_v4() primary key,
  receta_id   uuid references recetas(id) on delete cascade not null,
  orden       int  not null,
  descripcion text not null
);

create table receta_pasos (
  id          uuid default uuid_generate_v4() primary key,
  receta_id   uuid references recetas(id) on delete cascade not null,
  numero      int  not null,
  descripcion text not null
);

create table recetas_guardadas (
  user_id    uuid        references auth.users(id) on delete cascade not null,
  receta_id  uuid        references recetas(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (user_id, receta_id)
);

-- ============================================================
-- 7. SUPLEMENTACIÓN
-- ============================================================
create table suplementos (
  id          uuid        default uuid_generate_v4() primary key,
  nombre      text        not null,
  icono       text        not null default '💊',
  descripcion text,
  created_at  timestamptz not null default now()
);

create table plan_suplementacion (
  id            uuid  default uuid_generate_v4() primary key,
  user_id       uuid  references auth.users(id) on delete cascade not null,
  suplemento_id uuid  references suplementos(id) not null,
  dosis         text,
  hora          time,
  momento       text
);

create table suplemento_logs (
  id                 uuid        default uuid_generate_v4() primary key,
  user_id            uuid        references auth.users(id) on delete cascade not null,
  plan_suplemento_id uuid        references plan_suplementacion(id) on delete cascade not null,
  fecha              date        not null default current_date,
  tomado             boolean     not null default false,
  created_at         timestamptz not null default now(),
  unique (user_id, plan_suplemento_id, fecha)
);

create table recordatorios_agua (
  user_id uuid    references auth.users(id) on delete cascade primary key,
  activo  boolean not null default false,
  hora    time    not null default '08:00:00'
);

-- ============================================================
-- 8. RLS — Row Level Security
-- ============================================================

-- perfiles
alter table perfiles enable row level security;
create policy "perfil: usuario gestiona el suyo"
  on perfiles for all using (auth.uid() = id);
create policy "perfiles: lectura para autenticados"
  on perfiles for select using (auth.role() = 'authenticated');

-- ejercicios (catálogo global: lectura para usuarios, gestión desde admin-web)
alter table ejercicios enable row level security;
create policy "ejercicios: lectura para autenticados"
  on ejercicios for select using (auth.role() = 'authenticated');
create policy "ejercicios: gestion para autenticados"
  on ejercicios for insert with check (auth.role() = 'authenticated');
create policy "ejercicios: actualizacion para autenticados"
  on ejercicios for update using (auth.role() = 'authenticated');
create policy "ejercicios: eliminacion para autenticados"
  on ejercicios for delete using (auth.role() = 'authenticated');

-- rutinas
alter table rutinas enable row level security;
create policy "rutinas: usuario gestiona las suyas"
  on rutinas for all using (auth.uid() = user_id);
create policy "rutinas: gestion para autenticados"
  on rutinas for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- rutina_dias
alter table rutina_dias enable row level security;
create policy "rutina_dias: acceso via rutina propia"
  on rutina_dias for all using (
    exists (
      select 1 from rutinas r
      where r.id = rutina_dias.rutina_id
        and r.user_id = auth.uid()
    )
  );
create policy "rutina_dias: gestion para autenticados"
  on rutina_dias for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- rutina_ejercicios
alter table rutina_ejercicios enable row level security;
create policy "rutina_ejercicios: acceso via dia propio"
  on rutina_ejercicios for all using (
    exists (
      select 1 from rutina_dias rd
      join rutinas r on r.id = rd.rutina_id
      where rd.id = rutina_ejercicios.dia_id
        and r.user_id = auth.uid()
    )
  );
create policy "rutina_ejercicios: gestion para autenticados"
  on rutina_ejercicios for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- dias_completados
alter table dias_completados enable row level security;
create policy "dias_completados: usuario gestiona los suyos"
  on dias_completados for all using (auth.uid() = user_id);

-- registros_ejercicio
alter table registros_ejercicio enable row level security;
create policy "registros: usuario gestiona los suyos"
  on registros_ejercicio for all using (auth.uid() = user_id);

-- medidas
alter table medidas enable row level security;
create policy "medidas: usuario gestiona las suyas"
  on medidas for all using (auth.uid() = user_id);

-- planes_nutricionales
alter table planes_nutricionales enable row level security;
create policy "planes: usuario ve el suyo"
  on planes_nutricionales for all using (auth.uid() = user_id);

-- plan_equivalentes
alter table plan_equivalentes enable row level security;
create policy "equivalentes: acceso via plan propio"
  on plan_equivalentes for all using (
    exists (
      select 1 from planes_nutricionales p
      where p.id = plan_equivalentes.plan_id
        and p.user_id = auth.uid()
    )
  );

-- recetas (catálogo global: lectura para usuarios, gestión desde admin-web)
alter table recetas enable row level security;
create policy "recetas: lectura para autenticados"
  on recetas for select using (auth.role() = 'authenticated');
create policy "recetas: gestion para autenticados"
  on recetas for insert with check (auth.role() = 'authenticated');
create policy "recetas: actualizacion para autenticados"
  on recetas for update using (auth.role() = 'authenticated');
create policy "recetas: eliminacion para autenticados"
  on recetas for delete using (auth.role() = 'authenticated');

alter table receta_ingredientes enable row level security;
create policy "ingredientes: lectura para autenticados"
  on receta_ingredientes for select using (auth.role() = 'authenticated');
create policy "ingredientes: gestion para autenticados"
  on receta_ingredientes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table receta_pasos enable row level security;
create policy "pasos: lectura para autenticados"
  on receta_pasos for select using (auth.role() = 'authenticated');
create policy "pasos: gestion para autenticados"
  on receta_pasos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- recetas_guardadas
alter table recetas_guardadas enable row level security;
create policy "guardadas: usuario gestiona las suyas"
  on recetas_guardadas for all using (auth.uid() = user_id);

-- suplementos (catálogo global, solo lectura)
alter table suplementos enable row level security;
create policy "suplementos: lectura para autenticados"
  on suplementos for select using (auth.role() = 'authenticated');

-- plan_suplementacion
alter table plan_suplementacion enable row level security;
create policy "plan_supp: usuario ve el suyo"
  on plan_suplementacion for all using (auth.uid() = user_id);

-- suplemento_logs
alter table suplemento_logs enable row level security;
create policy "supp_logs: usuario gestiona los suyos"
  on suplemento_logs for all using (auth.uid() = user_id);

-- recordatorios_agua
alter table recordatorios_agua enable row level security;
create policy "agua: usuario gestiona el suyo"
  on recordatorios_agua for all using (auth.uid() = user_id);

-- ============================================================
-- 9. ÍNDICES (rendimiento en consultas frecuentes)
-- ============================================================
create index on medidas            (user_id, fecha desc);
create index on registros_ejercicio(user_id, fecha desc);
create index on dias_completados   (user_id, fecha desc);
create index on suplemento_logs    (user_id, fecha);
create index on rutinas            (user_id);
create index on rutina_dias        (rutina_id, numero_dia);
create index on rutina_ejercicios  (dia_id, orden);
create index on plan_equivalentes  (plan_id);
create index on receta_ingredientes(receta_id, orden);
create index on receta_pasos       (receta_id, numero);

-- ============================================================
-- 10. MIGRACIÓN — si la tabla "ejercicios" ya existe, correr esto
-- (agrega grupos secundarios y permisos de gestión desde admin-web)
-- ============================================================
alter table ejercicios
  add column if not exists grupos_secundarios text[] not null default '{}';

drop policy if exists "ejercicios: gestion para autenticados" on ejercicios;
create policy "ejercicios: gestion para autenticados"
  on ejercicios for insert with check (auth.role() = 'authenticated');

drop policy if exists "ejercicios: actualizacion para autenticados" on ejercicios;
create policy "ejercicios: actualizacion para autenticados"
  on ejercicios for update using (auth.role() = 'authenticated');

drop policy if exists "ejercicios: eliminacion para autenticados" on ejercicios;
create policy "ejercicios: eliminacion para autenticados"
  on ejercicios for delete using (auth.role() = 'authenticated');

-- Storage: bucket público para videos de ejercicios (subido desde admin-web)
insert into storage.buckets (id, name, public)
values ('videos-ejercicios', 'videos-ejercicios', true)
on conflict (id) do nothing;

drop policy if exists "videos-ejercicios: lectura publica" on storage.objects;
create policy "videos-ejercicios: lectura publica"
  on storage.objects for select using (bucket_id = 'videos-ejercicios');

drop policy if exists "videos-ejercicios: gestion autenticados" on storage.objects;
create policy "videos-ejercicios: gestion autenticados"
  on storage.objects for all
  using (bucket_id = 'videos-ejercicios' and auth.role() = 'authenticated')
  with check (bucket_id = 'videos-ejercicios' and auth.role() = 'authenticated');

-- ============================================================
-- 11. MIGRACIÓN — si la tabla "recetas" ya existe, correr esto
-- (agrega campos nutricionales/tiempos y permisos de gestión desde admin-web)
-- ============================================================
alter table recetas
  add column if not exists tipo                  text check (tipo in ('Desayuno', 'Almuerzo', 'Cena', 'Snack')),
  add column if not exists categoria_nutricional text,
  add column if not exists tags                  text,
  add column if not exists tiempo_prep_min       int,
  add column if not exists tiempo_coccion_min    int,
  add column if not exists tiempo_min            int,
  add column if not exists nivel                 text check (nivel in ('Fácil', 'Medio', 'Difícil')),
  add column if not exists porciones             text,
  add column if not exists proteinas_g           numeric(5,1),
  add column if not exists carbohidratos_g       numeric(5,1),
  add column if not exists grasas_g              numeric(5,1);

drop policy if exists "recetas: gestion para autenticados" on recetas;
create policy "recetas: gestion para autenticados"
  on recetas for insert with check (auth.role() = 'authenticated');

drop policy if exists "recetas: actualizacion para autenticados" on recetas;
create policy "recetas: actualizacion para autenticados"
  on recetas for update using (auth.role() = 'authenticated');

drop policy if exists "recetas: eliminacion para autenticados" on recetas;
create policy "recetas: eliminacion para autenticados"
  on recetas for delete using (auth.role() = 'authenticated');

drop policy if exists "ingredientes: gestion para autenticados" on receta_ingredientes;
create policy "ingredientes: gestion para autenticados"
  on receta_ingredientes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "pasos: gestion para autenticados" on receta_pasos;
create policy "pasos: gestion para autenticados"
  on receta_pasos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- 12. MIGRACIÓN — gestión de rutinas desde admin-web
-- (permite a admin-web listar perfiles y administrar la rutina de cualquier usuario)
-- ============================================================
drop policy if exists "perfiles: lectura para autenticados" on perfiles;
create policy "perfiles: lectura para autenticados"
  on perfiles for select using (auth.role() = 'authenticated');

drop policy if exists "rutinas: gestion para autenticados" on rutinas;
create policy "rutinas: gestion para autenticados"
  on rutinas for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "rutina_dias: gestion para autenticados" on rutina_dias;
create policy "rutina_dias: gestion para autenticados"
  on rutina_dias for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "rutina_ejercicios: gestion para autenticados" on rutina_ejercicios;
create policy "rutina_ejercicios: gestion para autenticados"
  on rutina_ejercicios for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- 13. MIGRACIÓN — citas + gestión de medidas/nutrición desde admin-web
-- (agrega la tabla de citas y permite a admin-web administrar
-- medidas, planes nutricionales y equivalentes de cualquier usuario)
-- ============================================================
create table if not exists citas (
  id          uuid        default uuid_generate_v4() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  fecha       date        not null,
  hora        time        not null,
  tipo        text        not null check (tipo in ('Nutrición', 'Entrenamiento', 'Seguimiento')),
  profesional text,
  modalidad   text        check (modalidad in ('Presencial', 'En línea')),
  notas       text,
  estado      text        not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'cancelada')),
  created_at  timestamptz not null default now()
);
create index if not exists citas_user_fecha_idx on citas (user_id, fecha);

alter table citas enable row level security;
drop policy if exists "citas: usuario gestiona las suyas" on citas;
create policy "citas: usuario gestiona las suyas"
  on citas for all using (auth.uid() = user_id);
drop policy if exists "citas: gestion para autenticados" on citas;
create policy "citas: gestion para autenticados"
  on citas for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "medidas: gestion para autenticados" on medidas;
create policy "medidas: gestion para autenticados"
  on medidas for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "planes: gestion para autenticados" on planes_nutricionales;
create policy "planes: gestion para autenticados"
  on planes_nutricionales for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "equivalentes: gestion para autenticados" on plan_equivalentes;
create policy "equivalentes: gestion para autenticados"
  on plan_equivalentes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- 14. MIGRACIÓN — recetas_guardadas accesible desde admin-web
-- ============================================================
drop policy if exists "guardadas: gestion para autenticados" on recetas_guardadas;
create policy "guardadas: gestion para autenticados"
  on recetas_guardadas for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- 15. MIGRACIÓN — columna rol en perfiles (usuario vs admin)
-- Los usuarios registrados desde móvil obtienen 'usuario' (default).
-- Solo los marcados manualmente como 'admin' pueden acceder a admin-web.
-- ============================================================
alter table perfiles add column if not exists rol text not null default 'usuario'
  check (rol in ('usuario', 'admin'));

-- ============================================================
-- 16. MIGRACIÓN — bucket público para avatares de usuario
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars: lectura publica" on storage.objects;
create policy "avatars: lectura publica"
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "avatars: gestion autenticados" on storage.objects;
create policy "avatars: gestion autenticados"
  on storage.objects for all
  using (bucket_id = 'avatars' and auth.role() = 'authenticated')
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- ============================================================
-- 17. MIGRACIÓN — perfiles: escritura para autenticados
-- admin-web necesita actualizar perfiles de cualquier usuario
-- (información personal, rol, etc.)
-- ============================================================
drop policy if exists "perfiles: gestion para autenticados" on perfiles;
create policy "perfiles: gestion para autenticados"
  on perfiles for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- 18. MIGRACIÓN — columna email en perfiles + actualizar trigger
-- ============================================================
alter table perfiles add column if not exists email text;

update perfiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer as $$
begin
  insert into public.perfiles (id, nombre_completo, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email
  );
  return new;
end;
$$;

-- ============================================================
-- 19. MIGRACIÓN — suplementos: columnas nuevas + escritura admin
-- ============================================================
alter table suplementos add column if not exists marca text;
alter table suplementos add column if not exists gramaje text;
alter table suplementos add column if not exists imagen_url text;

drop policy if exists "suplementos: gestion para autenticados" on suplementos;
create policy "suplementos: gestion para autenticados"
  on suplementos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "plan_supp: gestion para autenticados" on plan_suplementacion;
create policy "plan_supp: gestion para autenticados"
  on plan_suplementacion for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- 20. MIGRACIÓN — historial de pesos por ejercicio
-- ============================================================
create table if not exists ejercicio_logs (
  id            uuid        default uuid_generate_v4() primary key,
  user_id       uuid        references auth.users(id) on delete cascade not null,
  ejercicio_id  uuid        references ejercicios(id) on delete cascade not null,
  peso_kg       numeric(6,2) not null,
  fecha         date        not null default current_date,
  created_at    timestamptz not null default now()
);
create index if not exists ejercicio_logs_user_ej_idx on ejercicio_logs (user_id, ejercicio_id, fecha);

alter table ejercicio_logs enable row level security;
create policy "ej_logs: usuario gestiona los suyos"
  on ejercicio_logs for all using (auth.uid() = user_id);
create policy "ej_logs: gestion para autenticados"
  on ejercicio_logs for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- 21. MIGRACIÓN — columna telefono en perfiles
-- ============================================================
alter table perfiles add column if not exists telefono text;

-- ============================================================
-- 22. MIGRACIÓN — tabla dietocalculo para guardar cálculos nutricionales
-- ============================================================
create table if not exists dietocalculo (
  id              uuid        default uuid_generate_v4() primary key,
  user_id         uuid        references auth.users(id) on delete cascade not null,
  formula         text        not null,
  actividad       text        not null,
  objetivo        text        not null default 'mantenimiento',
  nivel_pct       numeric(4,1) default 0,
  geb             numeric(8,1),
  eta             numeric(8,1),
  factor_af       numeric(4,3),
  get_total       numeric(8,1),
  get_ajustado    numeric(8,1),
  carbs_gr_kg     numeric(5,2) default 0,
  prote_gr_kg     numeric(5,2) default 0,
  lipidos_gr_kg   numeric(5,2) default 0,
  carbs_kcal      numeric(8,1) default 0,
  prote_kcal      numeric(8,1) default 0,
  lipidos_kcal    numeric(8,1) default 0,
  carbs_pct       numeric(5,1) default 0,
  prote_pct       numeric(5,1) default 0,
  lipidos_pct     numeric(5,1) default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table dietocalculo enable row level security;
create policy "dietocalculo: usuario ve el suyo"
  on dietocalculo for all using (auth.uid() = user_id);
drop policy if exists "dietocalculo: gestion para autenticados" on dietocalculo;
create policy "dietocalculo: gestion para autenticados"
  on dietocalculo for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- 23. MIGRACIÓN — catálogo de alimentos con info nutricional
-- ============================================================
create table if not exists alimentos (
  id            uuid        primary key default uuid_generate_v4(),
  nombre        text        not null,
  categoria     text,
  cantidad      numeric,
  unidad        text,
  peso_bruto_g  numeric,
  peso_neto_g   numeric,
  kcal          numeric,
  proteinas_g   numeric,
  lipidos_g     numeric,
  hco_g         numeric,
  fibra_g       numeric,
  created_at    timestamptz not null default now()
);

alter table alimentos enable row level security;

drop policy if exists "alimentos: lectura para autenticados" on alimentos;
create policy "alimentos: lectura para autenticados"
  on alimentos for select
  using (auth.role() = 'authenticated');

drop policy if exists "alimentos: gestion para autenticados" on alimentos;
create policy "alimentos: gestion para autenticados"
  on alimentos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- 24. MIGRACIÓN — receta_ingredientes: alimento_id, cantidad, unidad
-- ============================================================
alter table receta_ingredientes
  add column if not exists alimento_id uuid references alimentos(id) on delete set null,
  add column if not exists cantidad    numeric,
  add column if not exists unidad      text;

-- ============================================================
-- 25. MIGRACIÓN — rutina_ejercicios: rpe y series_detalle por serie
-- ============================================================
alter table rutina_ejercicios
  add column if not exists rpe            numeric,
  add column if not exists series_detalle jsonb;

-- ============================================================
-- 26. MIGRACIÓN — recetas: user_id y receta_base_id para personalización
-- ============================================================
alter table recetas
  add column if not exists user_id        uuid references auth.users(id) on delete cascade,
  add column if not exists receta_base_id uuid references recetas(id) on delete set null;

-- Índice para búsquedas de copias personales por usuario
create index if not exists idx_recetas_user_base on recetas(user_id, receta_base_id);

-- Política: usuarios leen sus propias recetas personalizadas desde la app móvil
drop policy if exists "recetas: usuario lee las suyas" on recetas;
create policy "recetas: usuario lee las suyas"
  on recetas for select
  using (auth.uid() = user_id);
