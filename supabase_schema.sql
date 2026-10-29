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
-- 27. MIGRACIÓN — Multi-tenant: nutricionista_id en perfiles
-- ============================================================

-- 1. Agregar columna nutricionista_id a perfiles
alter table perfiles add column if not exists nutricionista_id uuid references auth.users(id) on delete set null;

-- 2. Índice para búsquedas por nutricionista
create index if not exists idx_perfiles_nutricionista on perfiles(nutricionista_id);

-- 3. Asignar todos los pacientes existentes al admin temporal (j.rym5312@gmail.com)
--    Esta asignación es provisional; cada nuevo usuario elige su nutriólogo al registrarse.
update perfiles p
set nutricionista_id = au.id
from auth.users au
where au.email = 'j.rym5312@gmail.com'
  and p.rol = 'usuario'
  and p.nutricionista_id is null;

-- 4. Actualizar trigger: leer nutricionista_id de metadata; si no viene, asignar al admin por defecto
create or replace function crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer as $$
declare
  v_nutricionista_id uuid;
begin
  v_nutricionista_id := (new.raw_user_meta_data->>'nutricionista_id')::uuid;

  -- Fallback al admin temporal si no se proveyó nutricionista_id
  if v_nutricionista_id is null then
    select id into v_nutricionista_id
    from auth.users
    where email = 'j.rym5312@gmail.com'
    limit 1;
  end if;

  insert into public.perfiles (id, nombre_completo, email, nutricionista_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    v_nutricionista_id
  );
  return new;
end;
$$;

-- 5. Reemplazar políticas de perfiles por reglas multi-tenant
drop policy if exists "perfiles: gestion para autenticados" on perfiles;
drop policy if exists "perfiles: escritura para autenticados" on perfiles;
drop policy if exists "perfiles: lectura para autenticados" on perfiles;

-- 5a. SELECT: propio perfil / perfiles de admin (selección en app móvil) / pacientes del nutricionista
drop policy if exists "perfiles: lectura multi-tenant" on perfiles;
create policy "perfiles: lectura multi-tenant" on perfiles
  for select using (
    auth.uid() = id
    or rol = 'admin'
    or auth.uid() = nutricionista_id
  );

-- 5b. SELECT público para anónimos: solo perfiles de admin (para lista de nutriólogos en registro)
drop policy if exists "perfiles: admins publicos" on perfiles;
create policy "perfiles: admins publicos" on perfiles
  for select to anon
  using (rol = 'admin');

-- 5c. INSERT: el trigger usa security definer; externamente solo se inserta el propio perfil
drop policy if exists "perfiles: insercion propia" on perfiles;
create policy "perfiles: insercion propia" on perfiles
  for insert with check (auth.uid() = id);

-- 5d. UPDATE: cada quien su perfil; nutricionista puede actualizar sus pacientes
drop policy if exists "perfiles: actualizar multi-tenant" on perfiles;
create policy "perfiles: actualizar multi-tenant" on perfiles
  for update
  using (auth.uid() = id or auth.uid() = nutricionista_id)
  with check (auth.uid() = id or auth.uid() = nutricionista_id);

-- 5e. DELETE: solo propio perfil (la FK cascade de auth.users elimina automáticamente)
drop policy if exists "perfiles: borrar propio" on perfiles;
create policy "perfiles: borrar propio" on perfiles
  for delete using (auth.uid() = id);

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

-- ============================================================
-- 28. MIGRACIÓN — rutinas: unidad de peso (kg/lbs) + tipo de esfuerzo (reps/tiempo) por ejercicio
-- ============================================================
alter table rutinas
  add column if not exists unidad_peso text not null default 'kg'
    check (unidad_peso in ('kg', 'lbs'));

alter table rutina_ejercicios
  add column if not exists tipo_esfuerzo text not null default 'reps'
    check (tipo_esfuerzo in ('reps', 'tiempo'));

-- ============================================================
-- 29. MIGRACIÓN — recetas_guardadas: tiempo de comida por receta asignada
-- ============================================================
alter table recetas_guardadas
  add column if not exists tiempo_comida text not null default 'desayuno'
  check (tiempo_comida in ('desayuno', 'colacion_1', 'comida', 'colacion_2', 'cena'));

-- ============================================================
-- 30. MIGRACIÓN — historia_clinica: datos clínicos completos por usuario
-- ============================================================
create table if not exists historia_clinica (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  datos      jsonb not null default '{}',
  updated_at timestamptz default now()
);

alter table historia_clinica enable row level security;

drop policy if exists "historia_clinica: nutricionista CRUD" on historia_clinica;
create policy "historia_clinica: nutricionista CRUD" on historia_clinica
  for all
  using (
    exists (
      select 1 from perfiles p
      where p.id = historia_clinica.user_id
        and p.nutricionista_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from perfiles p
      where p.id = historia_clinica.user_id
        and p.nutricionista_id = auth.uid()
    )
  );

-- ============================================================
-- 31. MIGRACIÓN — grupo en ingredientes, notas en suplementación
-- ============================================================

-- Grupo de alimento (SMAE) por ingrediente de receta
alter table receta_ingredientes
  add column if not exists grupo text;

-- Notas personalizadas por suplemento asignado
alter table plan_suplementacion
  add column if not exists notas text;

-- ============================================================
-- 32. MIGRACIÓN — Rol SuperAdmin + propietario en catálogos
-- ============================================================

-- Ampliar constraint del rol para incluir 'superadmin'
alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('usuario', 'admin', 'superadmin'));

-- Asignar SuperAdmin al usuario designado
update perfiles set rol = 'superadmin'
  where email = 'j.rym5312@gmail.com';

-- Columna created_by en catálogos (null = legacy/superadmin; DEFAULT auto-seteado por Supabase)
alter table ejercicios
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table recetas
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table alimentos
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ============================================================
-- 33. MIGRACIÓN — Unidad de peso por ejercicio en rutinas
-- ============================================================

alter table rutina_ejercicios
  add column if not exists unidad_peso text default 'kg'
  check (unidad_peso in ('kg', 'lbs'));

-- ============================================================
-- 34. MIGRACIÓN — Recetas: ampliar tipo para incluir 'Comida'
-- ============================================================

alter table recetas drop constraint if exists recetas_tipo_check;
alter table recetas add constraint recetas_tipo_check
  check (tipo in ('Desayuno', 'Almuerzo', 'Cena', 'Colación', 'Comida'));

-- ============================================================
-- 35. MIGRACIÓN — Helper de rol + RLS por propiedad en catálogos
-- ============================================================

-- Función helper: devuelve el rol del usuario autenticado actual
create or replace function public.get_user_rol()
returns text language sql security definer stable as $$
  select rol from perfiles where id = auth.uid()
$$;

-- ── Ejercicios ──────────────────────────────────────────────
-- Eliminar políticas anteriores (si existían abiertas)
drop policy if exists "ejercicios: lectura publica autenticados" on ejercicios;
drop policy if exists "ejercicios: escritura autenticados" on ejercicios;
drop policy if exists "ejercicios: todos autenticados" on ejercicios;

-- SELECT: superadmin ve null/superadmin; admin ve null/superadmin + propios
create policy "ejercicios_select" on ejercicios
for select to authenticated using (
  (public.get_user_rol() = 'superadmin' and (
    created_by is null or
    exists (select 1 from perfiles where id = ejercicios.created_by and rol = 'superadmin')
  ))
  or
  (public.get_user_rol() = 'admin' and (
    created_by is null or
    exists (select 1 from perfiles where id = ejercicios.created_by and rol = 'superadmin') or
    created_by = auth.uid()
  ))
);

-- INSERT: cualquier admin/superadmin puede crear (created_by se auto-asigna vía DEFAULT auth.uid())
create policy "ejercicios_insert" on ejercicios
for insert to authenticated with check (
  public.get_user_rol() in ('admin', 'superadmin')
);

-- UPDATE: superadmin modifica los suyos (null o superadmin); admin solo los propios
create policy "ejercicios_update" on ejercicios
for update to authenticated using (
  (public.get_user_rol() = 'superadmin' and (
    created_by is null or
    exists (select 1 from perfiles where id = ejercicios.created_by and rol = 'superadmin')
  ))
  or
  (public.get_user_rol() = 'admin' and created_by = auth.uid())
);

-- DELETE: igual que UPDATE
create policy "ejercicios_delete" on ejercicios
for delete to authenticated using (
  (public.get_user_rol() = 'superadmin' and (
    created_by is null or
    exists (select 1 from perfiles where id = ejercicios.created_by and rol = 'superadmin')
  ))
  or
  (public.get_user_rol() = 'admin' and created_by = auth.uid())
);

-- ── Recetas (catálogo) ──────────────────────────────────────
drop policy if exists "recetas: lectura publica autenticados" on recetas;
drop policy if exists "recetas: escritura autenticados" on recetas;
drop policy if exists "recetas: todos autenticados" on recetas;

-- SELECT: catálogo (user_id null) visible para todos; personalizadas para el nutricionista del paciente
create policy "recetas_select" on recetas
for select to authenticated using (
  (user_id is null and public.get_user_rol() in ('admin', 'superadmin'))
  or
  (user_id is not null and exists (
    select 1 from perfiles p
    where p.id = recetas.user_id
    and p.nutricionista_id = auth.uid()
  ))
);

-- INSERT: admins/superadmins crean recetas de catálogo; nutricionistas crean copias personalizadas
create policy "recetas_insert" on recetas
for insert to authenticated with check (
  public.get_user_rol() in ('admin', 'superadmin')
  or exists (
    select 1 from perfiles p
    where p.id = recetas.user_id
    and p.nutricionista_id = auth.uid()
  )
);

-- UPDATE: superadmin modifica cualquier catálogo; admin modifica las propias; nutricionista las personalizadas de sus pacientes
create policy "recetas_update" on recetas
for update to authenticated using (
  (user_id is null and public.get_user_rol() = 'superadmin')
  or (user_id is null and public.get_user_rol() = 'admin' and created_by = auth.uid())
  or (user_id is not null and exists (
    select 1 from perfiles p
    where p.id = recetas.user_id
    and p.nutricionista_id = auth.uid()
  ))
);

-- DELETE: igual que UPDATE
create policy "recetas_delete" on recetas
for delete to authenticated using (
  (user_id is null and public.get_user_rol() = 'superadmin')
  or (user_id is null and public.get_user_rol() = 'admin' and created_by = auth.uid())
  or (user_id is not null and exists (
    select 1 from perfiles p
    where p.id = recetas.user_id
    and p.nutricionista_id = auth.uid()
  ))
);

-- ── Alimentos ────────────────────────────────────────────────
drop policy if exists "alimentos: lectura publica autenticados" on alimentos;
drop policy if exists "alimentos: escritura autenticados" on alimentos;
drop policy if exists "alimentos: todos autenticados" on alimentos;

-- SELECT: superadmin ve null/superadmin; admin ve null/superadmin + propios (no ve los de otros admins)
create policy "alimentos_select" on alimentos
for select to authenticated using (
  (public.get_user_rol() = 'superadmin' and (
    created_by is null or
    exists (select 1 from perfiles where id = alimentos.created_by and rol = 'superadmin')
  ))
  or
  (public.get_user_rol() = 'admin' and (
    created_by is null or
    exists (select 1 from perfiles where id = alimentos.created_by and rol = 'superadmin') or
    created_by = auth.uid()
  ))
);

-- INSERT: cualquier admin/superadmin puede crear
create policy "alimentos_insert" on alimentos
for insert to authenticated with check (
  public.get_user_rol() in ('admin', 'superadmin')
);

-- UPDATE: superadmin modifica null/superadmin; admin solo los propios
create policy "alimentos_update" on alimentos
for update to authenticated using (
  (public.get_user_rol() = 'superadmin' and (
    created_by is null or
    exists (select 1 from perfiles where id = alimentos.created_by and rol = 'superadmin')
  ))
  or
  (public.get_user_rol() = 'admin' and created_by = auth.uid())
);

-- DELETE: igual que UPDATE
create policy "alimentos_delete" on alimentos
for delete to authenticated using (
  (public.get_user_rol() = 'superadmin' and (
    created_by is null or
    exists (select 1 from perfiles where id = alimentos.created_by and rol = 'superadmin')
  ))
  or
  (public.get_user_rol() = 'admin' and created_by = auth.uid())
);

-- ============================================================
-- 36. MIGRACIÓN — is_active: habilitar / deshabilitar pacientes
-- ============================================================

-- 1. Columna is_active en perfiles (default true = habilitado)
alter table perfiles add column if not exists is_active boolean not null default true;

-- 2. Helper: ¿está activo el usuario que hace la petición?
create or replace function public.get_current_user_is_active()
returns boolean language sql security definer stable as $$
  select coalesce(is_active, true) from perfiles where id = auth.uid()
$$;

-- 3. Proteger INSERT en tablas de planes:
--    Solo se puede asignar un plan/rutina/suplemento a un paciente activo.
--    Las políticas "for all" existentes se dividen en operaciones separadas.
--    SELECT / UPDATE / DELETE permanecen sin restricción extra (conservar historial).

-- ── Rutinas ──────────────────────────────────────────────────────────────────
drop policy if exists "rutinas: gestion para autenticados"      on rutinas;
create policy "rutinas: select autenticados"    on rutinas for select using (auth.role() = 'authenticated');
create policy "rutinas: update autenticados"    on rutinas for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "rutinas: delete autenticados"    on rutinas for delete using (auth.role() = 'authenticated');
create policy "rutinas: insert paciente activo" on rutinas for insert with check (
  auth.role() = 'authenticated' and
  exists (select 1 from perfiles where id = rutinas.user_id and is_active = true)
);

-- ── Planes nutricionales ──────────────────────────────────────────────────────
drop policy if exists "planes: gestion para autenticados"       on planes_nutricionales;
create policy "planes: select autenticados"    on planes_nutricionales for select using (auth.role() = 'authenticated');
create policy "planes: update autenticados"    on planes_nutricionales for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "planes: delete autenticados"    on planes_nutricionales for delete using (auth.role() = 'authenticated');
create policy "planes: insert paciente activo" on planes_nutricionales for insert with check (
  auth.role() = 'authenticated' and
  exists (select 1 from perfiles where id = planes_nutricionales.user_id and is_active = true)
);

-- ── Plan suplementación ───────────────────────────────────────────────────────
drop policy if exists "plan_supp: gestion para autenticados"    on plan_suplementacion;
create policy "plan_supp: select autenticados"    on plan_suplementacion for select using (auth.role() = 'authenticated');
create policy "plan_supp: update autenticados"    on plan_suplementacion for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "plan_supp: delete autenticados"    on plan_suplementacion for delete using (auth.role() = 'authenticated');
create policy "plan_supp: insert paciente activo" on plan_suplementacion for insert with check (
  auth.role() = 'authenticated' and
  exists (select 1 from perfiles where id = plan_suplementacion.user_id and is_active = true)
);

-- ── Citas ─────────────────────────────────────────────────────────────────────
drop policy if exists "citas: gestion para autenticados"        on citas;
create policy "citas: select autenticados"    on citas for select using (auth.role() = 'authenticated');
create policy "citas: update autenticados"    on citas for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "citas: delete autenticados"    on citas for delete using (auth.role() = 'authenticated');
create policy "citas: insert paciente activo" on citas for insert with check (
  auth.role() = 'authenticated' and
  exists (select 1 from perfiles where id = citas.user_id and is_active = true)
);

-- ============================================================
-- 37. MIGRACIÓN — CHECK constraints: valores numéricos >= 0
-- ============================================================

-- perfiles: altura no puede ser negativa
alter table perfiles
  add constraint perfiles_altura_cm_non_neg  check (altura_cm  >= 0);

-- medidas: todas las medidas corporales deben ser >= 0
alter table medidas
  add constraint medidas_peso_kg_non_neg       check (peso_kg           >= 0),
  add constraint medidas_cintura_cm_non_neg    check (cintura_cm        >= 0),
  add constraint medidas_cadera_cm_non_neg     check (cadera_cm         >= 0),
  add constraint medidas_masa_musc_non_neg     check (masa_muscular_pct >= 0),
  add constraint medidas_grasa_pct_non_neg     check (grasa_pct         >= 0),
  add constraint medidas_brazo_cm_non_neg      check (brazo_cm          >= 0),
  add constraint medidas_pantorrilla_non_neg   check (pantorrilla_cm    >= 0),
  add constraint medidas_imc_non_neg           check (imc               >= 0);

-- alimentos: valores nutricionales >= 0
alter table alimentos
  add constraint alimentos_cantidad_non_neg    check (cantidad     >= 0),
  add constraint alimentos_peso_bruto_non_neg  check (peso_bruto_g >= 0),
  add constraint alimentos_peso_neto_non_neg   check (peso_neto_g  >= 0),
  add constraint alimentos_kcal_non_neg        check (kcal         >= 0),
  add constraint alimentos_proteinas_non_neg   check (proteinas_g  >= 0),
  add constraint alimentos_lipidos_non_neg     check (lipidos_g    >= 0),
  add constraint alimentos_hco_non_neg         check (hco_g        >= 0),
  add constraint alimentos_fibra_non_neg       check (fibra_g      >= 0);

-- rutina_ejercicios: parámetros de entrenamiento >= 0 (series ya tiene CHECK >= 1 implícito por min en UI)
alter table rutina_ejercicios
  add constraint rutina_ej_peso_non_neg     check (peso_sugerido_kg >= 0),
  add constraint rutina_ej_descanso_non_neg check (descanso_seg     >= 0),
  add constraint rutina_ej_rir_non_neg      check (rir              >= 0),
  add constraint rutina_ej_rpe_non_neg      check (rpe              >= 0);

-- plan_equivalentes: raciones por tiempo de comida >= 0
alter table plan_equivalentes
  add constraint plan_eq_desayuno_non_neg   check (desayuno   >= 0),
  add constraint plan_eq_colacion1_non_neg  check (colacion_1 >= 0),
  add constraint plan_eq_comida_non_neg     check (comida     >= 0),
  add constraint plan_eq_colacion2_non_neg  check (colacion_2 >= 0),
  add constraint plan_eq_cena_non_neg       check (cena       >= 0);

-- receta_ingredientes: cantidad >= 0
alter table receta_ingredientes
  add constraint receta_ing_cantidad_non_neg check (cantidad >= 0);

-- ============================================================
-- 38. MIGRACIÓN — estatus de pacientes: pendiente / aprobado / rechazado
-- ============================================================

-- 1. Columna estatus en perfiles (default 'pendiente' para nuevos registros)
alter table perfiles
  add column if not exists estatus text not null default 'pendiente'
  check (estatus in ('pendiente', 'aprobado', 'rechazado'));

-- 2. Usuarios existentes activos (is_active = true) → aprobado
update perfiles
  set estatus = 'aprobado'
  where is_active = true;

-- 3. Usuarios existentes deshabilitados (is_active = false) y rol usuario → rechazado
update perfiles
  set estatus = 'rechazado'
  where is_active = false and rol = 'usuario' and estatus = 'pendiente';

-- 4. Admin y superadmin siempre aprobados (independientemente de is_active)
update perfiles
  set estatus = 'aprobado'
  where rol in ('admin', 'superadmin');

-- 5. Actualizar trigger: nuevos registros desde móvil inician como pendiente + is_active = false
create or replace function crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer as $$
declare
  v_nutricionista_id uuid;
begin
  v_nutricionista_id := (new.raw_user_meta_data->>'nutricionista_id')::uuid;

  if v_nutricionista_id is null then
    select id into v_nutricionista_id
    from auth.users
    where email = 'j.rym5312@gmail.com'
    limit 1;
  end if;

  insert into public.perfiles (id, nombre_completo, email, nutricionista_id, is_active, estatus)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    v_nutricionista_id,
    false,        -- bloqueado hasta que el nutriólogo apruebe
    'pendiente'
  );
  return new;
end;
$$;

-- 6. Ampliar política UPDATE de perfiles: superadmin puede actualizar cualquier perfil
drop policy if exists "perfiles: actualizar multi-tenant" on perfiles;
create policy "perfiles: actualizar multi-tenant" on perfiles
  for update
  using (
    auth.uid() = id
    or auth.uid() = nutricionista_id
    or public.get_user_rol() = 'superadmin'
  )
  with check (
    auth.uid() = id
    or auth.uid() = nutricionista_id
    or public.get_user_rol() = 'superadmin'
  );

-- 7. Actualizar políticas INSERT de tablas de asignación:
--    solo pacientes aprobados Y activos pueden recibir planes/rutinas/suplementos/citas.

drop policy if exists "rutinas: insert paciente activo" on rutinas;
create policy "rutinas: insert paciente activo" on rutinas for insert with check (
  auth.role() = 'authenticated' and
  exists (
    select 1 from perfiles
    where id = rutinas.user_id
      and is_active = true
      and estatus = 'aprobado'
  )
);

drop policy if exists "planes: insert paciente activo" on planes_nutricionales;
create policy "planes: insert paciente activo" on planes_nutricionales for insert with check (
  auth.role() = 'authenticated' and
  exists (
    select 1 from perfiles
    where id = planes_nutricionales.user_id
      and is_active = true
      and estatus = 'aprobado'
  )
);

drop policy if exists "plan_supp: insert paciente activo" on plan_suplementacion;
create policy "plan_supp: insert paciente activo" on plan_suplementacion for insert with check (
  auth.role() = 'authenticated' and
  exists (
    select 1 from perfiles
    where id = plan_suplementacion.user_id
      and is_active = true
      and estatus = 'aprobado'
  )
);

drop policy if exists "citas: insert paciente activo" on citas;
create policy "citas: insert paciente activo" on citas for insert with check (
  auth.role() = 'authenticated' and
  exists (
    select 1 from perfiles
    where id = citas.user_id
      and is_active = true
      and estatus = 'aprobado'
  )
);

-- ============================================================
-- 39. MIGRACIÓN — ejercicio_logs: numero_serie + sesion_id
-- ============================================================
-- Cada serie de un ejercicio queda como fila separada.
-- sesion_id agrupa todas las series de una misma sesión de entrenamiento.
-- numero_serie indica el ordinal de la serie dentro de la sesión (1, 2, 3…).
-- Los registros anteriores quedan con numero_serie = 1 y sesion_id propio.

alter table ejercicio_logs
  add column if not exists numero_serie int not null default 1,
  add column if not exists sesion_id    uuid not null default gen_random_uuid();

create index if not exists ejercicio_logs_sesion_idx
  on ejercicio_logs (sesion_id);

-- ============================================================
-- 40. MIGRACIÓN — ejercicios: created_by DEFAULT auth.uid()
-- ============================================================
-- La columna created_by fue añadida en la sección 32 sin DEFAULT,
-- por lo que cada INSERT dejaba created_by = NULL, haciéndolo visible
-- para todos los admins como si fuera un ejercicio global.
-- Este DEFAULT corrige eso: al insertar sin especificar created_by,
-- el valor queda automáticamente en el UUID del usuario autenticado.
--
-- La política ejercicios_insert también se refuerza para que un admin
-- no pueda crear un ejercicio con created_by ajeno o nulo.

alter table ejercicios
  alter column created_by set default auth.uid();

-- Reforzar la política de INSERT: admin solo puede crear con created_by = auth.uid()
drop policy if exists "ejercicios_insert" on ejercicios;
create policy "ejercicios_insert" on ejercicios
for insert to authenticated with check (
  public.get_user_rol() in ('admin', 'superadmin')
  and (
    public.get_user_rol() = 'superadmin'   -- superadmin puede crear globales (null) o propios
    or created_by = auth.uid()             -- admin solo puede crear los suyos
  )
);

-- ============================================================
-- 41. MIGRACIÓN — integración WorkoutX: nuevos campos en ejercicios
-- ============================================================
-- Objetivo: permitir importar el catálogo externo de WorkoutX
-- sin borrar ni modificar los ejercicios existentes.
-- Los ejercicios manuales conservan source='manual' y external_id=NULL.
-- Los ejercicios WorkoutX tendrán source='workoutx' y external_id=<id WorkoutX>.
--
-- Cambio de tipo: instrucciones TEXT → TEXT[] (migración segura con USING).
-- El campo estaba definido en el DDL original pero nunca fue usado en producción,
-- por lo que la conversión no afecta datos reales.

-- 41a. Nuevos campos de identificación y multimedia
alter table ejercicios
  add column if not exists source          text    not null default 'manual',
  add column if not exists external_id     text,
  add column if not exists gif_url         text;

-- 41b. Constraint de validación de origen
alter table ejercicios
  drop constraint if exists ejercicios_source_check;
alter table ejercicios
  add constraint ejercicios_source_check check (source in ('manual', 'workoutx'));

-- 41c. Backfill: marcar ejercicios existentes como 'manual'
update ejercicios set source = 'manual' where source is distinct from 'workoutx';

-- 41d. Nuevos campos descriptivos de WorkoutX
alter table ejercicios
  add column if not exists body_part            text,
  add column if not exists equipment            text,
  add column if not exists difficulty           text,
  add column if not exists category             text,
  add column if not exists mechanic             text,
  add column if not exists force                text,
  add column if not exists met                  numeric,
  add column if not exists calories_per_minute  numeric,
  add column if not exists is_unilateral        boolean default false,
  add column if not exists popularity_rank      int,
  add column if not exists recommended_sets     text,
  add column if not exists recommended_reps     text,
  add column if not exists joint_focus          text,
  add column if not exists intensity_level      text,
  add column if not exists movement_tags        text[] default '{}',
  add column if not exists language             text   default 'es';

-- 41e. Migración segura de instrucciones: TEXT → TEXT[]
-- Convierte texto existente en un array de un elemento.
-- NULL y texto vacío quedan como array vacío {}.
alter table ejercicios
  alter column instrucciones type text[]
  using (
    case
      when instrucciones is null or btrim(instrucciones) = ''
        then array[]::text[]
      else array[instrucciones]
    end
  );

-- 41f. Índice único parcial: evita importar dos veces el mismo ejercicio de WorkoutX.
-- Los ejercicios manuales no se ven afectados (external_id = NULL).
create unique index if not exists ejercicios_workoutx_external_id_unique
  on ejercicios (external_id)
  where source = 'workoutx';

-- 41g. Índices para filtros del catálogo
-- pg_trgm es necesaria para el índice GIN de búsqueda por nombre (ILIKE '%texto%')
create extension if not exists pg_trgm;

create index if not exists ejercicios_source_idx        on ejercicios (source);
create index if not exists ejercicios_body_part_idx     on ejercicios (body_part);
create index if not exists ejercicios_difficulty_idx    on ejercicios (difficulty);
create index if not exists ejercicios_category_idx      on ejercicios (category);
create index if not exists ejercicios_equipment_idx     on ejercicios (equipment);
create index if not exists ejercicios_nombre_trgm_idx   on ejercicios using gin (nombre gin_trgm_ops);

-- 41h. Política RLS: los ejercicios WorkoutX se comportan igual que los globales.
-- Las políticas existentes ya cubren correctamente este caso:
-- - ejercicios con created_by IS NULL son visibles globalmente (superadmin + admin en lectura).
-- - Los ejercicios WorkoutX se insertan con created_by = NULL (ver Edge Function).
-- - admins normales NO pueden editar/eliminar ejercicios con created_by IS NULL (policy actual).
-- No se modifica ninguna política existente en esta migración.
--
-- Policies activas sobre ejercicios (documentación):
--   ejercicios: lectura para autenticados  → SELECT para cualquier authenticated (legacy, mantener)
--   ejercicios_select                      → SELECT filtrado por rol (migración 35)
--   ejercicios_insert                      → INSERT solo admin/superadmin (migración 40)
--   ejercicios_update                      → UPDATE superadmin(globales) o admin(propios)
--   ejercicios_delete                      → DELETE superadmin(globales) o admin(propios)

-- ============================================================
-- 42. SUPABASE STORAGE — bucket público para GIFs de ejercicios
-- ============================================================
-- Prerrequisito para la Edge Function migrate-gifs.
-- Correr en Supabase Dashboard → Storage → New bucket
--   Nombre: exercise-gifs
--   Public: ON
--
-- O ejecutar via SQL (Storage API no expone CREATE BUCKET en SQL puro —
-- usar el Dashboard es el método recomendado por Supabase para crear buckets).
--
-- Una vez creado el bucket, ejecutar migrate-gifs para:
--   1. Descargar cada GIF de WorkoutX (~1327 requests únicos con WORKOUTX_API_KEY)
--   2. Subirlo al bucket exercise-gifs (público, CDN de Supabase)
--   3. Actualizar gif_url en ejercicios con la URL pública de Storage
--
-- Después de la migración, proxyGifUrl() devuelve la URL de Storage directamente
-- sin necesidad del gif-proxy Edge Function ni del API key de WorkoutX para display.
--
-- Policy de Storage (crear en Dashboard → Storage → Policies → exercise-gifs):
--   Nombre: "GIFs públicos de ejercicios"
--   Operation: SELECT
--   Role: anon, authenticated
--   Policy: bucket_id = 'exercise-gifs'
--
-- No requiere políticas INSERT/UPDATE/DELETE en prod (solo migrate-gifs escribe,
-- y lo hace con service_role que bypasea RLS).
--
-- ESTADO REAL (verificado en producción durante el barrido final de
-- auditoría, H2, 2026-09-02): el bucket "exercise-gifs" NO EXISTE — nunca
-- se creó manualmente en el Dashboard como indican las instrucciones de
-- arriba. No es una exposición activa (no hay nada que asegurar: sin
-- bucket no hay objetos ni políticas que auditar), así que H2 no lo toca.
-- migrate-gifs (supabase/functions/migrate-gifs/index.ts) SÍ asume que el
-- bucket existe — si se invoca hoy, fallaría al intentar subir el primer
-- GIF. Drift documentado como P3 en el backlog de la auditoría: crear el
-- bucket (si migrate-gifs se vuelve a necesitar) o retirar la función si
-- ya no aplica, es una decisión de producto separada, no de seguridad.

-- ============================================================
-- 43. MIGRACIÓN — Registro de pacientes desde admin-web (sin app móvil)
-- ============================================================
-- Permite a un nutriólogo registrar un paciente directamente desde
-- admin-web (Pacientes → "+ Nuevo paciente") sin depender de que el
-- paciente tenga celular o use la app móvil.
--
-- `perfiles.id` referencia auth.users(id), así que no se puede insertar
-- un perfil "de verdad" sin una cuenta de auth. En su lugar, estos
-- pacientes se guardan en la tabla nueva `pacientes_manuales` (sin FK a
-- auth.users) con estatus 'sin_registro_movil'.
--
-- Cuando el paciente eventualmente se registra desde la app móvil con el
-- MISMO correo, el trigger crear_perfil_nuevo_usuario() detecta la
-- coincidencia, crea el perfil real heredando el nutricionista_id y los
-- datos ya capturados, y marca la fila de pacientes_manuales como
-- 'vinculado' (para no duplicar). El perfil resultante queda con
-- estatus = 'pendiente', igual que cualquier registro nuevo, así que
-- sigue el flujo normal de aprobación del nutriólogo en la pestaña
-- Pacientes.
--
-- Este cambio SOLO añade una rama nueva al inicio del trigger para este
-- escenario de reconciliación por correo; el resto de la función (registro
-- normal desde la app móvil, sin paciente pre-registrado en la web) queda
-- byte-por-byte igual a como estaba antes de esta migración.

-- 1. Tabla de pacientes pre-registrados desde admin-web
create table if not exists pacientes_manuales (
  id                uuid        primary key default uuid_generate_v4(),
  nombre            text        not null,
  apellidos         text,
  fecha_nacimiento  date,
  sexo              text        check (sexo in ('masculino', 'femenino', 'otro')),
  telefono          text,
  email             text        not null,
  nutricionista_id  uuid        not null references auth.users(id) on delete cascade,
  estatus           text        not null default 'sin_registro_movil'
                                 check (estatus in ('sin_registro_movil', 'vinculado')),
  perfil_id         uuid        references perfiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_pacientes_manuales_nutricionista
  on pacientes_manuales(nutricionista_id);

-- Evita registrar dos veces el mismo correo en estado "sin_registro_movil"
create unique index if not exists idx_pacientes_manuales_email_pendiente
  on pacientes_manuales (lower(email))
  where estatus = 'sin_registro_movil';

alter table pacientes_manuales enable row level security;

drop policy if exists "pacientes_manuales: select propio" on pacientes_manuales;
create policy "pacientes_manuales: select propio" on pacientes_manuales
  for select using (
    auth.uid() = nutricionista_id
    or public.get_user_rol() = 'superadmin'
  );

drop policy if exists "pacientes_manuales: insert propio" on pacientes_manuales;
create policy "pacientes_manuales: insert propio" on pacientes_manuales
  for insert with check (auth.uid() = nutricionista_id);

drop policy if exists "pacientes_manuales: update propio" on pacientes_manuales;
create policy "pacientes_manuales: update propio" on pacientes_manuales
  for update
  using (auth.uid() = nutricionista_id or public.get_user_rol() = 'superadmin')
  with check (auth.uid() = nutricionista_id or public.get_user_rol() = 'superadmin');

drop policy if exists "pacientes_manuales: delete propio" on pacientes_manuales;
create policy "pacientes_manuales: delete propio" on pacientes_manuales
  for delete using (auth.uid() = nutricionista_id or public.get_user_rol() = 'superadmin');

-- 2. Trigger — rama de reconciliación por correo (única modificación real)
create or replace function crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer as $$
declare
  v_nutricionista_id uuid;
  v_manual pacientes_manuales%rowtype;
begin
  -- ── Reconciliación: ¿ya existe un paciente pre-registrado desde la web
  --    con este mismo correo? Si sí, se vincula en vez de duplicar. ──
  select * into v_manual
  from public.pacientes_manuales
  where lower(email) = lower(new.email)
    and estatus = 'sin_registro_movil'
  limit 1;

  if v_manual.id is not null then
    insert into public.perfiles (
      id, nombre_completo, email, telefono, sexo, fecha_nacimiento,
      nutricionista_id, is_active, estatus
    )
    values (
      new.id,
      coalesce(
        new.raw_user_meta_data->>'full_name',
        nullif(trim(v_manual.nombre || ' ' || coalesce(v_manual.apellidos, '')), ''),
        new.email
      ),
      new.email,
      v_manual.telefono,
      v_manual.sexo,
      v_manual.fecha_nacimiento,
      v_manual.nutricionista_id,
      false,        -- bloqueado hasta que el nutriólogo apruebe
      'pendiente'
    );

    update public.pacientes_manuales
      set estatus = 'vinculado', perfil_id = new.id
      where id = v_manual.id;

    return new;
  end if;

  -- ── Comportamiento original — sin cambios ───────────────────────────
  v_nutricionista_id := (new.raw_user_meta_data->>'nutricionista_id')::uuid;

  if v_nutricionista_id is null then
    select id into v_nutricionista_id
    from auth.users
    where email = 'j.rym5312@gmail.com'
    limit 1;
  end if;

  insert into public.perfiles (id, nombre_completo, email, nutricionista_id, is_active, estatus)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    v_nutricionista_id,
    false,
    'pendiente'
  );
  return new;
end;
$$;

-- ============================================================
-- 44. MIGRACIÓN — Pacientes creados desde admin-web: cuenta real desde el inicio
-- ============================================================
-- Reemplaza el enfoque de la Sección 43. En vez de una tabla satélite
-- (pacientes_manuales) que esperaba a que el paciente se registrara desde
-- el móvil para "ascenderlo" a perfiles, ahora la Edge Function
-- invitar-usuario crea la cuenta de auth.users real desde el momento en
-- que el nutriólogo da de alta al paciente en Pacientes → "+ Nuevo
-- paciente" (supabase.auth.admin.inviteUserByEmail). Esto permite
-- asignarle rutinas, planes y ver su detalle (historial, medidas,
-- próximas citas) de inmediato, sin esperar a que instale la app.
--
-- Por eso esta migración:
--   1. Revierte crear_perfil_nuevo_usuario() a su forma anterior a la
--      Sección 43 (quita la rama de reconciliación por correo contra
--      pacientes_manuales, que ya no se usa — el registro normal desde
--      el móvil, sin preregistro web, sigue exactamente igual).
--   2. Agrega perfiles.movil_vinculado: marcador informativo (no afecta
--      estatus/is_active ni ninguna política existente) que indica si el
--      paciente ya inició sesión alguna vez desde la app móvil. Los
--      perfiles existentes y los que se registran normalmente desde el
--      móvil quedan en true (nunca fueron "pacientes sin app"); los que
--      la Edge Function invitar-usuario crea desde admin-web arrancan en
--      false y la propia app móvil lo pone en true la primera vez que
--      ese usuario abre sesión (ver mobile-app/src/app/_layout.tsx).
--
-- La tabla pacientes_manuales de la Sección 43 queda sin usar (no se
-- borra por si quedó algún registro de prueba); puede eliminarse
-- manualmente con `drop table if exists pacientes_manuales;` una vez
-- confirmado que no se necesita.

-- 1. Revertir el trigger a la versión previa a la Sección 43
create or replace function crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer as $$
declare
  v_nutricionista_id uuid;
begin
  v_nutricionista_id := (new.raw_user_meta_data->>'nutricionista_id')::uuid;

  if v_nutricionista_id is null then
    select id into v_nutricionista_id
    from auth.users
    where email = 'j.rym5312@gmail.com'
    limit 1;
  end if;

  insert into public.perfiles (id, nombre_completo, email, nutricionista_id, is_active, estatus)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    v_nutricionista_id,
    false,        -- bloqueado hasta que el nutriólogo apruebe
    'pendiente'
  );
  return new;
end;
$$;

-- 2. Marcador "ya usó la app móvil" (informativo, no afecta acceso)
alter table perfiles
  add column if not exists movil_vinculado boolean not null default true;

-- Pacientes ya invitados desde admin-web antes de esta migración (si los
-- hubiera) deberían quedar en false hasta su primer login móvil; como no
-- hay forma de distinguirlos retroactivamente, no se tocan filas
-- existentes — el default true es correcto para todo lo ya registrado
-- por la vía normal (móvil), que es la inmensa mayoría de los datos.

-- ============================================================
-- 45. MIGRACIÓN — Proteger columnas sensibles de perfiles
-- ============================================================
-- Contexto: la auditoría técnica del 2026-08-23 (y su verificación
-- contra el Supabase real del 2026-08-24) confirmó que la policy de
-- UPDATE de "perfiles" (Sección 27, "perfiles: actualizar multi-tenant")
-- controla correctamente QUÉ FILA se puede tocar (auth.uid()=id OR
-- auth.uid()=nutricionista_id OR superadmin), pero RLS no puede
-- restringir QUÉ COLUMNAS dentro de esa fila — así que cualquier
-- paciente autenticado podía cambiar su propio rol/estatus/is_active/
-- nutricionista_id/plan_membresia directamente contra la API REST.
--
-- Esta migración NO toca ninguna policy existente (su alcance por fila
-- ya era correcto) — agrega un trigger BEFORE UPDATE que solo actúa
-- cuando alguna de las columnas sensibles realmente cambia de valor:
--
--   - rol, nutricionista_id, stripe_customer_id
--       → exclusivo de superadmin.
--   - estatus, is_active, plan_membresia
--       → superadmin, o el nutriólogo dueño del paciente
--         (auth.uid() = OLD.nutricionista_id), pero NUNCA el propio
--         dueño de la fila sobre sí mismo.
--   - cualquier otra columna (nombre_completo, sexo, fecha_nacimiento,
--     altura_cm, avatar_url, telefono, movil_vinculado, email...)
--     sigue exactamente igual que hoy, sin restricción nueva —
--     confirmado contra cada UPDATE real de perfiles en mobile-app y
--     admin-web antes de escribir esto (ver auditoría).
--   - Las Edge Functions con SUPABASE_SERVICE_ROLE_KEY (invitar-usuario,
--     crear-checkout, stripe-webhook) atraviesan el trigger sin
--     restricción — lo necesitan para escribir estas mismas columnas.

create or replace function public.proteger_columnas_sensibles_perfiles()
returns trigger
language plpgsql
as $$
declare
  v_rol      text;
  v_allowed  boolean;
begin
  -- Edge Functions con service role key: sin restricción.
  if current_user = 'service_role' then
    return new;
  end if;

  v_rol := public.get_user_rol();

  -- rol / nutricionista_id / stripe_customer_id: solo superadmin.
  -- "is distinct from" es NULL-safe: si v_rol es NULL, el resultado es
  -- TRUE (NULL "es distinto de" 'superadmin'), así que SIEMPRE se lanza
  -- la excepción cuando el rol no se pudo determinar — fail-closed.
  if new.rol is distinct from old.rol
     or new.nutricionista_id is distinct from old.nutricionista_id
     or new.stripe_customer_id is distinct from old.stripe_customer_id
  then
    if v_rol is distinct from 'superadmin' then
      raise exception 'No tienes permiso para modificar rol, nutricionista_id o stripe_customer_id.';
    end if;
  end if;

  -- estatus / is_active / plan_membresia: superadmin, o el nutriólogo
  -- dueño del paciente — nunca el propio paciente sobre sí mismo.
  -- v_allowed se construye como un booleano que NUNCA es NULL: cada
  -- comparación que involucra un valor potencialmente NULL (v_rol,
  -- auth.uid(), old.nutricionista_id) queda envuelta en
  -- COALESCE(...,false) o protegida con IS NOT NULL antes de comparar,
  -- y el resultado final se envuelve otra vez en COALESCE por defensa
  -- adicional. Cualquier ambigüedad resuelve a "denegar".
  if new.estatus is distinct from old.estatus
     or new.is_active is distinct from old.is_active
     or new.plan_membresia is distinct from old.plan_membresia
  then
    v_allowed := coalesce(
      coalesce(v_rol = 'superadmin', false)
      or (
        auth.uid() is not null
        and old.nutricionista_id is not null
        and auth.uid() = old.nutricionista_id
        and auth.uid() <> old.id
      ),
      false
    );

    if not v_allowed then
      raise exception 'No tienes permiso para modificar estatus, is_active o plan_membresia de este perfil.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_columnas_sensibles_perfiles on public.perfiles;
create trigger trg_proteger_columnas_sensibles_perfiles
  before update on public.perfiles
  for each row
  execute function public.proteger_columnas_sensibles_perfiles();

-- ============================================================
-- 46. MIGRACIÓN — Cerrar INSERT y DELETE directos en perfiles
-- ============================================================
-- Verificación contra el Supabase real (2026-08-24/25) tras la Sección
-- 45: además de la falta de protección de columnas ya resuelta, se
-- confirmaron TRES policies que permiten a cualquier usuario
-- autenticado escribir su propia fila de "perfiles" fuera del alcance
-- que realmente necesita:
--
--   - "perfil: usuario gestiona el suyo" (Sección 1, FOR ALL, nunca
--     eliminada) — cubre SELECT/INSERT/UPDATE/DELETE con
--     auth.uid()=id. SELECT/UPDATE ya están cubiertos de forma más
--     específica por policies posteriores (Sección 27); su único
--     efecto no redundante es permitir INSERT y DELETE directos.
--   - "perfiles: insercion propia" (Sección 27, FOR INSERT) — el
--     WITH CHECK solo valida auth.uid()=id, sin restringir
--     rol/estatus/is_active/nutricionista_id: un usuario sin fila en
--     perfiles podría insertarse a sí mismo ya como
--     rol='superadmin', estatus='aprobado', is_active=true.
--   - "perfiles: borrar propio" (Sección 27, FOR DELETE) — permite a
--     cualquiera borrar su propia fila.
--
-- Ninguna de las tres tiene un consumidor real: no existe ningún
-- INSERT ni DELETE directo sobre "perfiles" en mobile-app, admin-web
-- ni en las Edge Functions (verificado por búsqueda exhaustiva). La
-- creación de perfiles la hace exclusivamente
-- crear_perfil_nuevo_usuario() (SECURITY DEFINER) — confirmado contra
-- la base real que su dueño (postgres) tiene rolbypassrls=true y
-- además es dueño de "perfiles" en una tabla sin FORCE ROW LEVEL
-- SECURITY, así que nunca dependió de ninguna policy de INSERT. Las
-- Edge Functions con service_role key tampoco dependen de estas
-- policies (bypasean RLS igual).
--
-- Resultado neto para un cliente autenticado normal:
--   SELECT → permitido, según "perfiles: lectura multi-tenant" /
--            "perfiles: admins publicos" (sin cambios).
--   UPDATE → permitido por fila según "perfiles: actualizar
--            multi-tenant" (sin cambios), y por columna según el
--            trigger de la Sección 45 (sin cambios).
--   INSERT → bloqueado por completo.
--   DELETE → bloqueado por completo.

drop policy if exists "perfil: usuario gestiona el suyo" on perfiles;
drop policy if exists "perfiles: insercion propia" on perfiles;
drop policy if exists "perfiles: borrar propio" on perfiles;

-- ============================================================
-- 47. MIGRACIÓN — Aislamiento multi-tenant real en
--     medidas, dietocalculo, ejercicio_logs
-- ============================================================
-- Verificado contra código real (mobile-app + admin-web) el 2026-08-25.
-- Las tres tablas tenían una policy legacy "...: gestion para
-- autenticados" (auth.role() = 'authenticated') que permitía a
-- cualquier usuario autenticado CRUD completo sobre filas de
-- cualquier paciente, sin relación con nutricionista_id. Ninguna
-- Edge Function usa estas tablas (verificado por grep exhaustivo).
--
-- Decisiones aprobadas:
--   A) dietocalculo no tiene flujo real en mobile-app (0 referencias);
--      el paciente no recibe acceso directo, solo admin dueño y superadmin.
--   B) superadmin solo recibe los comandos que ya tienen un flujo legítimo
--      para algún otro rol en esa tabla (ningún UPDATE/DELETE "por si acaso").

-- ── medidas ──────────────────────────────────────────────────
drop policy if exists "medidas: usuario gestiona las suyas" on medidas;
drop policy if exists "medidas: gestion para autenticados" on medidas;

create policy "medidas_select" on medidas
for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = medidas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "medidas_insert" on medidas
for insert to authenticated with check (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = medidas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

-- ── ejercicio_logs ───────────────────────────────────────────
drop policy if exists "ej_logs: usuario gestiona los suyos" on ejercicio_logs;
drop policy if exists "ej_logs: gestion para autenticados" on ejercicio_logs;

create policy "ejercicio_logs_select" on ejercicio_logs
for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = ejercicio_logs.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "ejercicio_logs_insert" on ejercicio_logs
for insert to authenticated with check (
  auth.uid() = user_id
  or public.get_user_rol() = 'superadmin'
);

create policy "ejercicio_logs_delete" on ejercicio_logs
for delete to authenticated using (
  auth.uid() = user_id
  or public.get_user_rol() = 'superadmin'
);

-- ── dietocalculo ─────────────────────────────────────────────
drop policy if exists "dietocalculo: usuario ve el suyo" on dietocalculo;
drop policy if exists "dietocalculo: gestion para autenticados" on dietocalculo;

create policy "dietocalculo_select" on dietocalculo
for select to authenticated using (
  exists (select 1 from perfiles where id = dietocalculo.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "dietocalculo_insert" on dietocalculo
for insert to authenticated with check (
  exists (select 1 from perfiles where id = dietocalculo.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "dietocalculo_update" on dietocalculo
for update to authenticated using (
  exists (select 1 from perfiles where id = dietocalculo.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
)
with check (
  exists (select 1 from perfiles where id = dietocalculo.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

-- ============================================================
-- 48. MIGRACIÓN — Aislamiento multi-tenant real en
--     rutinas, rutina_dias, rutina_ejercicios
-- ============================================================
-- Verificado contra código real (mobile-app + admin-web) el 2026-08-25.
-- mobile-app SOLO lee (fetchMiRutina, useNewsStore) — nunca escribe
-- rutinas/rutina_dias/rutina_ejercicios. admin-web (_data/rutinas.ts)
-- es el único escritor: saveRutina() hace INSERT/UPDATE en rutinas;
-- replaceDias() hace DELETE+INSERT en rutina_dias e INSERT en
-- rutina_ejercicios (nunca UPDATE/DELETE directo en rutina_ejercicios
-- — su limpieza ocurre por ON DELETE CASCADE al borrar el rutina_dias
-- padre, lo cual bypassea RLS de la tabla referenciada). Ninguna Edge
-- Function usa estas 3 tablas (verificado por grep exhaustivo).
--
-- rutinas conservaba además, desde la Sección 3, una policy FOR ALL
-- de "propio" nunca eliminada que daba al paciente INSERT/UPDATE/
-- DELETE sobre su propia rutina sin que mobile-app lo use nunca.
--
-- Se preserva la regla de negocio existente en "rutinas: insert
-- paciente activo": solo se puede crear una rutina para un paciente
-- con is_active = true y estatus = 'aprobado'.

-- ── rutinas ──────────────────────────────────────────────────
drop policy if exists "rutinas: usuario gestiona las suyas" on rutinas;
drop policy if exists "rutinas: select autenticados" on rutinas;
drop policy if exists "rutinas: update autenticados" on rutinas;
drop policy if exists "rutinas: delete autenticados" on rutinas;
drop policy if exists "rutinas: insert paciente activo" on rutinas;

create policy "rutinas_select" on rutinas
for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = rutinas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "rutinas_insert" on rutinas
for insert to authenticated with check (
  (
    exists (select 1 from perfiles where id = rutinas.user_id and nutricionista_id = auth.uid())
    or public.get_user_rol() = 'superadmin'
  )
  and exists (
    select 1 from perfiles
    where id = rutinas.user_id
      and is_active = true
      and estatus = 'aprobado'
  )
);

create policy "rutinas_update" on rutinas
for update to authenticated using (
  exists (select 1 from perfiles where id = rutinas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
)
with check (
  exists (select 1 from perfiles where id = rutinas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "rutinas_delete" on rutinas
for delete to authenticated using (
  exists (select 1 from perfiles where id = rutinas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

-- ── rutina_dias ──────────────────────────────────────────────
drop policy if exists "rutina_dias: acceso via rutina propia" on rutina_dias;
drop policy if exists "rutina_dias: gestion para autenticados" on rutina_dias;

create policy "rutina_dias_select" on rutina_dias
for select to authenticated using (
  exists (
    select 1 from rutinas r
    where r.id = rutina_dias.rutina_id
      and (
        r.user_id = auth.uid()
        or exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
        or public.get_user_rol() = 'superadmin'
      )
  )
);

create policy "rutina_dias_insert" on rutina_dias
for insert to authenticated with check (
  exists (
    select 1 from rutinas r
    where r.id = rutina_dias.rutina_id
      and (
        exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
        or public.get_user_rol() = 'superadmin'
      )
  )
);

create policy "rutina_dias_delete" on rutina_dias
for delete to authenticated using (
  exists (
    select 1 from rutinas r
    where r.id = rutina_dias.rutina_id
      and (
        exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
        or public.get_user_rol() = 'superadmin'
      )
  )
);

-- ── rutina_ejercicios ────────────────────────────────────────
drop policy if exists "rutina_ejercicios: acceso via dia propio" on rutina_ejercicios;
drop policy if exists "rutina_ejercicios: gestion para autenticados" on rutina_ejercicios;

create policy "rutina_ejercicios_select" on rutina_ejercicios
for select to authenticated using (
  exists (
    select 1 from rutina_dias rd
    join rutinas r on r.id = rd.rutina_id
    where rd.id = rutina_ejercicios.dia_id
      and (
        r.user_id = auth.uid()
        or exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
        or public.get_user_rol() = 'superadmin'
      )
  )
);

create policy "rutina_ejercicios_insert" on rutina_ejercicios
for insert to authenticated with check (
  exists (
    select 1 from rutina_dias rd
    join rutinas r on r.id = rd.rutina_id
    where rd.id = rutina_ejercicios.dia_id
      and (
        exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
        or public.get_user_rol() = 'superadmin'
      )
  )
);

-- ============================================================
-- 49. MIGRACIÓN — Corrige rutinas_insert: superadmin no podía
--     crear rutinas para pacientes que no gestiona directamente
-- ============================================================
-- Causa raíz: el EXISTS de is_active/estatus en rutinas_insert es una
-- subconsulta directa contra perfiles, sujeta a la RLS de esa tabla.
-- La policy SELECT de perfiles ("perfiles: lectura multi-tenant",
-- Sección 27) no tiene cláusula de superadmin, así que ese EXISTS
-- siempre daba falso para pacientes ajenos, sin importar su estado real
-- (confirmado con fixtures sintéticos vía la suite pgTAP). Se reemplaza
-- por una función SECURITY DEFINER que verifica el estado del paciente
-- sin depender de que el rol actual pueda verlo vía RLS — la regla de
-- negocio (solo paciente aprobado+activo recibe rutinas nuevas) no
-- cambia, solo cómo se evalúa.

create or replace function public.get_perfil_activo_aprobado(p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from perfiles
    where id = p_user_id
      and is_active = true
      and estatus = 'aprobado'
  )
$$;

drop policy if exists "rutinas_insert" on rutinas;
create policy "rutinas_insert" on rutinas
for insert to authenticated with check (
  (
    exists (select 1 from perfiles where id = rutinas.user_id and nutricionista_id = auth.uid())
    or public.get_user_rol() = 'superadmin'
  )
  and public.get_perfil_activo_aprobado(rutinas.user_id)
);

-- ============================================================
-- 50. MIGRACIÓN — Aislamiento multi-tenant real en
--     planes_nutricionales, plan_equivalentes
-- ============================================================
-- Verificado contra código real (mobile-app + admin-web) el 2026-08-26.
-- mobile-app SOLO lee (fetchMisEquivalentes, useNewsStore) — nunca escribe
-- ninguna de las dos tablas. admin-web (_data/nutricion.ts) es el único
-- escritor: fetchEquivalentes() hace INSERT en planes_nutricionales
-- (patrón "crear si no existe"); saveEquivalentes() hace DELETE+INSERT en
-- plan_equivalentes (a diferencia de rutina_ejercicios, aquí el DELETE es
-- directo sobre la tabla hija, no vía cascada — sí necesita policy DELETE
-- explícita). Ninguna Edge Function usa estas tablas.
--
-- planes_nutricionales conservaba desde la Sección 5 una policy FOR ALL de
-- "propio" nunca eliminada que daba al paciente INSERT/UPDATE/DELETE sobre
-- su propio plan sin que mobile-app lo use nunca.
--
-- Se preserva la regla de negocio existente ("planes: insert paciente
-- activo": is_active=true y estatus='aprobado'), evaluada con
-- public.get_perfil_activo_aprobado() (Sección 49) en vez de una
-- subconsulta directa contra perfiles, para no repetir el bug de
-- visibilidad RLS que afectaba a superadmin en rutinas_insert.

-- ── planes_nutricionales ─────────────────────────────────────
drop policy if exists "planes: usuario ve el suyo" on planes_nutricionales;
drop policy if exists "planes: select autenticados" on planes_nutricionales;
drop policy if exists "planes: update autenticados" on planes_nutricionales;
drop policy if exists "planes: delete autenticados" on planes_nutricionales;
drop policy if exists "planes: insert paciente activo" on planes_nutricionales;

create policy "planes_nutricionales_select" on planes_nutricionales
for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = planes_nutricionales.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "planes_nutricionales_insert" on planes_nutricionales
for insert to authenticated with check (
  (
    exists (select 1 from perfiles where id = planes_nutricionales.user_id and nutricionista_id = auth.uid())
    or public.get_user_rol() = 'superadmin'
  )
  and public.get_perfil_activo_aprobado(planes_nutricionales.user_id)
);

-- ── plan_equivalentes ────────────────────────────────────────
drop policy if exists "equivalentes: acceso via plan propio" on plan_equivalentes;
drop policy if exists "equivalentes: gestion para autenticados" on plan_equivalentes;

create policy "plan_equivalentes_select" on plan_equivalentes
for select to authenticated using (
  exists (
    select 1 from planes_nutricionales p
    where p.id = plan_equivalentes.plan_id
      and (
        p.user_id = auth.uid()
        or exists (select 1 from perfiles where id = p.user_id and nutricionista_id = auth.uid())
        or public.get_user_rol() = 'superadmin'
      )
  )
);

create policy "plan_equivalentes_insert" on plan_equivalentes
for insert to authenticated with check (
  exists (
    select 1 from planes_nutricionales p
    where p.id = plan_equivalentes.plan_id
      and (
        exists (select 1 from perfiles where id = p.user_id and nutricionista_id = auth.uid())
        or public.get_user_rol() = 'superadmin'
      )
  )
);

create policy "plan_equivalentes_delete" on plan_equivalentes
for delete to authenticated using (
  exists (
    select 1 from planes_nutricionales p
    where p.id = plan_equivalentes.plan_id
      and (
        exists (select 1 from perfiles where id = p.user_id and nutricionista_id = auth.uid())
        or public.get_user_rol() = 'superadmin'
      )
  )
);

-- ============================================================
-- 51. MIGRACIÓN — Aislamiento multi-tenant real + protección de
--     columnas en plan_suplementacion, citas
-- ============================================================
-- Verificado contra código real (mobile-app + admin-web) el 2026-08-26.
--
-- plan_suplementacion: mobile-app SELECT propio + UPDATE propio de
-- hora/momento/notas (3 funciones separadas, nunca INSERT/DELETE).
-- admin-web hace DELETE+INSERT directo sobre esta tabla (es la tabla
-- padre, no hay cascada) — nunca UPDATE.
--
-- citas: mobile-app SELECT propio + UPDATE de estado (el paciente ve
-- botones Confirmar/Cancelar solo sobre citas en estado 'pendiente' —
-- perfil.tsx líneas 359/370 — nunca INSERT/DELETE). admin-web hace
-- SELECT + INSERT + UPDATE de estado (cualquier valor) + DELETE.
--
-- RLS controla filas, no columnas: sin protección adicional, un paciente
-- podría hacer UPDATE de columnas que su propia app nunca toca
-- (suplemento_id/dosis/user_id en plan_suplementacion; fecha/hora/tipo/
-- profesional/modalidad/notas/user_id/created_at en citas), o mover el
-- estado de una cita por transiciones que la UI nunca permite
-- (confirmada->cancelada, cancelada->confirmada, etc.). Column-level
-- GRANT/REVOKE no puede resolver esto porque paciente/admin/superadmin
-- comparten el mismo rol de Postgres (authenticated) — se usa el mismo
-- patrón de BEFORE UPDATE trigger ya probado en producción para perfiles
-- (Sección 45), incluyendo el mismo bypass "current_user = 'service_role'"
-- para Edge Functions.
--
-- Ninguna Edge Function usa estas tablas hoy.
--
-- Ambas tablas conservaban una policy FOR ALL de "propio" (Secciones 5/13,
-- nunca eliminadas) que daba comandos que el código real no usa completos.
--
-- Se preserva la regla de negocio existente ("... insert paciente activo":
-- is_active=true y estatus='aprobado'), evaluada con
-- public.get_perfil_activo_aprobado() (Sección 49).

-- ── plan_suplementacion: policies ───────────────────────────
drop policy if exists "plan_supp: usuario ve el suyo" on plan_suplementacion;
drop policy if exists "plan_supp: select autenticados" on plan_suplementacion;
drop policy if exists "plan_supp: update autenticados" on plan_suplementacion;
drop policy if exists "plan_supp: delete autenticados" on plan_suplementacion;
drop policy if exists "plan_supp: insert paciente activo" on plan_suplementacion;

create policy "plan_suplementacion_select" on plan_suplementacion
for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = plan_suplementacion.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "plan_suplementacion_update" on plan_suplementacion
for update to authenticated using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy "plan_suplementacion_insert" on plan_suplementacion
for insert to authenticated with check (
  (
    exists (select 1 from perfiles where id = plan_suplementacion.user_id and nutricionista_id = auth.uid())
    or public.get_user_rol() = 'superadmin'
  )
  and public.get_perfil_activo_aprobado(plan_suplementacion.user_id)
);

create policy "plan_suplementacion_delete" on plan_suplementacion
for delete to authenticated using (
  exists (select 1 from perfiles where id = plan_suplementacion.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

-- ── plan_suplementacion: protección de columnas ─────────────
-- El UPDATE ya está restringido por RLS a auth.uid()=user_id (admin/
-- superadmin no tienen policy UPDATE alguna). Este trigger asegura que
-- ni siquiera el propio paciente pueda tocar columnas fuera de
-- hora/momento/notas.
create or replace function public.proteger_columnas_plan_suplementacion()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.suplemento_id is distinct from old.suplemento_id
     or new.dosis is distinct from old.dosis
  then
    raise exception 'Solo puedes modificar hora, momento o notas.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_columnas_plan_suplementacion on public.plan_suplementacion;
create trigger trg_proteger_columnas_plan_suplementacion
  before update on public.plan_suplementacion
  for each row
  execute function public.proteger_columnas_plan_suplementacion();

-- ── citas: policies ──────────────────────────────────────────
drop policy if exists "citas: usuario gestiona las suyas" on citas;
drop policy if exists "citas: select autenticados" on citas;
drop policy if exists "citas: update autenticados" on citas;
drop policy if exists "citas: delete autenticados" on citas;
drop policy if exists "citas: insert paciente activo" on citas;

create policy "citas_select" on citas
for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = citas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "citas_insert" on citas
for insert to authenticated with check (
  (
    exists (select 1 from perfiles where id = citas.user_id and nutricionista_id = auth.uid())
    or public.get_user_rol() = 'superadmin'
  )
  and public.get_perfil_activo_aprobado(citas.user_id)
);

create policy "citas_update" on citas
for update to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = citas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
)
with check (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = citas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "citas_delete" on citas
for delete to authenticated using (
  exists (select 1 from perfiles where id = citas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

-- ── citas: protección de columnas ───────────────────────────
-- Verificado: ni paciente ni admin-web actualizan nunca fecha/hora/tipo/
-- profesional/modalidad/notas/user_id/created_at — la única columna que
-- alguien actualiza, alguna vez, es estado. La diferencia es el VALOR
-- permitido: un paciente (rol='usuario') solo puede confirmar o cancelar
-- una cita que esté en 'pendiente' (perfil.tsx: botones Confirmar/
-- Cancelar solo se muestran sobre citas pendientes); admin/superadmin
-- conservan cualquier transición válida del CHECK de estado.
create or replace function public.proteger_columnas_citas()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.fecha is distinct from old.fecha
     or new.hora is distinct from old.hora
     or new.tipo is distinct from old.tipo
     or new.profesional is distinct from old.profesional
     or new.modalidad is distinct from old.modalidad
     or new.notas is distinct from old.notas
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Solo puedes modificar el estado de la cita.';
  end if;

  if public.get_user_rol() = 'usuario'
     and new.estado is distinct from old.estado
     and (old.estado is distinct from 'pendiente' or new.estado not in ('confirmada', 'cancelada'))
  then
    raise exception 'Como paciente solo puedes confirmar o cancelar una cita pendiente.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_columnas_citas on public.citas;
create trigger trg_proteger_columnas_citas
  before update on public.citas
  for each row
  execute function public.proteger_columnas_citas();

-- ============================================================
-- 52. MIGRACIÓN — Aislamiento real, ownership de catálogo por
--     creador, y protección de columnas en recetas,
--     receta_ingredientes, receta_pasos
-- ============================================================
-- Verificado contra código real (mobile-app + admin-web) y contra
-- pg_policies real de producción el 2026-08-27.
--
-- HALLAZGO CRÍTICO: la Sección 35 intentó corregir "recetas" con
-- recetas_select/insert/update/delete basadas en propiedad real, pero el
-- DROP POLICY que las precede usa nombres que nunca existieron — no
-- coinciden con los nombres reales (confirmado contra pg_policies en
-- vivo). Las 4 policies nuevas quedaron apiladas sobre las 5 legacy
-- (auth.role()='authenticated'), que dominan por OR. receta_ingredientes/
-- receta_pasos nunca tuvieron ni siquiera ese intento — 100% abiertas.
-- Cualquier autenticado podía leer/escribir/BORRAR cualquier receta y sus
-- ingredientes/pasos.
--
-- Modelo real (confirmado por canEdit() en admin-web/recetas/page.tsx, no
-- por las policies): recetas.user_id NULL = catálogo global, visible a
-- cualquier autenticado; cualquier admin/superadmin puede crear una
-- receta nueva ("+ Nueva receta" no está condicionado por rol); solo su
-- creador (created_by) o superadmin puede editarla/borrarla después.
-- recetas.user_id NOT NULL = copia personalizada de un paciente,
-- gestionada por su nutricionista dueño o superadmin.
--
-- recetas.created_by nunca se poblaba (RecetaInput lo excluye del
-- payload, y a diferencia de ejercicios.created_by no tenía DEFAULT) —
-- sin poblarlo es imposible expresar en RLS el ownership que canEdit() ya
-- implementa en la UI. Se agrega un trigger BEFORE INSERT que fija
-- created_by = auth.uid() únicamente cuando user_id es NULL (catálogo) y
-- el actor es admin/superadmin — nunca confía en un valor enviado por el
-- cliente (lo sobreescribe siempre), y no toca recetas personalizadas.
--
-- Todas las escrituras sobre hijos de una receta de catálogo (INSERT/
-- UPDATE/DELETE en receta_ingredientes, INSERT/DELETE en receta_pasos)
-- exigen created_by = auth.uid() (o superadmin) — sin excepción de
-- "cualquier admin" — porque de lo contrario un admin no-creador podría
-- modificar indirectamente una receta ajena agregándole/quitándole
-- contenido. La única operación abierta a cualquier admin/superadmin es
-- la creación de la receta PADRE (recetas_insert), que es lo que el
-- código real permite vía "+ Nueva receta". createReceta() hace el INSERT
-- de la receta primero (el trigger fija created_by ahí) y, en operaciones
-- posteriores ya con la receta persistida, llama a replaceIngredientes()/
-- replacePasos() — para ese momento created_by ya está fijado.
--
-- Ninguna Edge Function usa estas tablas.

-- ── recetas: eliminar las 9 policies reales confirmadas ─────
drop policy if exists "recetas: lectura para autenticados" on recetas;
drop policy if exists "recetas: gestion para autenticados" on recetas;
drop policy if exists "recetas: actualizacion para autenticados" on recetas;
drop policy if exists "recetas: eliminacion para autenticados" on recetas;
drop policy if exists "recetas: usuario lee las suyas" on recetas;
drop policy if exists "recetas_select" on recetas;
drop policy if exists "recetas_insert" on recetas;
drop policy if exists "recetas_update" on recetas;
drop policy if exists "recetas_delete" on recetas;

create policy "recetas_select" on recetas
for select to authenticated using (
  recetas.user_id is null
  or auth.uid() = recetas.user_id
  or exists (select 1 from perfiles where id = recetas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "recetas_insert" on recetas
for insert to authenticated with check (
  (recetas.user_id is null and public.get_user_rol() in ('admin', 'superadmin'))
  or (
    recetas.user_id is not null
    and (
      exists (select 1 from perfiles where id = recetas.user_id and nutricionista_id = auth.uid())
      or public.get_user_rol() = 'superadmin'
    )
  )
);

create policy "recetas_update" on recetas
for update to authenticated using (
  (recetas.user_id is null and (recetas.created_by = auth.uid() or public.get_user_rol() = 'superadmin'))
  or (
    recetas.user_id is not null
    and (
      exists (select 1 from perfiles where id = recetas.user_id and nutricionista_id = auth.uid())
      or public.get_user_rol() = 'superadmin'
    )
  )
)
with check (
  (recetas.user_id is null and (recetas.created_by = auth.uid() or public.get_user_rol() = 'superadmin'))
  or (
    recetas.user_id is not null
    and (
      exists (select 1 from perfiles where id = recetas.user_id and nutricionista_id = auth.uid())
      or public.get_user_rol() = 'superadmin'
    )
  )
);

create policy "recetas_delete" on recetas
for delete to authenticated using (
  (recetas.user_id is null and (recetas.created_by = auth.uid() or public.get_user_rol() = 'superadmin'))
  or (
    recetas.user_id is not null
    and (
      exists (select 1 from perfiles where id = recetas.user_id and nutricionista_id = auth.uid())
      or public.get_user_rol() = 'superadmin'
    )
  )
);

-- ── recetas: created_by derivado siempre de auth.uid(), nunca del cliente ──
create or replace function public.set_created_by_recetas()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if new.user_id is null and public.get_user_rol() in ('admin', 'superadmin') then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_created_by_recetas on public.recetas;
create trigger trg_set_created_by_recetas
  before insert on public.recetas
  for each row
  execute function public.set_created_by_recetas();

-- ── recetas: protección de columnas en UPDATE ────────────────
create or replace function public.proteger_columnas_recetas()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.receta_base_id is distinct from old.receta_base_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'No puedes modificar el propietario ni la referencia base de una receta.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_columnas_recetas on public.recetas;
create trigger trg_proteger_columnas_recetas
  before update on public.recetas
  for each row
  execute function public.proteger_columnas_recetas();

-- ── receta_ingredientes: policies (sin excepción de "cualquier admin") ──
drop policy if exists "ingredientes: lectura para autenticados" on receta_ingredientes;
drop policy if exists "ingredientes: gestion para autenticados" on receta_ingredientes;

create policy "receta_ingredientes_select" on receta_ingredientes
for select to authenticated using (
  exists (
    select 1 from recetas r
    where r.id = receta_ingredientes.receta_id
      and (
        r.user_id is null
        or r.user_id = auth.uid()
        or exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
        or public.get_user_rol() = 'superadmin'
      )
  )
);

create policy "receta_ingredientes_insert" on receta_ingredientes
for insert to authenticated with check (
  exists (
    select 1 from recetas r
    where r.id = receta_ingredientes.receta_id
      and (
        (r.user_id is null and (r.created_by = auth.uid() or public.get_user_rol() = 'superadmin'))
        or (r.user_id is not null and (
          exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
          or public.get_user_rol() = 'superadmin'
        ))
      )
  )
);

create policy "receta_ingredientes_update" on receta_ingredientes
for update to authenticated using (
  exists (
    select 1 from recetas r
    where r.id = receta_ingredientes.receta_id
      and (
        (r.user_id is null and (r.created_by = auth.uid() or public.get_user_rol() = 'superadmin'))
        or (r.user_id is not null and (
          exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
          or public.get_user_rol() = 'superadmin'
        ))
      )
  )
)
with check (
  exists (
    select 1 from recetas r
    where r.id = receta_ingredientes.receta_id
      and (
        (r.user_id is null and (r.created_by = auth.uid() or public.get_user_rol() = 'superadmin'))
        or (r.user_id is not null and (
          exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
          or public.get_user_rol() = 'superadmin'
        ))
      )
  )
);

create policy "receta_ingredientes_delete" on receta_ingredientes
for delete to authenticated using (
  exists (
    select 1 from recetas r
    where r.id = receta_ingredientes.receta_id
      and (
        (r.user_id is null and (r.created_by = auth.uid() or public.get_user_rol() = 'superadmin'))
        or (r.user_id is not null and (
          exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
          or public.get_user_rol() = 'superadmin'
        ))
      )
  )
);

-- ── receta_ingredientes: protección de columnas (solo alimento_id) ──
create or replace function public.proteger_columnas_receta_ingredientes()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.receta_id is distinct from old.receta_id
     or new.orden is distinct from old.orden
     or new.descripcion is distinct from old.descripcion
     or new.cantidad is distinct from old.cantidad
     or new.unidad is distinct from old.unidad
     or new.grupo is distinct from old.grupo
  then
    raise exception 'Solo puedes modificar alimento_id.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_columnas_receta_ingredientes on public.receta_ingredientes;
create trigger trg_proteger_columnas_receta_ingredientes
  before update on public.receta_ingredientes
  for each row
  execute function public.proteger_columnas_receta_ingredientes();

-- ── receta_pasos: policies (sin UPDATE, sin excepción de "cualquier admin") ──
drop policy if exists "pasos: lectura para autenticados" on receta_pasos;
drop policy if exists "pasos: gestion para autenticados" on receta_pasos;

create policy "receta_pasos_select" on receta_pasos
for select to authenticated using (
  exists (
    select 1 from recetas r
    where r.id = receta_pasos.receta_id
      and (
        r.user_id is null
        or r.user_id = auth.uid()
        or exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
        or public.get_user_rol() = 'superadmin'
      )
  )
);

create policy "receta_pasos_insert" on receta_pasos
for insert to authenticated with check (
  exists (
    select 1 from recetas r
    where r.id = receta_pasos.receta_id
      and (
        (r.user_id is null and (r.created_by = auth.uid() or public.get_user_rol() = 'superadmin'))
        or (r.user_id is not null and (
          exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
          or public.get_user_rol() = 'superadmin'
        ))
      )
  )
);

create policy "receta_pasos_delete" on receta_pasos
for delete to authenticated using (
  exists (
    select 1 from recetas r
    where r.id = receta_pasos.receta_id
      and (
        (r.user_id is null and (r.created_by = auth.uid() or public.get_user_rol() = 'superadmin'))
        or (r.user_id is not null and (
          exists (select 1 from perfiles where id = r.user_id and nutricionista_id = auth.uid())
          or public.get_user_rol() = 'superadmin'
        ))
      )
  )
);

-- ============================================================
-- ROLLBACK Sección 52 (referencia — NO ejecutar salvo que se
-- decida revertir esta sección). Reconstruido a partir de
-- pg_policies real de producción (incluye permissive/roles),
-- verificado el 2026-08-27:
--
-- drop trigger if exists trg_set_created_by_recetas on public.recetas;
-- drop function if exists public.set_created_by_recetas();
-- drop trigger if exists trg_proteger_columnas_recetas on public.recetas;
-- drop function if exists public.proteger_columnas_recetas();
-- drop trigger if exists trg_proteger_columnas_receta_ingredientes on public.receta_ingredientes;
-- drop function if exists public.proteger_columnas_receta_ingredientes();
--
-- drop policy if exists "recetas_select" on recetas;
-- drop policy if exists "recetas_insert" on recetas;
-- drop policy if exists "recetas_update" on recetas;
-- drop policy if exists "recetas_delete" on recetas;
-- drop policy if exists "receta_ingredientes_select" on receta_ingredientes;
-- drop policy if exists "receta_ingredientes_insert" on receta_ingredientes;
-- drop policy if exists "receta_ingredientes_update" on receta_ingredientes;
-- drop policy if exists "receta_ingredientes_delete" on receta_ingredientes;
-- drop policy if exists "receta_pasos_select" on receta_pasos;
-- drop policy if exists "receta_pasos_insert" on receta_pasos;
-- drop policy if exists "receta_pasos_delete" on receta_pasos;
--
-- create policy "recetas: lectura para autenticados" on recetas
--   as permissive for select to public
--   using (auth.role() = 'authenticated'::text);
--
-- create policy "recetas: gestion para autenticados" on recetas
--   as permissive for insert to public
--   with check (auth.role() = 'authenticated'::text);
--
-- create policy "recetas: actualizacion para autenticados" on recetas
--   as permissive for update to public
--   using (auth.role() = 'authenticated'::text);
--
-- create policy "recetas: eliminacion para autenticados" on recetas
--   as permissive for delete to public
--   using (auth.role() = 'authenticated'::text);
--
-- create policy "recetas: usuario lee las suyas" on recetas
--   as permissive for select to public
--   using (auth.uid() = user_id);
--
-- create policy "recetas_select" on recetas
--   as permissive for select to authenticated
--   using (
--     ((user_id is null) and (get_user_rol() = any (array['admin'::text, 'superadmin'::text])))
--     or ((user_id is not null) and (exists (
--       select 1 from perfiles p
--       where (p.id = recetas.user_id) and (p.nutricionista_id = auth.uid())
--     )))
--   );
--
-- create policy "recetas_insert" on recetas
--   as permissive for insert to authenticated
--   with check (
--     (get_user_rol() = any (array['admin'::text, 'superadmin'::text]))
--     or (exists (
--       select 1 from perfiles p
--       where (p.id = recetas.user_id) and (p.nutricionista_id = auth.uid())
--     ))
--   );
--
-- create policy "recetas_update" on recetas
--   as permissive for update to authenticated
--   using (
--     ((user_id is null) and (get_user_rol() = 'superadmin'::text))
--     or ((user_id is null) and (get_user_rol() = 'admin'::text) and (created_by = auth.uid()))
--     or ((user_id is not null) and (exists (
--       select 1 from perfiles p
--       where (p.id = recetas.user_id) and (p.nutricionista_id = auth.uid())
--     )))
--   );
--
-- create policy "recetas_delete" on recetas
--   as permissive for delete to authenticated
--   using (
--     ((user_id is null) and (get_user_rol() = 'superadmin'::text))
--     or ((user_id is null) and (get_user_rol() = 'admin'::text) and (created_by = auth.uid()))
--     or ((user_id is not null) and (exists (
--       select 1 from perfiles p
--       where (p.id = recetas.user_id) and (p.nutricionista_id = auth.uid())
--     )))
--   );
--
-- create policy "ingredientes: lectura para autenticados" on receta_ingredientes
--   as permissive for select to public
--   using (auth.role() = 'authenticated'::text);
--
-- create policy "ingredientes: gestion para autenticados" on receta_ingredientes
--   as permissive for all to public
--   using (auth.role() = 'authenticated'::text)
--   with check (auth.role() = 'authenticated'::text);
--
-- create policy "pasos: lectura para autenticados" on receta_pasos
--   as permissive for select to public
--   using (auth.role() = 'authenticated'::text);
--
-- create policy "pasos: gestion para autenticados" on receta_pasos
--   as permissive for all to public
--   using (auth.role() = 'authenticated'::text)
--   with check (auth.role() = 'authenticated'::text);
-- ============================================================

-- ============================================================
-- 53. MIGRACIÓN — Aislamiento multi-tenant real, invariante
--     receta↔paciente, y protección de columnas en
--     recetas_guardadas
-- ============================================================
-- Verificado contra código real (mobile-app + admin-web) y contra
-- pg_policies real de producción el 2026-08-27.
--
-- mobile-app SOLO lee, vía embed anidado en fetchMisRecetas() — nunca
-- escribe. admin-web (_data/recetas_guardadas.ts) hace DELETE+INSERT
-- (saveRecetasAsignadas, reemplazo completo por paciente) y un UPDATE
-- real pero acotado a una sola columna: personalizeReceta() redirige
-- receta_id (nunca user_id ni tiempo_comida) cuando el nutriólogo
-- personaliza una receta de catálogo para su paciente. Ninguna Edge
-- Function usa esta tabla.
--
-- recetas_guardadas conservaba desde la Sección 6 una policy FOR ALL de
-- "propio" nunca eliminada, y desde la Sección 14 una policy abierta a
-- cualquier autenticado que dominaba por OR — cualquiera podía leer,
-- crear, modificar o borrar las recetas guardadas de cualquier paciente.
--
-- Invariante agregada: la receta referenciada debe ser de catálogo
-- (user_id IS NULL) o pertenecer al MISMO paciente que recetas_guardadas.
-- user_id — nunca una receta personalizada de otro paciente. Se valida
-- con una subconsulta directa contra recetas (sin SECURITY DEFINER):
-- verificado que en los dos casos que deben permitirse (catálogo, o
-- personalizada del paciente que el actor ya puede gestionar) la fila
-- siempre es visible bajo recetas_select (Sección 52) para ese actor —
-- la invisibilidad por RLS solo ocurre en el caso que de todos modos hay
-- que bloquear (personalizada de un paciente ajeno), así que no hay
-- riesgo de falso negativo como el que tuvo rutinas_insert.

drop policy if exists "guardadas: usuario gestiona las suyas" on recetas_guardadas;
drop policy if exists "guardadas: gestion para autenticados" on recetas_guardadas;

create policy "recetas_guardadas_select" on recetas_guardadas
for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = recetas_guardadas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "recetas_guardadas_insert" on recetas_guardadas
for insert to authenticated with check (
  (
    exists (select 1 from perfiles where id = recetas_guardadas.user_id and nutricionista_id = auth.uid())
    or public.get_user_rol() = 'superadmin'
  )
  and exists (
    select 1 from recetas r
    where r.id = recetas_guardadas.receta_id
      and (r.user_id is null or r.user_id = recetas_guardadas.user_id)
  )
);

create policy "recetas_guardadas_update" on recetas_guardadas
for update to authenticated using (
  exists (select 1 from perfiles where id = recetas_guardadas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
)
with check (
  (
    exists (select 1 from perfiles where id = recetas_guardadas.user_id and nutricionista_id = auth.uid())
    or public.get_user_rol() = 'superadmin'
  )
  and exists (
    select 1 from recetas r
    where r.id = recetas_guardadas.receta_id
      and (r.user_id is null or r.user_id = recetas_guardadas.user_id)
  )
);

create policy "recetas_guardadas_delete" on recetas_guardadas
for delete to authenticated using (
  exists (select 1 from perfiles where id = recetas_guardadas.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

-- ── protección de columnas: solo receta_id es modificable ──────
create or replace function public.proteger_columnas_recetas_guardadas()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.tiempo_comida is distinct from old.tiempo_comida
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Solo puedes modificar receta_id.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_columnas_recetas_guardadas on public.recetas_guardadas;
create trigger trg_proteger_columnas_recetas_guardadas
  before update on public.recetas_guardadas
  for each row
  execute function public.proteger_columnas_recetas_guardadas();

-- ============================================================
-- ROLLBACK Sección 53 (referencia — NO ejecutar salvo que se
-- decida revertir esta sección). Reconstruido a partir de
-- pg_policies real de producción, verificado el 2026-08-27:
--
-- drop trigger if exists trg_proteger_columnas_recetas_guardadas on public.recetas_guardadas;
-- drop function if exists public.proteger_columnas_recetas_guardadas();
--
-- drop policy if exists "recetas_guardadas_select" on recetas_guardadas;
-- drop policy if exists "recetas_guardadas_insert" on recetas_guardadas;
-- drop policy if exists "recetas_guardadas_update" on recetas_guardadas;
-- drop policy if exists "recetas_guardadas_delete" on recetas_guardadas;
--
-- create policy "guardadas: gestion para autenticados" on recetas_guardadas
--   as permissive for all to public
--   using (auth.role() = 'authenticated'::text)
--   with check (auth.role() = 'authenticated'::text);
--
-- create policy "guardadas: usuario gestiona las suyas" on recetas_guardadas
--   as permissive for all to public
--   using (auth.uid() = user_id);
-- ============================================================

-- ============================================================
-- 54. MIGRACIÓN — Corrige el bug de nombres de la Sección 35 en
--     ejercicios y alimentos; cierra suplementos; agrega
--     created_by real a alimentos; hace explícito el WITH CHECK
--     de ejercicios_update/alimentos_update
-- ============================================================
-- Verificado contra código real (mobile-app + admin-web + 4 Edge
-- Functions) y contra pg_policies real de producción el 2026-08-27.
--
-- HALLAZGO: la Sección 35 intentó limpiar las legacy de ejercicios,
-- recetas y alimentos en el mismo bloque, y cometió el mismo error de
-- nombres en las tres (ya corregido para recetas en la Sección 52). Las
-- 3 legacy de escritura de ejercicios ("gestion"/"actualizacion"/
-- "eliminacion para autenticados") y las 2 de alimentos ("lectura"/
-- "gestion para autenticados") seguían activas, dominando por OR sobre
-- ejercicios_select/insert/update/delete y alimentos_select/insert/
-- update/delete — cualquier autenticado podía insertar/actualizar/
-- BORRAR cualquier fila de ambos catálogos.
--
-- "ejercicios: lectura para autenticados" se CONSERVA intencionalmente:
-- rutina_ejercicios/ejercicio_logs embeben ejercicios(*) para pacientes
-- (rol='usuario'), que ejercicios_select no cubre (solo admin/
-- superadmin) — eliminarla rompería las pantallas de rutina/progreso.
-- Esto significa que un paciente sigue viendo TODO el catálogo,
-- incluidos ejercicios creados por cualquier admin — trade-off
-- documentado, no un descuido.
--
-- "alimentos: lectura para autenticados" SÍ se elimina sin excepción:
-- mobile-app no usa esta tabla (ni .from() directo ni embed).
--
-- "suplementos: lectura para autenticados" se conserva: mobile-app
-- embebe suplementos(*) vía plan_suplementacion para cualquier
-- paciente, y la tabla no tiene columna created_by ni noción de
-- ownership — es un catálogo compartido por diseño. Confirmado también
-- por la ausencia total de canEdit()/distinción de rol en
-- suplementos/page.tsx (a diferencia de recetas/ejercicios/alimentos,
-- que sí la tienen) — cualquier admin gestiona cualquier suplemento,
-- intencionalmente.
--
-- alimentos.created_by nunca tuvo DEFAULT auth.uid() (a diferencia de
-- ejercicios.created_by, Sección 40) y AlimentoInput lo excluye del
-- payload — igual que recetas antes de la Sección 52, esto significa
-- que ningún alimento creado por código real queda atribuido a su
-- creador real. Además alimentos_insert.with_check no restringe
-- created_by en absoluto (a diferencia de ejercicios_insert, que sí
-- exige created_by=auth.uid() para admin) — un admin podría falsificar
-- la autoría de otro admin al crear. Se agrega el mismo trigger BEFORE
-- INSERT que ya usamos para recetas.
--
-- ejercicios_update y alimentos_update no declaraban WITH CHECK
-- explícito (confirmado en pg_policies real: with_check=null) — Postgres
-- usa el propio USING como CHECK implícito en ese caso (documentado),
-- así que ya estaban protegidas contra reasignación de created_by; se
-- hace explícito sin cambiar la semántica.
--
-- Ninguna Edge Function se ve afectada: import-workoutx,
-- match-exercise-gifs, translate-exercises y migrate-gifs usan
-- SUPABASE_SERVICE_ROLE_KEY (confirmado en las 4), que bypasea RLS.

-- ── ejercicios: cerrar solo las 3 legacy de escritura ───────
drop policy if exists "ejercicios: gestion para autenticados" on ejercicios;
drop policy if exists "ejercicios: actualizacion para autenticados" on ejercicios;
drop policy if exists "ejercicios: eliminacion para autenticados" on ejercicios;
-- "ejercicios: lectura para autenticados" se conserva intencionalmente.

drop policy if exists "ejercicios_update" on ejercicios;
create policy "ejercicios_update" on ejercicios
for update to authenticated using (
  (public.get_user_rol() = 'superadmin' and (
    created_by is null or
    exists (select 1 from perfiles where id = ejercicios.created_by and rol = 'superadmin')
  ))
  or
  (public.get_user_rol() = 'admin' and created_by = auth.uid())
)
with check (
  (public.get_user_rol() = 'superadmin' and (
    created_by is null or
    exists (select 1 from perfiles where id = ejercicios.created_by and rol = 'superadmin')
  ))
  or
  (public.get_user_rol() = 'admin' and created_by = auth.uid())
);

-- ── alimentos: cerrar las 2 legacy (incluida lectura) ───────
drop policy if exists "alimentos: lectura para autenticados" on alimentos;
drop policy if exists "alimentos: gestion para autenticados" on alimentos;

drop policy if exists "alimentos_update" on alimentos;
create policy "alimentos_update" on alimentos
for update to authenticated using (
  (public.get_user_rol() = 'superadmin' and (
    created_by is null or
    exists (select 1 from perfiles where id = alimentos.created_by and rol = 'superadmin')
  ))
  or
  (public.get_user_rol() = 'admin' and created_by = auth.uid())
)
with check (
  (public.get_user_rol() = 'superadmin' and (
    created_by is null or
    exists (select 1 from perfiles where id = alimentos.created_by and rol = 'superadmin')
  ))
  or
  (public.get_user_rol() = 'admin' and created_by = auth.uid())
);

-- ── alimentos: created_by derivado siempre de auth.uid() ────
create or replace function public.set_created_by_alimentos()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if public.get_user_rol() in ('admin', 'superadmin') then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_created_by_alimentos on public.alimentos;
create trigger trg_set_created_by_alimentos
  before insert on public.alimentos
  for each row
  execute function public.set_created_by_alimentos();

-- ── suplementos: cerrar la única legacy de escritura ────────
drop policy if exists "suplementos: gestion para autenticados" on suplementos;
-- "suplementos: lectura para autenticados" se conserva.

create policy "suplementos_insert" on suplementos
for insert to authenticated with check (
  public.get_user_rol() in ('admin', 'superadmin')
);

create policy "suplementos_update" on suplementos
for update to authenticated using (
  public.get_user_rol() in ('admin', 'superadmin')
)
with check (
  public.get_user_rol() in ('admin', 'superadmin')
);

create policy "suplementos_delete" on suplementos
for delete to authenticated using (
  public.get_user_rol() in ('admin', 'superadmin')
);

-- ============================================================
-- ROLLBACK Sección 54 (referencia — NO ejecutar salvo que se
-- decida revertir esta sección). Reconstruido a partir de
-- pg_policies real de producción, verificado el 2026-08-27:
--
-- drop trigger if exists trg_set_created_by_alimentos on public.alimentos;
-- drop function if exists public.set_created_by_alimentos();
--
-- drop policy if exists "ejercicios_update" on ejercicios;
-- drop policy if exists "alimentos_update" on alimentos;
-- drop policy if exists "suplementos_insert" on suplementos;
-- drop policy if exists "suplementos_update" on suplementos;
-- drop policy if exists "suplementos_delete" on suplementos;
--
-- create policy "ejercicios: gestion para autenticados" on ejercicios
--   as permissive for insert to public
--   with check (auth.role() = 'authenticated'::text);
--
-- create policy "ejercicios: actualizacion para autenticados" on ejercicios
--   as permissive for update to public
--   using (auth.role() = 'authenticated'::text);
--
-- create policy "ejercicios: eliminacion para autenticados" on ejercicios
--   as permissive for delete to public
--   using (auth.role() = 'authenticated'::text);
--
-- create policy "ejercicios_update" on ejercicios
--   as permissive for update to authenticated
--   using (
--     ((get_user_rol() = 'superadmin'::text) AND ((created_by IS NULL) OR (EXISTS (SELECT 1 FROM perfiles WHERE ((perfiles.id = ejercicios.created_by) AND (perfiles.rol = 'superadmin'::text))))))
--     OR ((get_user_rol() = 'admin'::text) AND (created_by = auth.uid()))
--   );
--
-- create policy "alimentos: lectura para autenticados" on alimentos
--   as permissive for select to public
--   using (auth.role() = 'authenticated'::text);
--
-- create policy "alimentos: gestion para autenticados" on alimentos
--   as permissive for all to public
--   using (auth.role() = 'authenticated'::text)
--   with check (auth.role() = 'authenticated'::text);
--
-- create policy "alimentos_update" on alimentos
--   as permissive for update to authenticated
--   using (
--     ((get_user_rol() = 'superadmin'::text) AND ((created_by IS NULL) OR (EXISTS (SELECT 1 FROM perfiles WHERE ((perfiles.id = alimentos.created_by) AND (perfiles.rol = 'superadmin'::text))))))
--     OR ((get_user_rol() = 'admin'::text) AND (created_by = auth.uid()))
--   );
--
-- create policy "suplementos: gestion para autenticados" on suplementos
--   as permissive for all to public
--   using (auth.role() = 'authenticated'::text)
--   with check (auth.role() = 'authenticated'::text);
-- ============================================================

-- ============================================================
-- 56. MIGRACIÓN — Corrige el acceso SELECT de superadmin y cierra
--     el directorio público/multi-tenant de perfiles
-- ============================================================
-- Verificado contra pg_policies + information_schema.role_table_grants
-- reales de producción, y contra código real (mobile-app + admin-web +
-- Edge Functions) el 2026-08-28.
--
-- HALLAZGO 1: "perfiles: lectura multi-tenant" no tenía cláusula de
-- superadmin (a diferencia de todas las demás tablas de esta sesión) —
-- un superadmin solo veía su propio perfil, filas rol='admin', y
-- pacientes donde nutricionista_id=auth.uid(). Confirmado como bug
-- funcional real: admin-web/app/(admin)/dashboard/page.tsx (conteos y
-- listado de pacientes recientes) y fetchAdmins() en
-- admin-web/app/_data/perfiles.ts quedaban incompletos para un
-- superadmin sin relación directa de nutricionista_id.
--
-- HALLAZGO 2: "perfiles: admins publicos" (roles={anon}) y la cláusula
-- "rol = 'admin'" de "perfiles: lectura multi-tenant" (roles={public},
-- incluye anon) exponían perfiles COMPLETA (RLS filtra filas, no
-- columnas) a cualquier no-autenticado y a cualquier autenticado
-- (paciente incluido). Confirmado con information_schema.role_table_grants
-- real: anon/authenticated tienen GRANT de tabla completo sobre
-- perfiles — RLS era la única barrera, sin restricción de columna.
--
-- Único consumidor real de "rol='admin'" para anon: mobile-app
-- nutricionistas.ts (pantalla de registro, pre-sesión), que solo
-- necesita id/nombre_completo/email/avatar_url — se reemplaza por la
-- view pública nutricionistas_publicos.
--
-- Único consumidor real de "rol IN (admin,superadmin)" para un
-- autenticado no-superadmin: admin-web fetchAdmins() (/administradores).
-- Decisión de producto aprobada: /administradores pasa a ser
-- superadmin-only. Cambio de frontend en fase posterior, NO incluido
-- aquí. Efecto transitorio esperado mientras tanto: un admin
-- no-superadmin que visite /administradores verá la lista vacía (0
-- filas, sin error) hasta que se aplique ese gate.
--
-- historia_clinica: decisión de producto explícita de NO agregar acceso
-- superadmin (mínimo privilegio sobre información clínica) — fuera de
-- alcance, no se toca.

drop policy if exists "perfiles: lectura multi-tenant" on perfiles;
create policy "perfiles: lectura multi-tenant" on perfiles
for select to authenticated using (
  auth.uid() = id
  or auth.uid() = nutricionista_id
  or public.get_user_rol() = 'superadmin'
);

drop policy if exists "perfiles: admins publicos" on perfiles;

create view public.nutricionistas_publicos
with (security_invoker = false, security_barrier = true)
as
select id, nombre_completo, email, avatar_url
from public.perfiles
where rol = 'admin';

-- Supabase concede automáticamente ALL PRIVILEGES a anon/authenticated
-- sobre cualquier objeto nuevo de public (confirmado también para views,
-- no solo tablas) — sin este REVOKE explícito, la view queda con
-- INSERT/UPDATE/DELETE abiertos. Como es una vista auto-updatable
-- (select simple de una sola tabla, sin agregados/DISTINCT) con
-- security_invoker=false, un UPDATE/DELETE ejecutado a través de ella
-- corre con el contexto del dueño (postgres, dueño también de perfiles)
-- y bypasea por completo la RLS de perfiles — hallazgo real detectado
-- tras aplicar esta sección en producción. Se deja explícito aquí para
-- que sea reproducible desde cero: un futuro "supabase db reset" no debe
-- reintroducir los grants amplios por defecto.
revoke all privileges on public.nutricionistas_publicos from public, anon, authenticated;
grant select on public.nutricionistas_publicos to anon, authenticated;

-- ============================================================
-- ROLLBACK Sección 56 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección). Reconstruido a partir de pg_policies real de
-- producción, verificado el 2026-08-28:
--
-- drop view if exists public.nutricionistas_publicos;
--
-- drop policy if exists "perfiles: lectura multi-tenant" on perfiles;
-- create policy "perfiles: lectura multi-tenant" on perfiles
--   as permissive for select to public
--   using (((auth.uid() = id) OR (rol = 'admin'::text) OR (auth.uid() = nutricionista_id)));
--
-- create policy "perfiles: admins publicos" on perfiles
--   as permissive for select to anon
--   using (rol = 'admin'::text);
-- ============================================================

-- ============================================================
-- 58. MIGRACIÓN — RPC atómica: guardar_rutina_completa
-- ============================================================
-- Reemplaza a saveRutina()/replaceDias() (admin-web/app/_data/rutinas.ts),
-- que hacían UPDATE/INSERT del padre + DELETE de todos los rutina_dias +
-- INSERT día por día + INSERT de rutina_ejercicios como llamadas HTTP
-- independientes: si cualquier paso a mitad de camino fallaba (ej. un
-- ejercicio con dia_id inválido, o un error de red), la rutina quedaba con
-- ejercicios ya borrados y solo una parte de los días nuevos insertados.
--
-- Diseño: función plpgsql única, SECURITY INVOKER (corre con los
-- privilegios/RLS del que llama — nunca eleva permisos), que envuelve todo
-- el flujo en la transacción implícita de la función: cualquier excepción
-- (constraint, RLS, o "raise exception" explícito) revierte automáticamente
-- todo lo hecho hasta ese punto. No cambia el modelo de datos ni las reglas
-- de negocio existentes — solo las hace atómicas.
--
-- Verificado contra el schema real antes de escribir esto:
--   * rutinas: nombre, unidad_peso son las únicas columnas que saveRutina()
--     actualiza en UPDATE (Sección 3 + 28).
--   * rutina_dias: numero_dia (check 1..7), nombre_dia, es_descanso
--     (Sección 3). Sin policy UPDATE — por eso el flujo real siempre borra
--     e inserta de nuevo, nunca actualiza una fila existente.
--   * rutina_ejercicios: ejercicio_id, orden, series, repeticiones,
--     peso_sugerido_kg, descanso_seg, rir, rpe, series_detalle,
--     tipo_esfuerzo, unidad_peso (Secciones 3+25+28+33), con CHECK
--     peso_sugerido_kg/descanso_seg/rir/rpe >= 0 (Sección 37). Sin policy
--     UPDATE/DELETE — se limpian por cascada al borrar el rutina_dia padre.
--   * RLS activa (Sección 48/49): rutinas_insert exige paciente
--     activo+aprobado (get_perfil_activo_aprobado); rutinas_update exige
--     nutricionista_id=auth.uid() o superadmin; rutina_dias_insert y
--     rutina_ejercicios_insert validan ownership vía el mismo join a
--     rutinas. La función NO duplica esta lógica — al correr como
--     SECURITY INVOKER, cada INSERT/UPDATE que hace dentro sigue sujeto a
--     estas policies exactamente igual que si el cliente las llamara
--     directo. Un error de permiso real (RLS) se propaga tal cual — nunca
--     se atrapa ni se oculta.
--   * El caso "UPDATE no afectó ninguna fila" (rutina inexistente, o
--     visible-pero-no-editable por RLS) no es un error de Postgres por sí
--     mismo (UPDATE de 0 filas no lanza excepción) — se detecta a mano
--     comprobando que RETURNING produjo una fila, y se convierte en un
--     "raise exception" explícito para que el cliente reciba un error real
--     en vez de un éxito silencioso sobre nada.
--
-- set search_path = public: fijación defensiva estándar (recomendada para
-- toda función SQL/plpgsql de Postgres, no solo SECURITY DEFINER) — evita
-- que un search_path manipulado en la sesión cambie a qué tabla resuelven
-- los nombres sin schema dentro de la función.
create or replace function public.guardar_rutina_completa(
  p_user_id uuid,
  p_rutina_id uuid,
  p_nombre text,
  p_unidad_peso text,
  p_dias jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rutina_id uuid;
  v_dia jsonb;
  v_dia_id uuid;
  v_ejercicio jsonb;
begin
  if p_rutina_id is null then
    insert into public.rutinas (user_id, nombre, unidad_peso)
    values (p_user_id, p_nombre, p_unidad_peso)
    returning id into v_rutina_id;
  else
    update public.rutinas
    set nombre = p_nombre, unidad_peso = p_unidad_peso
    where id = p_rutina_id
    returning id into v_rutina_id;

    if v_rutina_id is null then
      raise exception 'Rutina no encontrada o sin permiso para modificarla';
    end if;
  end if;

  delete from public.rutina_dias where rutina_id = v_rutina_id;

  for v_dia in select * from jsonb_array_elements(coalesce(p_dias, '[]'::jsonb))
  loop
    insert into public.rutina_dias (rutina_id, numero_dia, nombre_dia, es_descanso)
    values (
      v_rutina_id,
      (v_dia->>'numero_dia')::int,
      v_dia->>'nombre_dia',
      coalesce((v_dia->>'es_descanso')::boolean, false)
    )
    returning id into v_dia_id;

    for v_ejercicio in select * from jsonb_array_elements(coalesce(v_dia->'ejercicios', '[]'::jsonb))
    loop
      insert into public.rutina_ejercicios (
        dia_id, ejercicio_id, orden, series, repeticiones,
        peso_sugerido_kg, descanso_seg, rir, rpe, tipo_esfuerzo,
        series_detalle, unidad_peso
      ) values (
        v_dia_id,
        (v_ejercicio->>'ejercicio_id')::uuid,
        (v_ejercicio->>'orden')::int,
        (v_ejercicio->>'series')::int,
        v_ejercicio->>'repeticiones',
        (v_ejercicio->>'peso_sugerido_kg')::numeric,
        (v_ejercicio->>'descanso_seg')::int,
        (v_ejercicio->>'rir')::int,
        (v_ejercicio->>'rpe')::numeric,
        coalesce(v_ejercicio->>'tipo_esfuerzo', 'reps'),
        v_ejercicio->'series_detalle',
        v_ejercicio->>'unidad_peso'
      );
    end loop;
  end loop;

  return v_rutina_id;
end;
$$;

-- Postgres concede EXECUTE a PUBLIC automáticamente al crear una función
-- (comportamiento estándar del motor, no específico de Supabase). Como esta
-- es la primera función pensada para ser invocada directo por el cliente
-- vía .rpc() en todo el proyecto (antes no existía ningún precedente que
-- revisar), se estableció aquí el patrón: cerrar PUBLIC explícitamente y
-- abrir solo a "authenticated".
--
-- CORRECCIÓN (verificado en producción tras el primer deploy): "revoke all
-- ... from public" NO fue suficiente — information_schema.routine_privileges
-- en producción mostró EXECUTE concedido también a "anon" de forma
-- explícita, no solo heredado de PUBLIC. Mismo hallazgo de fondo que la
-- Sección 56 (Supabase concede privilegios amplios por defecto a
-- anon/authenticated/service_role sobre objetos nuevos de "public", esta
-- vez confirmado también para funciones, no solo tablas/views) — un REVOKE
-- de PUBLIC no retira un grant que ya está explícito sobre un rol nombrado.
-- Se agrega "anon" explícitamente al REVOKE. anon nunca necesita llamar
-- esto (ninguna pantalla de rutinas es accesible sin sesión), y
-- "authenticated" de todas formas queda sujeto a la RLS interna de cada
-- INSERT/UPDATE que la función ejecuta. No se tocan los privilegios de
-- postgres/service_role (contexto administrativo/servidor de confianza,
-- decisión de producto explícita — no es necesario ni se busca cerrarlos).
revoke execute on function public.guardar_rutina_completa(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.guardar_rutina_completa(uuid, uuid, text, text, jsonb) to authenticated;

-- ============================================================
-- ROLLBACK Sección 58 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop function if exists public.guardar_rutina_completa(uuid, uuid, text, text, jsonb);
-- ============================================================

-- ============================================================
-- 59. MIGRACIÓN — RPC atómica: actualizar_receta_completa
-- ============================================================
-- Reemplaza a updateReceta() (admin-web/app/_data/recetas.ts), que hacía
-- UPDATE del padre + replaceIngredientes() + replacePasos() como llamadas
-- independientes (las dos últimas incluso en paralelo vía Promise.all): si
-- el UPDATE del padre tenía éxito pero cualquiera de las dos fallaba
-- después, la receta quedaba con datos nuevos pero ingredientes/pasos
-- borrados a medias — o, por el paralelismo, con una mezcla de estados
-- parciales entre ambas listas.
--
-- Fuera de alcance (no tocado aquí, por instrucción explícita): createReceta(),
-- saveRecetaPersonalizada() en su rama de creación, personalizeReceta() y
-- duplicateReceta() — todos quedan pendientes como P2/P3 en una ronda
-- posterior. saveRecetaPersonalizada() SÍ se beneficia indirectamente de
-- este fix en su rama de "ya existe copia personal", porque esa rama llama
-- a updateReceta() tal cual.
--
-- Verificado contra el schema real:
--   * recetas: columnas editables por updateReceta() = nombre, emoji, tipo,
--     categoria_nutricional, tags, tiempo_prep_min, tiempo_coccion_min,
--     tiempo_min, nivel, calorias, porciones, proteinas_g, carbohidratos_g,
--     grasas_g (Sección 6). id/user_id/receta_base_id/created_by/created_at
--     están protegidas por el trigger proteger_columnas_recetas (Sección
--     52) — la función NO las toca, igual que el código actual.
--   * receta_ingredientes: descripcion, alimento_id, cantidad, unidad
--     (Secciones 6+24); "grupo" (Sección 31) nunca lo escribe replaceIngredientes()
--     actual, así que tampoco lo escribe esta función (queda NULL en cada
--     fila nueva, mismo comportamiento de hoy). El trigger
--     proteger_columnas_receta_ingredientes (Sección 52) solo permite
--     UPDATE de alimento_id — irrelevante aquí porque el flujo real siempre
--     hace DELETE+INSERT de filas nuevas, nunca UPDATE de una existente.
--     CHECK cantidad >= 0 (Sección 37).
--   * receta_pasos: descripcion + numero autogenerado por posición
--     (Sección 6) — sin policy UPDATE en absoluto (Sección 52), coherente
--     con que el flujo real tampoco intenta actualizar pasos existentes.
--   * RLS activa (Sección 52): recetas_update exige, para catálogo
--     (user_id is null), created_by=auth.uid() o superadmin; para
--     personalizada (user_id is not null), nutricionista_id=auth.uid() o
--     superadmin. receta_ingredientes_insert/receta_pasos_insert validan la
--     MISMA condición vía join a recetas — por eso basta con que el UPDATE
--     del padre tenga éxito para saber que los INSERT de hijos, hechos por
--     el mismo caller en la misma transacción, también la cumplirán.
create or replace function public.actualizar_receta_completa(
  p_receta_id uuid,
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
  p_pasos jsonb
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
  update public.recetas set
    nombre = p_nombre,
    emoji = p_emoji,
    tipo = p_tipo,
    categoria_nutricional = p_categoria_nutricional,
    tags = p_tags,
    tiempo_prep_min = p_tiempo_prep_min,
    tiempo_coccion_min = p_tiempo_coccion_min,
    tiempo_min = p_tiempo_min,
    nivel = p_nivel,
    calorias = p_calorias,
    porciones = p_porciones,
    proteinas_g = p_proteinas_g,
    carbohidratos_g = p_carbohidratos_g,
    grasas_g = p_grasas_g
  where id = p_receta_id
  returning id into v_receta_id;

  if v_receta_id is null then
    raise exception 'Receta no encontrada o sin permiso para modificarla';
  end if;

  delete from public.receta_ingredientes where receta_id = v_receta_id;
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

  delete from public.receta_pasos where receta_id = v_receta_id;
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

-- Mismo patrón corregido de la Sección 58: "from public" solo no basta,
-- anon necesita quedar explícito en el REVOKE.
revoke execute on function public.actualizar_receta_completa(
  uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb
) from public, anon;
grant execute on function public.actualizar_receta_completa(
  uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb
) to authenticated;

-- ============================================================
-- ROLLBACK Sección 59 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop function if exists public.actualizar_receta_completa(
--   uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb
-- );
-- ============================================================

-- ============================================================
-- 60. MIGRACIÓN — RPC atómica: asignar_recetas_paciente
-- ============================================================
-- Reemplaza a saveRecetasAsignadas() (admin-web/app/_data/recetas_guardadas.ts):
-- DELETE de todas las recetas_guardadas del paciente + INSERT del nuevo
-- set, como dos llamadas independientes. Si el INSERT fallaba (ej. porque
-- el nutricionista intentó asignar una receta personalizada de OTRO
-- paciente — bloqueado por el invariante de recetas_guardadas_insert,
-- Sección 53), el paciente quedaba sin ninguna receta asignada: el DELETE
-- ya se había aplicado y confirmado por separado.
--
-- Verificado contra el schema real: recetas_guardadas solo tiene
-- (user_id, receta_id, tiempo_comida, created_at) (Secciones 6+29) — sin
-- policy UPDATE utilizable aquí (el trigger proteger_columnas_recetas_guardadas
-- de la Sección 53 solo permite cambiar receta_id vía UPDATE, no aplica a
-- un DELETE+INSERT). RLS activa (Sección 53):
-- recetas_guardadas_delete y recetas_guardadas_insert exigen
-- nutricionista_id=auth.uid() o superadmin; recetas_guardadas_insert
-- además valida el invariante receta↔paciente (catálogo, o personalizada
-- del mismo paciente). Un DELETE sobre filas que el caller no puede tocar
-- simplemente afecta 0 filas (no es error) — mismo comportamiento que hoy;
-- lo que cambia es que si el INSERT posterior falla por RLS, el DELETE de
-- ese mismo caller se revierte junto con él en vez de quedar aplicado.
create or replace function public.asignar_recetas_paciente(
  p_user_id uuid,
  p_asignadas jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
begin
  delete from public.recetas_guardadas where user_id = p_user_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_asignadas, '[]'::jsonb))
  loop
    insert into public.recetas_guardadas (user_id, receta_id, tiempo_comida)
    values (p_user_id, (v_item->>'receta_id')::uuid, v_item->>'tiempo_comida');
  end loop;
end;
$$;

-- Mismo patrón corregido de la Sección 58: "from public" solo no basta,
-- anon necesita quedar explícito en el REVOKE.
revoke execute on function public.asignar_recetas_paciente(uuid, jsonb) from public, anon;
grant execute on function public.asignar_recetas_paciente(uuid, jsonb) to authenticated;

-- ============================================================
-- ROLLBACK Sección 60 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop function if exists public.asignar_recetas_paciente(uuid, jsonb);
-- ============================================================

-- ============================================================
-- 61. MIGRACIÓN — RPC atómica: guardar_plan_suplementacion
-- ============================================================
-- Reemplaza a savePlanSuplementacion() (admin-web/app/_data/plan_suplementacion.ts):
-- mismo patrón y mismo riesgo que la Sección 60, aplicado a
-- plan_suplementacion. Si el INSERT fallaba (ej. porque get_perfil_activo_aprobado()
-- rechazó al paciente destino — Sección 51), el plan de suplementación del
-- paciente quedaba completamente vacío en vez de conservar el anterior.
--
-- Verificado contra el schema real: plan_suplementacion tiene id, user_id,
-- suplemento_id, dosis, hora, momento, notas (Secciones 7+31). RLS activa
-- (Sección 51): plan_suplementacion_delete exige nutricionista_id=auth.uid()
-- o superadmin (sin condición de estado del paciente); plan_suplementacion_insert
-- exige lo mismo MÁS get_perfil_activo_aprobado(user_id). Nótese que
-- plan_suplementacion_update solo permite auth.uid()=user_id (el propio
-- paciente) — irrelevante aquí porque esta función nunca actualiza, solo
-- borra e inserta, igual que el código actual.
create or replace function public.guardar_plan_suplementacion(
  p_user_id uuid,
  p_items jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
begin
  delete from public.plan_suplementacion where user_id = p_user_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.plan_suplementacion (user_id, suplemento_id, dosis, hora, momento, notas)
    values (
      p_user_id,
      (v_item->>'suplemento_id')::uuid,
      v_item->>'dosis',
      nullif(v_item->>'hora', '')::time,
      v_item->>'momento',
      v_item->>'notas'
    );
  end loop;
end;
$$;

-- Mismo patrón corregido de la Sección 58: "from public" solo no basta,
-- anon necesita quedar explícito en el REVOKE.
revoke execute on function public.guardar_plan_suplementacion(uuid, jsonb) from public, anon;
grant execute on function public.guardar_plan_suplementacion(uuid, jsonb) to authenticated;

-- ============================================================
-- ROLLBACK Sección 61 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop function if exists public.guardar_plan_suplementacion(uuid, jsonb);
-- ============================================================

-- ============================================================
-- 63. MIGRACIÓN — RPC atómica: crear_receta_completa
-- ============================================================
-- Parte del reemplazo de supabase/seed_recetas.sql (H1 del barrido final
-- de auditoría) por scripts/seed-recetas.mjs. El seed viejo hacía
-- "DELETE FROM recetas WHERE user_id IS NULL" + reinserción completa del
-- catálogo con IDs nuevos en cada corrida — el nuevo script hace upsert
-- por (nombre, tipo): actualiza in-place las recetas que ya existen (vía
-- actualizar_receta_completa, Sección 59) y usa ESTA función para las que
-- son genuinamente nuevas. actualizar_receta_completa no sirve para este
-- caso porque su UPDATE ... WHERE id = p_receta_id no puede crear una fila
-- que no existe (lanza "Receta no encontrada" si RETURNING no produce
-- fila) — hace falta una función de INSERT dedicada con la misma
-- atomicidad (padre + ingredientes + pasos en una sola transacción).
--
-- Mismo diseño que actualizar_receta_completa: SECURITY INVOKER, respeta
-- el trigger set_created_by_recetas (Sección 52) y todas las policies de
-- recetas_insert/receta_ingredientes_insert/receta_pasos_insert
-- existentes sin duplicarlas — quien llame a esta función queda sujeto a
-- las mismas reglas que si hiciera el INSERT directo.
--
-- Único consumidor real hoy: scripts/seed-recetas.mjs, vía
-- SUPABASE_SERVICE_ROLE_KEY (bypasea RLS igual que cualquier otra
-- operación de service_role en este proyecto). Por eso el grant es más
-- estricto que el de las Secciones 58-61: ni siquiera "authenticated" lo
-- necesita hoy (createReceta() en admin-web sigue usando su flujo actual,
-- sin tocar — fuera de alcance de H1), así que se revoca también de
-- authenticated, no solo de public/anon — mismo criterio "cero
-- privilegios salvo necesidad real demostrada" aplicado a suscripciones
-- en la Sección 62.
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
  p_pasos jsonb
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
    porciones, proteinas_g, carbohidratos_g, grasas_g
  ) values (
    p_user_id, p_nombre, p_emoji, p_tipo, p_categoria_nutricional, p_tags,
    p_tiempo_prep_min, p_tiempo_coccion_min, p_tiempo_min, p_nivel, p_calorias,
    p_porciones, p_proteinas_g, p_carbohidratos_g, p_grasas_g
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

revoke all on function public.crear_receta_completa(
  uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb
) from public, anon, authenticated;

-- ============================================================
-- ROLLBACK Sección 63 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop function if exists public.crear_receta_completa(
--   uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb
-- );
-- ============================================================

-- ============================================================
-- 64. MIGRACIÓN — Storage: cierra "cualquier authenticated" en
--     avatars y videos-ejercicios (H2 del barrido final de auditoría)
-- ============================================================
-- Verificado en producción: ambos buckets son public=true (diseño
-- intencional — avatares y videos de ejercicios son contenido no
-- sensible pensado para lectura pública, eso NO cambia aquí). El
-- problema real es la policy de ESCRITURA: "gestion autenticados" en
-- ambos buckets solo exige auth.role() = 'authenticated' — cualquier
-- paciente logueado puede, llamando directo a la Storage API (no
-- expuesto por la UI, pero la policy no lo impide), sobrescribir o
-- borrar el avatar de OTRO usuario o cualquier video de ejercicio del
-- catálogo.
--
-- IMPORTANTE: esta sección NO toca grants de tabla sobre storage.objects
-- (ese objeto es compartido por todos los buckets del proyecto — un
-- REVOKE ahí afectaría buckets fuera de este alcance). La corrección es
-- exclusivamente a nivel de policy, específica por bucket_id.
--
-- Paths reales verificados en código (no asumidos):
--   * avatars, autogestión: mobile-app perfil.tsx y admin-web
--     mi-perfil/page.tsx suben siempre a "${auth.uid()}.${ext}" — el
--     propio usuario, nunca uno ajeno.
--   * avatars, gestión cruzada real: admin-web administradores/page.tsx
--     (página ya gated a superadmin en el frontend, Sección 56) sube a
--     "${editing.id}.${ext}" donde editing es OTRO admin — flujo legítimo
--     que la policy debe seguir permitiendo, solo para superadmin.
--   * avatars, reutilizado como bucket genérico de imágenes públicas:
--     admin-web _data/suplementos.ts sube bajo el prefijo
--     "suplementos/${...}" — sin relación con ningún user_id. La tabla
--     suplementos ya restringe INSERT/UPDATE/DELETE a admin/superadmin
--     (verificado); la policy de Storage debe reflejar el mismo criterio.
--   * videos-ejercicios: admin-web _data/ejercicios.ts sube a
--     "${crypto.randomUUID()}.${ext}" — sin ninguna codificación de
--     ownership en el path, coherente con que el criterio de acceso es
--     puramente por rol (admin/superadmin), igual que ejercicios_insert/
--     update/delete sobre la tabla ejercicios.
--
-- Se separan las capacidades en policies distintas (una por cada caso de
-- uso real) en vez de una sola policy "ALL" gigante con un OR largo —
-- más clara de leer, de testear, y de desactivar individualmente si algún
-- caso de uso cambia en el futuro.

-- ── avatars ──────────────────────────────────────────────────
drop policy if exists "avatars: gestion autenticados" on storage.objects;
-- "avatars: lectura publica" se conserva sin cambios (diseño público intencional).

create policy "avatars: gestion propia" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and name like (auth.uid()::text || '.%'))
  with check (bucket_id = 'avatars' and name like (auth.uid()::text || '.%'));

create policy "avatars: gestion suplementos admin" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'avatars' and name like 'suplementos/%'
    and public.get_user_rol() in ('admin', 'superadmin')
  )
  with check (
    bucket_id = 'avatars' and name like 'suplementos/%'
    and public.get_user_rol() in ('admin', 'superadmin')
  );

create policy "avatars: gestion superadmin" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and public.get_user_rol() = 'superadmin')
  with check (bucket_id = 'avatars' and public.get_user_rol() = 'superadmin');

-- ── videos-ejercicios ────────────────────────────────────────
drop policy if exists "videos-ejercicios: gestion autenticados" on storage.objects;
-- "videos-ejercicios: lectura publica" se conserva sin cambios.

create policy "videos-ejercicios: gestion admin superadmin" on storage.objects
  for all to authenticated
  using (bucket_id = 'videos-ejercicios' and public.get_user_rol() in ('admin', 'superadmin'))
  with check (bucket_id = 'videos-ejercicios' and public.get_user_rol() in ('admin', 'superadmin'));

-- ============================================================
-- ROLLBACK Sección 64 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop policy if exists "avatars: gestion propia" on storage.objects;
-- drop policy if exists "avatars: gestion suplementos admin" on storage.objects;
-- drop policy if exists "avatars: gestion superadmin" on storage.objects;
-- create policy "avatars: gestion autenticados" on storage.objects
--   for all
--   using (bucket_id = 'avatars' and auth.role() = 'authenticated')
--   with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
--
-- drop policy if exists "videos-ejercicios: gestion admin superadmin" on storage.objects;
-- create policy "videos-ejercicios: gestion autenticados" on storage.objects
--   for all
--   using (bucket_id = 'videos-ejercicios' and auth.role() = 'authenticated')
--   with check (bucket_id = 'videos-ejercicios' and auth.role() = 'authenticated');
-- ============================================================

-- ============================================================
-- 65. MIGRACIÓN — alimentos: columna "equivalentes"
-- ============================================================
-- Cada fila de alimentos representa una porción (cantidad + unidad) que
-- por definición del sistema de equivalentes (SMAE) equivale a 1
-- equivalente de su categoria (grupo de alimento). Se agrega como columna
-- explícita, en vez de asumir siempre 1 en el código, para permitir casos
-- reales donde una porción capturada equivalga a más de 1 (ej. una
-- porción grande que en realidad son 2 equivalentes del grupo).
--
-- default 1 aplica automáticamente a las filas existentes (todas las
-- porciones ya cargadas son, por diseño del catálogo actual, 1
-- equivalente cada una) y a las nuevas si no se especifica otro valor.
alter table alimentos
  add column if not exists equivalentes numeric not null default 1;

alter table alimentos
  add constraint alimentos_equivalentes_non_neg check (equivalentes >= 0);

-- ============================================================
-- ROLLBACK Sección 65 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- alter table alimentos drop constraint if exists alimentos_equivalentes_non_neg;
-- alter table alimentos drop column if exists equivalentes;
-- ============================================================

-- ============================================================
-- 66. MIGRACIÓN — recetas: foto del platillo (columnas + bucket + RPC)
-- ============================================================
-- Mismo patrón ya usado por ejercicios.video_url/video_storage_path
-- (Sección 10/11): columna pública (URL servida por Storage) + columna
-- interna (path dentro del bucket, solo para poder borrar el archivo
-- viejo cuando se reemplaza; null si no hay archivo propio subido).
alter table recetas
  add column if not exists foto_url text,
  add column if not exists foto_storage_path text;

-- Bucket público para fotos de platillos, subido desde admin-web
-- (RecetaModal.tsx). Mismo criterio de acceso que "videos-ejercicios":
-- lectura pública, escritura solo admin/superadmin — el catálogo de
-- recetas ya restringe INSERT/UPDATE/DELETE de la tabla "recetas" a
-- autenticados vía RLS (Sección 52), y esta es la misma superficie
-- (gestión del catálogo), no contenido subido por pacientes.
insert into storage.buckets (id, name, public)
values ('recetas-fotos', 'recetas-fotos', true)
on conflict (id) do nothing;

drop policy if exists "recetas-fotos: lectura publica" on storage.objects;
create policy "recetas-fotos: lectura publica"
  on storage.objects for select using (bucket_id = 'recetas-fotos');

drop policy if exists "recetas-fotos: gestion admin superadmin" on storage.objects;
create policy "recetas-fotos: gestion admin superadmin" on storage.objects
  for all to authenticated
  using (bucket_id = 'recetas-fotos' and public.get_user_rol() in ('admin', 'superadmin'))
  with check (bucket_id = 'recetas-fotos' and public.get_user_rol() in ('admin', 'superadmin'));

-- actualizar_receta_completa (Sección 59) gana 2 parámetros nuevos al
-- final para no reordenar los existentes. Cambiar la firma de una
-- función crea un OVERLOAD en vez de reemplazarla — hay que tirar la
-- versión vieja explícitamente antes de crear la nueva.
drop function if exists public.actualizar_receta_completa(
  uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb
);

create or replace function public.actualizar_receta_completa(
  p_receta_id uuid,
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
  p_foto_url text,
  p_foto_storage_path text
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
  update public.recetas set
    nombre = p_nombre,
    emoji = p_emoji,
    tipo = p_tipo,
    categoria_nutricional = p_categoria_nutricional,
    tags = p_tags,
    tiempo_prep_min = p_tiempo_prep_min,
    tiempo_coccion_min = p_tiempo_coccion_min,
    tiempo_min = p_tiempo_min,
    nivel = p_nivel,
    calorias = p_calorias,
    porciones = p_porciones,
    proteinas_g = p_proteinas_g,
    carbohidratos_g = p_carbohidratos_g,
    grasas_g = p_grasas_g,
    foto_url = p_foto_url,
    foto_storage_path = p_foto_storage_path
  where id = p_receta_id
  returning id into v_receta_id;

  if v_receta_id is null then
    raise exception 'Receta no encontrada o sin permiso para modificarla';
  end if;

  delete from public.receta_ingredientes where receta_id = v_receta_id;
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

  delete from public.receta_pasos where receta_id = v_receta_id;
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

revoke execute on function public.actualizar_receta_completa(
  uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb, text, text
) from public, anon;
grant execute on function public.actualizar_receta_completa(
  uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb, text, text
) to authenticated;

-- ============================================================
-- ROLLBACK Sección 66 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop function if exists public.actualizar_receta_completa(
--   uuid, text, text, text, text, text, int, int, int, text, int, text, numeric, numeric, numeric, jsonb, jsonb, text, text
-- );
-- [recrear aquí la versión de 17 parámetros de la Sección 59 si se revierte]
--
-- drop policy if exists "recetas-fotos: gestion admin superadmin" on storage.objects;
-- drop policy if exists "recetas-fotos: lectura publica" on storage.objects;
-- delete from storage.buckets where id = 'recetas-fotos';
--
-- alter table recetas drop column if exists foto_storage_path;
-- alter table recetas drop column if exists foto_url;
-- ============================================================

-- ============================================================
-- 67. MIGRACIÓN — ejercicios: GIF subido desde admin-web
-- ============================================================
-- gif_url ya existía (Sección 41a), pero solo lo llenaba la Edge Function
-- migrate-gifs (service_role, bypasea RLS) al importar el catálogo de
-- WorkoutX — el formulario de alta manual de admin-web (EjercicioModal.tsx)
-- nunca lo exponía, así que un ejercicio creado a mano no podía tener GIF.
--
-- Se agrega gif_storage_path (mismo patrón pareado que video_url/
-- video_storage_path, Sección 10/11, y foto_url/foto_storage_path de
-- recetas, Sección 66) para poder borrar el archivo viejo cuando se
-- reemplaza un GIF subido desde admin-web. Los GIF importados de WorkoutX
-- quedan con gif_storage_path = NULL (no se conoce su path real dentro del
-- bucket) — eso es intencional y no se toca aquí.
alter table ejercicios
  add column if not exists gif_storage_path text;

-- El bucket "exercise-gifs" estaba documentado (Sección 42) pero, según lo
-- verificado en producción durante el barrido final de auditoría (H2,
-- 2026-09-02), nunca se llegó a crear en el Dashboard. Se crea aquí vía SQL
-- (mismo mecanismo ya usado para "videos-ejercicios" y "recetas-fotos" en
-- vez de depender de un paso manual en el Dashboard que ya se demostró que
-- se puede olvidar.
insert into storage.buckets (id, name, public)
values ('exercise-gifs', 'exercise-gifs', true)
on conflict (id) do nothing;

drop policy if exists "exercise-gifs: lectura publica" on storage.objects;
create policy "exercise-gifs: lectura publica"
  on storage.objects for select using (bucket_id = 'exercise-gifs');

-- Mismo criterio que "videos-ejercicios: gestion admin superadmin"
-- (Sección 64): la gestión del catálogo de ejercicios ya está restringida
-- a admin/superadmin a nivel de tabla (ejercicios_insert/update/delete,
-- Sección 40/41h) — la policy de Storage debe reflejar el mismo criterio,
-- ya que ahora admin-web sube directo desde el navegador (no service_role).
drop policy if exists "exercise-gifs: gestion admin superadmin" on storage.objects;
create policy "exercise-gifs: gestion admin superadmin" on storage.objects
  for all to authenticated
  using (bucket_id = 'exercise-gifs' and public.get_user_rol() in ('admin', 'superadmin'))
  with check (bucket_id = 'exercise-gifs' and public.get_user_rol() in ('admin', 'superadmin'));

-- ============================================================
-- ROLLBACK Sección 67 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop policy if exists "exercise-gifs: gestion admin superadmin" on storage.objects;
-- drop policy if exists "exercise-gifs: lectura publica" on storage.objects;
-- delete from storage.buckets where id = 'exercise-gifs';
--
-- alter table ejercicios drop column if exists gif_storage_path;
-- ============================================================

-- ============================================================
-- 68. MIGRACIÓN — MyFitTrack Radar (R1): dias_completados real
-- ============================================================
-- Blueprint v1.1, Fase A, R1. La tabla dias_completados ya existía desde
-- la Sección 3 (unique(user_id, dia_id, fecha) ya cubre la idempotencia
-- que Radar necesita), pero nunca tuvo un consumidor real — mobile-app
-- (rutinas.tsx) guardaba "día completado" únicamente en AsyncStorage.
-- Radar necesita que esta tabla sea la fuente de verdad real para poder
-- calcular adherencia de entrenamiento.
--
-- RLS verificada antes de tocarla (Sección 8, sin cambios desde entonces):
-- una sola policy "for all using (auth.uid() = user_id)" — el paciente
-- gestiona lo suyo, pero a diferencia de medidas/ejercicio_logs (Sección
-- 47, que sí se endureció con visibilidad multi-tenant), el nutriólogo no
-- tenía NINGUNA visibilidad sobre esta tabla. Se cierra ese hueco aquí con
-- el mismo patrón ya establecido en la Sección 47 — no se inventa uno
-- nuevo.
--
-- Sin policy de UPDATE/DELETE: el flujo real (marcarDiaCompletado en
-- mobile-app/src/lib/api/rutinas.ts) hace un upsert con
-- ignoreDuplicates=true contra el UNIQUE ya existente — cubre la
-- idempotencia sin necesitar UPDATE. Nada en el código llama nunca a
-- "desmarcar" un día (verificado en rutinas.tsx: markComplete es de una
-- sola dirección), así que tampoco se agrega DELETE.
drop policy if exists "dias_completados: usuario gestiona los suyos" on dias_completados;

create policy "dias_completados_select" on dias_completados
for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = dias_completados.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "dias_completados_insert" on dias_completados
for insert to authenticated with check (
  auth.uid() = user_id
  or public.get_user_rol() = 'superadmin'
);

-- ============================================================
-- ROLLBACK Sección 68 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop policy if exists "dias_completados_select" on dias_completados;
-- drop policy if exists "dias_completados_insert" on dias_completados;
-- create policy "dias_completados: usuario gestiona los suyos"
--   on dias_completados for all using (auth.uid() = user_id);
-- ============================================================

-- ============================================================
-- 69. MIGRACIÓN — MyFitTrack Radar (R2): nutricion_checks
-- ============================================================
-- Blueprint v1.1, Fase A, R2. Check diario de mínima fricción: el
-- paciente reporta una vez al día si siguió su plan de nutrición.
-- Verificado que no existe ningún concepto equivalente en el schema
-- antes de crear la tabla (búsqueda de "seguimiento"/"cumplimiento"/
-- "adherencia"/"check" — cero resultados relacionados con esto).
--
-- 3 estados en vez de boolean ('seguido'/'parcial'/'no_seguido'): un
-- sí/no binario perdería la información intermedia y reforzaría
-- exactamente el patrón "todo o nada" que el propio Radar busca dejar de
-- reforzar (hallazgo del estudio de mercado que originó Radar).
--
-- Zona horaria: MyFitTrack Radar usa America/Mexico_City como referencia
-- oficial para todo cálculo de "día calendario" (checks, y más adelante
-- ventanas de alertas/intervenciones) — decisión explícita del Blueprint
-- v1.1. El cliente (mobile-app/src/lib/radar-date.ts) escribe `fecha` con
-- esa misma zona horaria; la policy de UPDATE de abajo deriva "hoy" con
-- la misma referencia, para que ambos lados nunca diverjan. Encapsulado
-- en una sola expresión reutilizable para poder migrar a timezone por
-- paciente/profesional más adelante sin tocar cada policy.
create table nutricion_checks (
  id         uuid        default uuid_generate_v4() primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  fecha      date        not null,
  estado     text        not null check (estado in ('seguido', 'parcial', 'no_seguido')),
  nota       text,
  created_at timestamptz not null default now(),
  unique (user_id, fecha)
);

create index on nutricion_checks (user_id, fecha desc);

alter table nutricion_checks enable row level security;

-- Mismo patrón multi-tenant que ejercicio_logs/medidas (Sección 47) — el
-- nutriólogo ve el autorreporte de sus pacientes, nunca lo modifica.
create policy "nutricion_checks_select" on nutricion_checks
for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = nutricion_checks.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "nutricion_checks_insert" on nutricion_checks
for insert to authenticated with check (
  auth.uid() = user_id
  or public.get_user_rol() = 'superadmin'
);

-- El paciente puede corregir el check del día actual (ej. tocó
-- "Parcialmente" por error) — nunca reescribir un día pasado, para que el
-- historial que Radar usará para medir adherencia sea confiable.
create policy "nutricion_checks_update" on nutricion_checks
for update to authenticated using (
  auth.uid() = user_id
  and fecha = (now() at time zone 'America/Mexico_City')::date
) with check (
  auth.uid() = user_id
  and fecha = (now() at time zone 'America/Mexico_City')::date
);

-- Sin DELETE — ningún flujo real lo necesita, y conservar el historial
-- completo es justo lo que Radar necesita para calcular adherencia.

-- ============================================================
-- ROLLBACK Sección 69 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop table if exists nutricion_checks;
-- ============================================================

-- ============================================================
-- 70. MIGRACIÓN — MyFitTrack Radar (R3): perfiles.last_active_at
-- ============================================================
-- Blueprint v1.1, Fase Radar, R3. Señal de actividad real del paciente —
-- distinta de auth.users.last_sign_in_at, que en una app con sesión
-- persistente (autoRefreshToken: true) casi nunca se actualiza tras el
-- primer login (confirmado al diagnosticar el bug de "no hay
-- nutriólogos disponibles" en iOS: last_sign_in_at solo cambia en un
-- sign-in real, nunca en un refresh silencioso de token).
--
-- Revisado antes de tocar perfiles (regla de este proyecto: inspeccionar
-- triggers/policies/RPCs existentes antes de modificar una tabla que ya
-- tiene protección de columnas):
--   - "perfiles: actualizar multi-tenant" permite UPDATE de CUALQUIER
--     columna sobre la propia fila (auth.uid()=id) o la de un paciente
--     asignado (auth.uid()=nutricionista_id) — RLS no distingue
--     columnas, solo filas.
--   - trg_proteger_columnas_sensibles_perfiles (Sección 45) es
--     exactamente el mecanismo ya establecido en este proyecto para
--     cerrar ese hueco a nivel de columna. Se extiende aquí con un
--     tercer bloque — los dos existentes (rol/nutricionista_id/
--     stripe_customer_id y estatus/is_active/plan_membresia) quedan
--     idénticos, sin tocar su lógica.
--
-- Por qué last_active_at necesita una excepción distinta de
-- "current_user = 'service_role'": a registrar_actividad() la llama el
-- propio cliente autenticado (paciente O nutriólogo registrando SU
-- PROPIA actividad), nunca una Edge Function con service_role — esa
-- excepción existente no aplica aquí.
--
-- Dos diseños probados y descartados (documentados aquí para no
-- repetirlos):
--   1) Flag de transacción vía set_config()/current_setting(), encendido
--      antes del UPDATE y apagado después. Falló contra los tests pgTAP
--      reales: pgTAP envuelve cada archivo completo en una única
--      transacción, y el flag no se comportó como "apagado" en llamadas
--      posteriores dentro de esa misma transacción — un mecanismo que
--      depende de "acordarse de apagar el flag" es justo el tipo de
--      estado implícito y frágil que este proyecto evita.
--   2) current_user <> session_user. La hipótesis era que solo una
--      función SECURITY DEFINER produce esa diferencia. Falsa: tanto en
--      los tests (pgTAP simula el rol autenticado con "SET LOCAL ROLE"
--      sobre una conexión que ya inició como "postgres", así que
--      session_user sigue siendo "postgres" incluso en un UPDATE directo
--      normal) como en producción real (PostgREST también opera con
--      "SET ROLE" sobre un pool de conexión con un rol fijo de conexión,
--      no con una conexión nueva por rol) — current_user <> session_user
--      es prácticamente siempre cierto, con o sin SECURITY DEFINER de
--      por medio. No distingue nada.
--
-- Diseño final: registrar_actividad() es SECURITY DEFINER, y el trigger
-- compara current_user contra el nombre literal del rol dueño de la
-- función ("postgres" en este proyecto — verificado contra la base real:
-- select pg_get_userbyid(proowner) from pg_proc where proname =
-- 'registrar_actividad') — exactamente el mismo mecanismo, mismo nivel
-- de "hardcodeo", que ya usa este trigger para "current_user =
-- 'service_role'" dos bloques arriba. current_user SÍ cambia al nombre
-- del dueño mientras se ejecuta una función SECURITY DEFINER,
-- independientemente de cómo la sesión llegó hasta ahí — es la única de
-- las tres señales que realmente se evalúa fresca por invocación sin
-- depender de estado entre sentencias ni de la topología de conexión.
alter table perfiles add column if not exists last_active_at timestamptz;

create or replace function public.registrar_actividad()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Requiere autenticación.';
  end if;
  update public.perfiles set last_active_at = now() where id = auth.uid();
end;
$$;

revoke execute on function public.registrar_actividad() from public, anon;
grant execute on function public.registrar_actividad() to authenticated;

-- Se re-declara la función completa del trigger de la Sección 45,
-- agregando el tercer bloque al final — los dos bloques existentes
-- quedan carácter por carácter idénticos.
create or replace function public.proteger_columnas_sensibles_perfiles()
returns trigger
language plpgsql
as $$
declare
  v_rol      text;
  v_allowed  boolean;
begin
  -- Edge Functions con service role key: sin restricción.
  if current_user = 'service_role' then
    return new;
  end if;

  v_rol := public.get_user_rol();

  -- rol / nutricionista_id / stripe_customer_id: solo superadmin.
  if new.rol is distinct from old.rol
     or new.nutricionista_id is distinct from old.nutricionista_id
     or new.stripe_customer_id is distinct from old.stripe_customer_id
  then
    if v_rol is distinct from 'superadmin' then
      raise exception 'No tienes permiso para modificar rol, nutricionista_id o stripe_customer_id.';
    end if;
  end if;

  -- estatus / is_active / plan_membresia: superadmin, o el nutriólogo
  -- dueño del paciente — nunca el propio paciente sobre sí mismo.
  if new.estatus is distinct from old.estatus
     or new.is_active is distinct from old.is_active
     or new.plan_membresia is distinct from old.plan_membresia
  then
    v_allowed := coalesce(
      coalesce(v_rol = 'superadmin', false)
      or (
        auth.uid() is not null
        and old.nutricionista_id is not null
        and auth.uid() = old.nutricionista_id
        and auth.uid() <> old.id
      ),
      false
    );

    if not v_allowed then
      raise exception 'No tienes permiso para modificar estatus, is_active o plan_membresia de este perfil.';
    end if;
  end if;

  -- last_active_at: exclusivamente vía registrar_actividad() (SECURITY
  -- DEFINER, dueño "postgres") — ni el dueño de la fila, ni su
  -- nutriólogo, ni superadmin pueden tocarla con un UPDATE directo, sin
  -- importar que RLS ya les permita tocar la fila. Mismo mecanismo que la
  -- excepción de "service_role" de arriba, ver el comentario de diseño
  -- de la Sección 70 para las dos alternativas que se probaron y
  -- descartaron antes de esta.
  if new.last_active_at is distinct from old.last_active_at then
    if current_user is distinct from 'postgres' then
      raise exception 'last_active_at solo se puede modificar mediante registrar_actividad().';
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================
-- ROLLBACK Sección 70 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop function if exists public.registrar_actividad();
-- [recrear proteger_columnas_sensibles_perfiles sin el tercer bloque,
--  tal como quedó en la Sección 45, si se revierte]
-- alter table perfiles drop column if exists last_active_at;
-- ============================================================

-- ============================================================
-- 71. MIGRACIÓN — MyFitTrack Radar (R3): suplemento_logs real
-- ============================================================
-- suplemento_logs ya existía desde la Sección 7 con la identidad correcta
-- para lo que Radar necesita: unique(user_id, plan_suplemento_id, fecha)
-- — un log por paciente, por TOMA PROGRAMADA, por día. Verificado contra
-- el modelo real antes de tocar nada: plan_suplementacion no tiene
-- columna de "frecuencia" — cada horario/momento prescrito ya es su
-- propia fila (su propio plan_suplemento_id). Un suplemento tomado 2
-- veces al día ya genera 2 filas de plan_suplementacion independientes
-- (una por horario), así que la identidad existente ya maneja ese caso
-- de forma correcta sin necesitar rediseño: no hay que simplificar a "una
-- fila por suplemento por día", la tabla ya es "una fila por toma
-- programada por día".
--
-- Corrección a lo verificado: SÍ tenía RLS habilitada desde la Sección 8
-- ("supp_logs: usuario gestiona los suyos", FOR ALL, auth.uid()=user_id)
-- — el mismo patrón legacy que medidas/ejercicio_logs/dietocalculo tenían
-- antes de la Sección 47, pero que se quedó sin endurecer en esa misma
-- pasada (no se detectó entonces porque, sin consumidor real, no había
-- ningún flujo que lo hiciera evidente). Sin nutriólogo visibility, sin
-- restricción de fecha, y cubriendo UPDATE/DELETE que ningún flujo real
-- necesita — exactamente el hueco que esta sección cierra ahora, con el
-- mismo patrón ya usado en la Sección 47. Sin consumidor real hasta
-- ahora: el checkbox de "tomado" en mobile-app era únicamente un
-- Set<string> en memoria de React (nutricion.tsx, SuplementacionTab), sin
-- persistencia.
drop policy if exists "supp_logs: usuario gestiona los suyos" on suplemento_logs;
alter table suplemento_logs enable row level security;

-- Mismo patrón multi-tenant que ejercicio_logs/medidas/nutricion_checks.
create policy "suplemento_logs_select" on suplemento_logs
for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from perfiles where id = suplemento_logs.user_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create policy "suplemento_logs_insert" on suplemento_logs
for insert to authenticated with check (
  auth.uid() = user_id
  or public.get_user_rol() = 'superadmin'
);

-- El checkbox ya era un toggle bidireccional en la UI existente (marcar y
-- desmarcar) — se preserva esa capacidad. Igual que nutricion_checks:
-- nunca permite reescribir un día pasado, solo el de hoy.
create policy "suplemento_logs_update" on suplemento_logs
for update to authenticated using (
  auth.uid() = user_id
  and fecha = (now() at time zone 'America/Mexico_City')::date
) with check (
  auth.uid() = user_id
  and fecha = (now() at time zone 'America/Mexico_City')::date
);

-- Sin DELETE — el toggle usa UPDATE de "tomado", no borra filas.

-- ============================================================
-- ROLLBACK Sección 71 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop policy if exists "suplemento_logs_select" on suplemento_logs;
-- drop policy if exists "suplemento_logs_insert" on suplemento_logs;
-- drop policy if exists "suplemento_logs_update" on suplemento_logs;
-- create policy "supp_logs: usuario gestiona los suyos"
--   on suplemento_logs for all using (auth.uid() = user_id);
-- ============================================================

-- ============================================================
-- 72. MIGRACIÓN — MyFitTrack Radar (R4B): perfiles.radar_started_at
-- ============================================================
-- Verificado contra el schema real (Sección 38) antes de asumir nada:
-- ninguna columna existente marca el momento de aprobación real — el
-- cambio de estatus a 'aprobado' es un UPDATE sin timestamp propio.
-- radar_started_at cierra ese hueco con la semántica mínima y objetiva
-- que SÍ se puede poblar con certeza: el momento en que la cuenta del
-- paciente fue aprobada. La segunda condición de la definición conceptual
-- ("al menos un dominio aplicable activo") NO se guarda aquí — instrumentar
-- triggers en rutinas y planes_nutricionales solo para sostener esta fecha
-- sería sobre-ingeniería; en vez de eso, calcular_radar_paciente (Sección
-- 74) evalúa esa condición en vivo cada vez que corre.
alter table perfiles add column if not exists radar_started_at timestamptz;

-- Backfill: los pacientes aprobados antes de que Radar existiera no tienen
-- forma de recuperar su fecha real de aprobación. Se usa created_at como
-- mejor aproximación disponible — limitación conocida y aceptada: para
-- estos pacientes históricos, R8 (paciente nuevo) podría subestimar su
-- antigüedad real en el programa si tardaron en ser aprobados tras
-- registrarse. Hacia adelante, todo paciente nuevo obtiene la fecha real
-- vía el trigger de abajo.
update perfiles
set radar_started_at = created_at
where estatus = 'aprobado' and radar_started_at is null;

-- Trigger dedicado y separado de proteger_columnas_sensibles_perfiles
-- (Sección 45/70): ese trigger es un GUARDIÁN de permisos (bloquea
-- escrituras no autorizadas); este es un AUTOCOMPLETADO de un valor
-- derivado (nunca bloquea nada, solo rellena una columna la primera vez
-- que aplica). Mezclarlos en una sola función confundiría dos
-- responsabilidades distintas.
create or replace function public.marcar_radar_started_at()
returns trigger
language plpgsql
as $$
begin
  if new.estatus = 'aprobado'
     and old.estatus is distinct from 'aprobado'
     and new.radar_started_at is null
  then
    new.radar_started_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marcar_radar_started_at on perfiles;
create trigger trg_marcar_radar_started_at
  before update on perfiles
  for each row
  execute function public.marcar_radar_started_at();

-- ============================================================
-- ROLLBACK Sección 72 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop trigger if exists trg_marcar_radar_started_at on perfiles;
-- drop function if exists public.marcar_radar_started_at();
-- alter table perfiles drop column if exists radar_started_at;
-- ============================================================

-- ============================================================
-- 73. MIGRACIÓN — MyFitTrack Radar (R4B): score_snapshots y radar_alertas
-- ============================================================
-- Ambas tablas son 100% derivadas/calculadas — nunca reciben INSERT/UPDATE
-- directo de un cliente (paciente, nutriólogo o superadmin). Solo las
-- escribe calcular_radar_paciente() (Sección 74), SECURITY DEFINER
-- propiedad de postgres, que como dueño de la tabla evade RLS igual que
-- registrar_actividad() evade la protección de perfiles (Sección 70). Por
-- eso solo existen políticas de SELECT — nunca INSERT/UPDATE/DELETE para
-- authenticated.
--
-- Visibilidad: nutriólogo dueño y superadmin únicamente. El propio
-- paciente NO ve estas tablas todavía — el Blueprint v1.1 (§ "paciente
-- visible vs. interno") reserva para él una vista simplificada y sin
-- terminología de riesgo, que se construye junto con el dashboard (fuera
-- de alcance de R4B). Exponer aquí "estado: rojo" o "riesgo_confirmado"
-- directo al paciente, antes de que exista esa capa de traducción,
-- generaría más daño que valor.

create table score_snapshots (
  id                       uuid        default uuid_generate_v4() primary key,
  paciente_id              uuid        references auth.users(id) on delete cascade not null,
  nutriologo_id            uuid        references auth.users(id) on delete set null,
  snapshot_date            date        not null,
  rules_version            text        not null,

  nutrition_adherence      numeric(5,2),
  nutrition_confidence     numeric(5,2) not null,
  training_adherence       numeric(5,2),
  training_confidence      numeric(5,2),
  adherence_global         numeric(5,2),
  adherence_global_calidad text        check (adherence_global_calidad in ('completo', 'parcial', 'incompleto')),
  data_confidence_global   numeric(5,2) not null,

  riesgo_confirmado_puntos int         not null default 0,
  senal_insuficiente       boolean     not null default false,
  estado                   text        not null check (estado in ('rojo', 'naranja', 'amarillo', 'verde', 'blanco')),

  reglas_disparadas        jsonb       not null default '[]'::jsonb,
  breakdown                jsonb       not null default '{}'::jsonb,
  explicaciones            jsonb       not null default '[]'::jsonb,
  accion_sugerida          text,

  created_at               timestamptz not null default now(),
  unique (paciente_id, snapshot_date)
);

create index on score_snapshots (paciente_id, snapshot_date desc);

alter table score_snapshots enable row level security;

create policy "score_snapshots_select" on score_snapshots
for select to authenticated using (
  exists (select 1 from perfiles where id = score_snapshots.paciente_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

create table radar_alertas (
  id                      uuid        default uuid_generate_v4() primary key,
  paciente_id             uuid        references auth.users(id) on delete cascade not null,
  nutriologo_id           uuid        references auth.users(id) on delete set null,
  regla_principal         text        not null,
  tier                    text        not null check (tier in ('alta', 'media', 'baja')),
  reglas_activas          jsonb       not null default '[]'::jsonb,
  estado_alerta           text        not null default 'abierta' check (estado_alerta in ('abierta', 'resuelta')),
  fecha_apertura          date        not null,
  fecha_resolucion        date,
  motivo_resolucion       text        check (motivo_resolucion in ('intervencion', 'auto_resuelta')),
  dias_condicion_ausente  int         not null default 0,
  ultima_fecha_evaluada   date        not null,
  cooldown_until          date,
  recurrence_of           uuid        references radar_alertas(id) on delete set null,
  rules_version           text        not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Como máximo una alerta ABIERTA por paciente+regla ("una sola alerta por
-- problema") — un índice único parcial lo hace imposible incluso si
-- calcular_radar_paciente tuviera un bug de concurrencia.
create unique index radar_alertas_una_abierta_por_regla
  on radar_alertas (paciente_id, regla_principal)
  where estado_alerta = 'abierta';

create index on radar_alertas (paciente_id, estado_alerta);

alter table radar_alertas enable row level security;

create policy "radar_alertas_select" on radar_alertas
for select to authenticated using (
  exists (select 1 from perfiles where id = radar_alertas.paciente_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

-- ============================================================
-- ROLLBACK Sección 73 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop table if exists radar_alertas;
-- drop table if exists score_snapshots;
-- ============================================================

-- ============================================================
-- 74. MIGRACIÓN — MyFitTrack Radar (R4B): motor de métricas y alertas
-- ============================================================
-- Implementa R4A (especificación aprobada) con 4 cierres de consistencia
-- decididos antes de esta implementación:
--
-- 1. Estado 🟡 ya no depende únicamente de que dispare la regla R7 (que
--    exige confianza <30% sostenida 7 días). Cualquier
--    data_confidence_global < 50% produce 🟡 por sí solo ("hoy sé poco"),
--    mientras que R7 sigue existiendo como regla de ALERTA persistente
--    únicamente para el caso sostenido ("llevas una semana desapareciendo
--    la señal") — son dos preguntas distintas y ahora nunca se contradicen.
--
-- 2. adherence_global se calcula ponderado por la confianza de cada
--    dominio (Σ adherencia×confianza / Σ confianza), nunca como promedio
--    simple — así un dominio casi sin datos no arrastra el global hacia
--    arriba o abajo como si fuera un valor confirmado. Además se guarda
--    adherence_global_calidad ('completo' si el dominio aplicable con
--    menor confianza ≥50%, 'parcial' si está entre 20-49%, 'incompleto'
--    si algún dominio aplicable tiene <20% de confianza) — el número crudo
--    se conserva siempre (reproducibilidad), pero la calidad le dice a
--    cualquier consumidor futuro si debe mostrarse con advertencia.
--
-- 3. R2 (cita sin confirmar) ya no produce 🔴 — produce un estado propio
--    🟠 "naranja" (acción pendiente, urgencia operativa) distinto de 🔴
--    (deterioro confirmado: R3/R4). Si ambos aplican simultáneamente, 🔴
--    gana (severidad clínica por encima de urgencia operativa), pero R2
--    se sigue registrando como alerta propia y aparece en la explicación.
--
-- 4. R8 (paciente nuevo) usa perfiles.radar_started_at (Sección 72) en vez
--    de created_at, más la verificación en vivo de que exista al menos un
--    dominio aplicable (rutina activa o plan nutricional activo) — un
--    paciente aprobado sin nada todavía asignado se queda en ⚪
--    indefinidamente, no solo durante 14 días.
--
-- Hallazgo de schema real que corrige al Blueprint v1.1 (documentado aquí
-- porque cambia la fórmula de "entrenamiento omitido"): rutina_dias.
-- numero_dia es solo un orden de despliegue (1..7), NO un día de la
-- semana fijo — verificado contra rutinas.tsx/rutinas.ts antes de asumirlo.
-- No existe el "día programado" puntual que el Blueprint v1.1 imaginaba
-- para el período de gracia. En su lugar, training_adherence usa la
-- semana calendario (lunes-domingo, America/Mexico_City — el mismo
-- criterio que ya usa la app móvil para resetear la lista semanal) como
-- ventana: sesiones_programadas = días no-descanso de la rutina activa
-- (la meta semanal), sesiones_completadas = días distintos marcados en
-- dias_completados dentro de esa semana. training_confidence deja de ser
-- "período de gracia vencido" y pasa a ser "fracción de la semana ya
-- transcurrida" (día 1 de 7 = 14% de confianza, domingo = 100%) — mismo
-- propósito (no juzgar con datos parciales), base real distinta.

create or replace function public._radar_gestionar_alerta(
  p_paciente_id       uuid,
  p_nutriologo_id     uuid,
  p_regla             text,
  p_tier              text,
  p_activo            boolean,
  p_requiere_2_dias   boolean,
  p_fecha             date,
  p_rules_version     text,
  p_detalle           jsonb
) returns boolean
language plpgsql
as $$
declare
  v_alerta            radar_alertas;
  v_en_cooldown       radar_alertas;
  v_recurrencia       radar_alertas;
begin
  select * into v_alerta from radar_alertas
    where paciente_id = p_paciente_id and regla_principal = p_regla and estado_alerta = 'abierta'
    limit 1;

  if v_alerta.id is not null then
    -- Idempotencia: si esta alerta ya fue evaluada hoy (una segunda
    -- corrida del mismo día), no reprocesar el contador de días ausentes.
    if v_alerta.ultima_fecha_evaluada = p_fecha then
      return true;
    end if;

    if p_activo then
      update radar_alertas
        set reglas_activas = p_detalle,
            dias_condicion_ausente = 0,
            ultima_fecha_evaluada = p_fecha,
            updated_at = now()
        where id = v_alerta.id;
      return true;
    else
      if p_requiere_2_dias and v_alerta.dias_condicion_ausente < 1 then
        -- Primer día sin la condición: no se resuelve todavía (evita
        -- parpadeo por un solo día bueno — Blueprint v1.1 y la prueba de
        -- sensibilidad de R4A).
        update radar_alertas
          set dias_condicion_ausente = v_alerta.dias_condicion_ausente + 1,
              ultima_fecha_evaluada = p_fecha,
              updated_at = now()
          where id = v_alerta.id;
        return true;
      else
        update radar_alertas
          set estado_alerta = 'resuelta',
              fecha_resolucion = p_fecha,
              motivo_resolucion = 'auto_resuelta',
              ultima_fecha_evaluada = p_fecha,
              updated_at = now()
          where id = v_alerta.id;
        return false;
      end if;
    end if;
  else
    if not p_activo then
      return false;
    end if;

    -- Cooldown: solo se activa tras una resolución por intervención
    -- (resolver_alerta_radar). Una resolución automática no protege
    -- ninguna medición, así que no genera cooldown.
    select * into v_en_cooldown from radar_alertas
      where paciente_id = p_paciente_id and regla_principal = p_regla
        and estado_alerta = 'resuelta' and cooldown_until is not null and cooldown_until >= p_fecha
      order by fecha_resolucion desc limit 1;

    if v_en_cooldown.id is not null then
      return false;
    end if;

    select * into v_recurrencia from radar_alertas
      where paciente_id = p_paciente_id and regla_principal = p_regla
        and estado_alerta = 'resuelta' and fecha_resolucion >= p_fecha - 30
      order by fecha_resolucion desc limit 1;

    insert into radar_alertas (
      paciente_id, nutriologo_id, regla_principal, tier, reglas_activas,
      fecha_apertura, ultima_fecha_evaluada, recurrence_of, rules_version
    ) values (
      p_paciente_id, p_nutriologo_id, p_regla, p_tier, p_detalle,
      p_fecha, p_fecha, v_recurrencia.id, p_rules_version
    );
    return true;
  end if;
end;
$$;

create or replace function public.calcular_radar_paciente(
  p_paciente_id uuid,
  p_fecha       date default (now() at time zone 'America/Mexico_City')::date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rules_version constant text := 'v1.0';
  v_perfil perfiles;

  -- Dominios aplicables
  v_tiene_rutina boolean;
  v_tiene_plan boolean;
  v_rutina_id uuid;

  -- Nutrición (ventana móvil de 7 días)
  v_nutri_dias_con_check int;
  v_nutrition_adherence numeric;
  v_nutrition_confidence numeric;

  -- Entrenamiento (semana calendario lunes-domingo)
  v_semana_inicio date;
  v_semana_fin date;
  v_dias_transcurridos_semana int;
  v_sesiones_programadas int;
  v_sesiones_completadas int;
  v_training_adherence numeric;
  v_training_confidence numeric;

  -- Adherence Global / Data Confidence Global
  v_peso_total numeric;
  v_suma numeric;
  v_adherence_global numeric;
  v_min_domain_confidence numeric;
  v_adherence_global_calidad text;
  v_conf_sum numeric;
  v_conf_count int;
  v_data_confidence_global numeric;

  -- R8
  v_dias_desde_radar_started int;
  v_r8_activo boolean;

  -- R1
  v_dias_desde_activo int;
  v_senales_historicas int;
  v_historial_regular boolean;
  v_r1_activo boolean;

  -- R2
  v_r2_activo boolean;
  v_cita_id uuid;
  v_cita_fecha date;

  -- R3 (baseline)
  v_baseline_candidatos numeric[];
  v_baseline_n int;
  v_baseline numeric;
  v_r3_activo boolean;

  -- R4
  v_r4_activo boolean;

  -- R5
  v_ultima_medida date;
  v_medidas_ultimos_90 int;
  v_habito_medidas_regular boolean;
  v_dias_desde_medida int;
  v_r5_activo boolean;

  -- R6
  v_r6_dia_patron int;
  v_r6_activo boolean;

  -- R7
  v_dias_confianza_baja_previos int;
  v_r7_activo boolean;

  -- R9
  v_r9_historicos numeric[];
  v_r9_n int;
  v_r9_stddev numeric;
  v_citas_confirmadas int;
  v_citas_totales int;
  v_citas_ok boolean;
  v_r9_activo boolean;

  -- Salida
  v_riesgo_confirmado_puntos int;
  v_senal_insuficiente boolean;
  v_estado text;
  v_reglas_disparadas jsonb;
  v_breakdown jsonb;
  v_explicaciones jsonb;
  v_accion_sugerida text;

  v_r1_abierta boolean;
  v_r2_abierta boolean;
  v_r3_abierta boolean;
  v_r4_abierta boolean;
  v_r7_abierta boolean;
begin
  select * into v_perfil from perfiles where id = p_paciente_id;
  if v_perfil.id is null or v_perfil.estatus <> 'aprobado' then
    return;
  end if;

  v_tiene_rutina := exists (select 1 from rutinas where user_id = p_paciente_id and activa);
  v_tiene_plan := exists (select 1 from planes_nutricionales where user_id = p_paciente_id and activo);

  -- ── R8: paciente nuevo / sin dominio aplicable aún ──────────────────
  v_dias_desde_radar_started := case when v_perfil.radar_started_at is null then null
    else p_fecha - (v_perfil.radar_started_at at time zone 'America/Mexico_City')::date end;
  v_r8_activo := (v_perfil.radar_started_at is null)
    or (v_dias_desde_radar_started < 14)
    or (not (v_tiene_rutina or v_tiene_plan));

  -- ── Nutrición ────────────────────────────────────────────────────────
  select count(*), avg(case estado when 'seguido' then 1.0 when 'parcial' then 0.5 else 0.0 end) * 100
    into v_nutri_dias_con_check, v_nutrition_adherence
    from nutricion_checks
    where user_id = p_paciente_id and fecha between p_fecha - 6 and p_fecha;
  if v_nutri_dias_con_check = 0 then
    v_nutrition_adherence := null;
  end if;
  v_nutrition_confidence := (v_nutri_dias_con_check / 7.0) * 100;

  -- ── Entrenamiento (semana calendario, no día programado fijo) ───────
  if v_tiene_rutina then
    select id into v_rutina_id from rutinas
      where user_id = p_paciente_id and activa order by created_at desc limit 1;
    select count(*) into v_sesiones_programadas
      from rutina_dias where rutina_id = v_rutina_id and es_descanso = false;

    v_semana_inicio := p_fecha - (extract(isodow from p_fecha)::int - 1);
    v_semana_fin := v_semana_inicio + 6;
    v_dias_transcurridos_semana := (least(p_fecha, v_semana_fin) - v_semana_inicio) + 1;

    select count(distinct dc.dia_id) into v_sesiones_completadas
      from dias_completados dc
      join rutina_dias rd on rd.id = dc.dia_id and rd.rutina_id = v_rutina_id
      where dc.user_id = p_paciente_id
        and dc.fecha between v_semana_inicio and least(v_semana_fin, p_fecha);

    if v_sesiones_programadas > 0 then
      v_training_adherence := least(100, (v_sesiones_completadas::numeric / v_sesiones_programadas) * 100);
    else
      v_training_adherence := null;
    end if;
    v_training_confidence := least(100, (v_dias_transcurridos_semana / 7.0) * 100);
  else
    v_training_adherence := null;
    v_training_confidence := null;
  end if;

  -- ── Adherence Global (ponderado por confianza de cada dominio) ──────
  v_peso_total := 0; v_suma := 0;
  if v_nutrition_adherence is not null then
    v_suma := v_suma + v_nutrition_adherence * v_nutrition_confidence;
    v_peso_total := v_peso_total + v_nutrition_confidence;
  end if;
  if v_training_adherence is not null then
    v_suma := v_suma + v_training_adherence * v_training_confidence;
    v_peso_total := v_peso_total + v_training_confidence;
  end if;
  if v_peso_total > 0 then
    v_adherence_global := v_suma / v_peso_total;
  else
    v_adherence_global := null;
  end if;

  -- ── Data Confidence Global (promedio simple de dominios aplicables) ─
  v_conf_sum := v_nutrition_confidence;
  v_conf_count := 1;
  if v_tiene_rutina then
    v_conf_sum := v_conf_sum + v_training_confidence;
    v_conf_count := v_conf_count + 1;
  end if;
  v_data_confidence_global := v_conf_sum / v_conf_count;

  -- ── Calidad de Adherence Global (cierre de consistencia #2) ─────────
  v_min_domain_confidence := v_nutrition_confidence;
  if v_tiene_rutina then
    v_min_domain_confidence := least(v_min_domain_confidence, v_training_confidence);
  end if;
  v_adherence_global_calidad := case
    when v_min_domain_confidence < 20 then 'incompleto'
    when v_min_domain_confidence < 50 then 'parcial'
    else 'completo'
  end;

  -- ── R9: estable (evaluado antes que R3/R4 porque los suprime) ───────
  -- Deliberadamente NO incluye el valor de HOY en la muestra: R9 mide
  -- estabilidad HISTÓRICA para poder suprimir una caída real del día
  -- actual con más evidencia acumulada (si hoy se incluyera, una caída
  -- real de hoy invalidaría por sí misma la "estabilidad" y R9 nunca
  -- podría suprimir nada — dejaría de tener el propósito anti-alarma-falsa
  -- para el que existe).
  select array_agg(adherence_global) into v_r9_historicos
    from score_snapshots
    where paciente_id = p_paciente_id
      and snapshot_date in (p_fecha - 7, p_fecha - 14, p_fecha - 21, p_fecha - 28,
                             p_fecha - 35, p_fecha - 42, p_fecha - 49)
      and adherence_global is not null;
  v_r9_n := coalesce(array_length(v_r9_historicos, 1), 0);
  if v_r9_n >= 4 then
    select stddev_pop(x) into v_r9_stddev from unnest(v_r9_historicos) x;
  else
    v_r9_stddev := null;
  end if;

  select count(*) filter (where estado = 'confirmada'), count(*) filter (where estado <> 'cancelada')
    into v_citas_confirmadas, v_citas_totales
    from citas where user_id = p_paciente_id and fecha between p_fecha - 90 and p_fecha;
  v_citas_ok := (v_citas_totales = 0) or (v_citas_confirmadas::numeric / v_citas_totales >= 0.80);

  v_r9_activo := (not v_r8_activo) and v_r9_stddev is not null and v_r9_stddev < 10 and v_citas_ok;

  -- ── R1: silencio tras historial de actividad regular ────────────────
  v_dias_desde_activo := case when v_perfil.last_active_at is null then null
    else p_fecha - (v_perfil.last_active_at at time zone 'America/Mexico_City')::date end;
  select count(*) into v_senales_historicas
    from (
      select fecha from nutricion_checks where user_id = p_paciente_id and fecha between p_fecha - 35 and p_fecha - 8
      union all
      select fecha from dias_completados where user_id = p_paciente_id and fecha between p_fecha - 35 and p_fecha - 8
    ) s;
  v_historial_regular := v_senales_historicas >= 16;
  v_r1_activo := (not v_r8_activo) and v_dias_desde_activo is not null
    and v_dias_desde_activo >= 5 and v_historial_regular;

  -- ── R2: cita sin confirmar dentro de 72h ────────────────────────────
  select id, fecha into v_cita_id, v_cita_fecha from citas
    where user_id = p_paciente_id and estado = 'pendiente' and fecha between p_fecha and p_fecha + 3
    order by fecha limit 1;
  v_r2_activo := (not v_r8_activo) and v_cita_id is not null;

  -- ── R3: caída de adherencia vs. baseline de 4 semanas ───────────────
  select array_agg(adherence_global) into v_baseline_candidatos
    from score_snapshots
    where paciente_id = p_paciente_id
      and snapshot_date in (p_fecha - 7, p_fecha - 14, p_fecha - 21, p_fecha - 28)
      and data_confidence_global >= 50
      and adherence_global is not null;
  v_baseline_n := coalesce(array_length(v_baseline_candidatos, 1), 0);
  if v_baseline_n >= 2 then
    select avg(x) into v_baseline from unnest(v_baseline_candidatos) x;
  else
    v_baseline := null;
  end if;

  v_r3_activo := (not v_r8_activo) and (not v_r9_activo)
    and v_baseline is not null and v_adherence_global is not null
    and v_data_confidence_global >= 50
    and v_adherence_global <= v_baseline - 20;

  -- ── R4: entrenamientos omitidos esta semana ─────────────────────────
  v_r4_activo := (not v_r8_activo) and (not v_r9_activo)
    and v_tiene_rutina and v_training_adherence is not null
    and v_training_adherence < 60 and v_training_confidence >= 60;

  -- ── R5: medidas desactualizadas (contexto, sin alerta propia) ───────
  select max(fecha) into v_ultima_medida from medidas where user_id = p_paciente_id;
  select count(*) into v_medidas_ultimos_90 from medidas where user_id = p_paciente_id and fecha >= p_fecha - 90;
  v_habito_medidas_regular := v_medidas_ultimos_90 >= 6;
  v_dias_desde_medida := case when v_ultima_medida is null then null else p_fecha - v_ultima_medida end;
  v_r5_activo := (not v_r8_activo) and v_dias_desde_medida is not null
    and v_dias_desde_medida >= 21 and v_habito_medidas_regular;

  -- ── R6: patrón de día de semana en nutrición, ≥3 semanas distintas ──
  select dow into v_r6_dia_patron
    from (
      select extract(dow from fecha)::int as dow, date_trunc('week', fecha) as semana
      from nutricion_checks
      where user_id = p_paciente_id and fecha between p_fecha - 27 and p_fecha
        and estado in ('parcial', 'no_seguido')
      group by dow, semana
    ) sub
    group by dow
    having count(*) >= 3
    order by count(*) desc
    limit 1;
  v_r6_activo := (not v_r8_activo) and v_r6_dia_patron is not null;

  -- ── R7: confianza global baja sostenida ≥7 días (incluyendo hoy) ────
  select count(*) into v_dias_confianza_baja_previos
    from score_snapshots
    where paciente_id = p_paciente_id
      and snapshot_date between p_fecha - 6 and p_fecha - 1
      and data_confidence_global < 30;
  v_r7_activo := (not v_r8_activo) and v_data_confidence_global < 30 and v_dias_confianza_baja_previos = 6;

  -- ── Puntos de riesgo confirmado (R3 + R4 + R6) ──────────────────────
  v_riesgo_confirmado_puntos := (case when v_r3_activo then 25 else 0 end)
    + (case when v_r4_activo then 15 else 0 end)
    + (case when v_r6_activo then 10 else 0 end);
  v_senal_insuficiente := v_r1_activo or v_r7_activo;

  -- ── Lifecycle de alertas (R1, R2, R3, R4, R7 — R5/R6 son contexto) ──
  v_r1_abierta := public._radar_gestionar_alerta(p_paciente_id, v_perfil.nutricionista_id,
    'RADAR_R1_SILENCIO_TRAS_HISTORIAL', 'media', v_r1_activo, false, p_fecha, v_rules_version,
    jsonb_build_object('dias_desde_activo', v_dias_desde_activo));

  v_r2_abierta := public._radar_gestionar_alerta(p_paciente_id, v_perfil.nutricionista_id,
    'RADAR_R2_CITA_SIN_CONFIRMAR', 'alta', v_r2_activo, false, p_fecha, v_rules_version,
    jsonb_build_object('cita_id', v_cita_id, 'cita_fecha', v_cita_fecha));

  v_r3_abierta := public._radar_gestionar_alerta(p_paciente_id, v_perfil.nutricionista_id,
    'RADAR_R3_CAIDA_ADHERENCIA', 'alta', v_r3_activo, true, p_fecha, v_rules_version,
    jsonb_build_object('baseline', v_baseline, 'actual', v_adherence_global));

  v_r4_abierta := public._radar_gestionar_alerta(p_paciente_id, v_perfil.nutricionista_id,
    'RADAR_R4_ENTRENAMIENTOS_OMITIDOS', 'media', v_r4_activo, true, p_fecha, v_rules_version,
    jsonb_build_object('sesiones_completadas', v_sesiones_completadas, 'sesiones_programadas', v_sesiones_programadas));

  v_r7_abierta := public._radar_gestionar_alerta(p_paciente_id, v_perfil.nutricionista_id,
    'RADAR_R7_CONFIANZA_GLOBAL_BAJA', 'media', v_r7_activo, false, p_fecha, v_rules_version,
    jsonb_build_object('data_confidence_global', v_data_confidence_global));

  -- ── Estado final (cierres de consistencia #1 y #3) ──────────────────
  -- El color se deriva de la EXISTENCIA de alerta abierta (no del booleano
  -- crudo del día), así la histéresis de R3/R4 (2 días de gracia dentro de
  -- _radar_gestionar_alerta) se hereda automáticamente por el estado sin
  -- necesitar una segunda banda de umbrales.
  v_estado := case
    when v_r8_activo then 'blanco'
    when v_r3_abierta or v_r4_abierta then 'rojo'
    when v_r2_abierta then 'naranja'
    when v_r1_abierta or v_r7_abierta or v_data_confidence_global < 50 then 'amarillo'
    else 'verde'
  end;

  v_reglas_disparadas := jsonb_build_array(
    jsonb_build_object('id', 'RADAR_R1_SILENCIO_TRAS_HISTORIAL', 'activa', v_r1_activo),
    jsonb_build_object('id', 'RADAR_R2_CITA_SIN_CONFIRMAR', 'activa', v_r2_activo),
    jsonb_build_object('id', 'RADAR_R3_CAIDA_ADHERENCIA', 'activa', v_r3_activo, 'puntos', case when v_r3_activo then 25 else 0 end),
    jsonb_build_object('id', 'RADAR_R4_ENTRENAMIENTOS_OMITIDOS', 'activa', v_r4_activo, 'puntos', case when v_r4_activo then 15 else 0 end),
    jsonb_build_object('id', 'RADAR_R5_MEDIDAS_DESACTUALIZADAS', 'activa', v_r5_activo),
    jsonb_build_object('id', 'RADAR_R6_PATRON_DIA_SEMANA', 'activa', v_r6_activo, 'dia', v_r6_dia_patron, 'puntos', case when v_r6_activo then 10 else 0 end),
    jsonb_build_object('id', 'RADAR_R7_CONFIANZA_GLOBAL_BAJA', 'activa', v_r7_activo),
    jsonb_build_object('id', 'RADAR_R8_PACIENTE_NUEVO', 'activa', v_r8_activo),
    jsonb_build_object('id', 'RADAR_R9_ESTABLE', 'activa', v_r9_activo)
  );

  v_breakdown := jsonb_build_object(
    'nutri_dias_con_check', v_nutri_dias_con_check,
    'tiene_rutina', v_tiene_rutina,
    'tiene_plan', v_tiene_plan,
    'sesiones_completadas', v_sesiones_completadas,
    'sesiones_programadas', v_sesiones_programadas,
    'dias_transcurridos_semana', v_dias_transcurridos_semana,
    'baseline_valor', v_baseline,
    'baseline_semanas_usadas', v_baseline_n,
    'dias_desde_activo', v_dias_desde_activo,
    'dias_desde_medida', v_dias_desde_medida,
    'r9_stddev', v_r9_stddev,
    'r9_muestras', v_r9_n
  );

  v_explicaciones := '[]'::jsonb;
  if v_r3_activo then
    v_explicaciones := v_explicaciones || jsonb_build_array(
      format('Tu adherencia bajó de %s%% a %s%% en las últimas semanas.', round(v_baseline), round(v_adherence_global)));
  end if;
  if v_r4_activo then
    v_explicaciones := v_explicaciones || jsonb_build_array(
      format('%s de %s entrenamientos programados no se han registrado esta semana.', v_sesiones_programadas - v_sesiones_completadas, v_sesiones_programadas));
  end if;
  if v_r2_activo then
    v_explicaciones := v_explicaciones || jsonb_build_array(
      format('Tiene una cita el %s sin confirmar.', v_cita_fecha));
  end if;
  if v_r1_activo then
    v_explicaciones := v_explicaciones || jsonb_build_array(
      format('No hemos tenido noticias en %s días, tras un patrón de actividad regular.', v_dias_desde_activo));
  end if;
  if v_r7_activo then
    v_explicaciones := v_explicaciones || jsonb_build_array('Muy poca información esta semana — no podemos evaluar bien cómo le está yendo.');
  end if;

  -- Regla principal = mayor puntaje entre las reglas confirmadas activas;
  -- si ninguna, R2; si ninguna, R1/R7. Define LA acción mostrada.
  v_accion_sugerida := case
    when v_r3_activo then 'Revisar qué dificultó seguir el plan esta semana.' || (case when v_r6_activo then ' El patrón se concentra los mismos días de la semana.' else '' end)
    when v_r4_activo then 'Preguntar si el horario o la rutina actual siguen siendo viables.'
    when v_r2_activo then 'Confirmar asistencia a la próxima consulta.'
    when v_r1_activo then 'Contactar para confirmar cómo va — no asumir incumplimiento.'
    when v_r7_activo then 'Contacto ligero para reactivar el registro.'
    else null
  end;

  insert into score_snapshots (
    paciente_id, nutriologo_id, snapshot_date, rules_version,
    nutrition_adherence, nutrition_confidence, training_adherence, training_confidence,
    adherence_global, adherence_global_calidad, data_confidence_global,
    riesgo_confirmado_puntos, senal_insuficiente, estado,
    reglas_disparadas, breakdown, explicaciones, accion_sugerida
  ) values (
    p_paciente_id, v_perfil.nutricionista_id, p_fecha, v_rules_version,
    v_nutrition_adherence, v_nutrition_confidence, v_training_adherence, v_training_confidence,
    v_adherence_global, v_adherence_global_calidad, v_data_confidence_global,
    v_riesgo_confirmado_puntos, v_senal_insuficiente, v_estado,
    v_reglas_disparadas, v_breakdown, v_explicaciones, v_accion_sugerida
  )
  on conflict (paciente_id, snapshot_date) do update set
    nutriologo_id = excluded.nutriologo_id,
    rules_version = excluded.rules_version,
    nutrition_adherence = excluded.nutrition_adherence,
    nutrition_confidence = excluded.nutrition_confidence,
    training_adherence = excluded.training_adherence,
    training_confidence = excluded.training_confidence,
    adherence_global = excluded.adherence_global,
    adherence_global_calidad = excluded.adherence_global_calidad,
    data_confidence_global = excluded.data_confidence_global,
    riesgo_confirmado_puntos = excluded.riesgo_confirmado_puntos,
    senal_insuficiente = excluded.senal_insuficiente,
    estado = excluded.estado,
    reglas_disparadas = excluded.reglas_disparadas,
    breakdown = excluded.breakdown,
    explicaciones = excluded.explicaciones,
    accion_sugerida = excluded.accion_sugerida;
end;
$$;

-- Resuelve una alerta manualmente (uso futuro: modal de intervención, aún
-- no implementado en R4B). Solo el nutriólogo dueño del paciente o
-- superadmin pueden resolver — verificado dentro de la función porque
-- radar_alertas no tiene policy de UPDATE (nadie puede tocarla vía RLS).
create or replace function public.resolver_alerta_radar(
  p_alerta_id uuid,
  p_motivo text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alerta radar_alertas;
  v_rol text;
begin
  if p_motivo not in ('intervencion', 'auto_resuelta') then
    raise exception 'motivo_resolucion inválido: %', p_motivo;
  end if;

  select * into v_alerta from radar_alertas where id = p_alerta_id and estado_alerta = 'abierta';
  if v_alerta.id is null then
    raise exception 'Alerta no encontrada o ya resuelta.';
  end if;

  v_rol := public.get_user_rol();
  if v_rol <> 'superadmin' and auth.uid() <> v_alerta.nutriologo_id then
    raise exception 'No tienes permiso para resolver esta alerta.';
  end if;

  update radar_alertas
    set estado_alerta = 'resuelta',
        fecha_resolucion = (now() at time zone 'America/Mexico_City')::date,
        motivo_resolucion = p_motivo,
        cooldown_until = case when p_motivo = 'intervencion'
          then (now() at time zone 'America/Mexico_City')::date + 14
          else null end,
        updated_at = now()
    where id = p_alerta_id;
end;
$$;

revoke execute on function public.resolver_alerta_radar(uuid, text) from public, anon;
grant execute on function public.resolver_alerta_radar(uuid, text) to authenticated;

-- Driver por lote — pensado para invocarse una vez al día (pg_cron o un
-- Edge Function programado; la conexión de esa programación queda fuera
-- de alcance de R4B, que solo entrega el "cerebro" calculable). Idempotente:
-- correrlo varias veces el mismo día para el mismo paciente hace upsert
-- sobre la misma fila de score_snapshots, nunca duplica.
create or replace function public.ejecutar_radar_diario(
  p_fecha date default (now() at time zone 'America/Mexico_City')::date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente_id uuid;
begin
  for v_paciente_id in select id from perfiles where estatus = 'aprobado' and rol = 'usuario' loop
    perform public.calcular_radar_paciente(v_paciente_id, p_fecha);
  end loop;
end;
$$;

revoke execute on function public.calcular_radar_paciente(uuid, date) from public, anon, authenticated;
revoke execute on function public.ejecutar_radar_diario(date) from public, anon, authenticated;
grant execute on function public.calcular_radar_paciente(uuid, date) to service_role;
grant execute on function public.ejecutar_radar_diario(date) to service_role;

-- ============================================================
-- ROLLBACK Sección 74 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop function if exists public.ejecutar_radar_diario(date);
-- drop function if exists public.resolver_alerta_radar(uuid, text);
-- drop function if exists public.calcular_radar_paciente(uuid, date);
-- drop function if exists public._radar_gestionar_alerta(uuid, uuid, text, text, boolean, boolean, date, text, jsonb);
-- ============================================================

-- ============================================================
-- 75. MIGRACIÓN — MyFitTrack Radar (R4B): correcciones de auditoría de
-- seguridad y robustez sobre las Secciones 72-74
-- ============================================================
-- Hallazgos cerrados aquí (auditoría previa a R5, código real de 72-74):
--
-- CRÍTICO — bypass de autorización en resolver_alerta_radar: cuando
-- radar_alertas.nutriologo_id es NULL (perfiles.nutricionista_id se pone
-- en NULL si esa cuenta se elimina, Sección 27), la comparación original
-- "auth.uid() <> v_alerta.nutriologo_id" evaluaba a NULL (lógica de 3
-- valores de SQL), y un IF con condición NULL en PL/pgSQL se trata como
-- falso — la excepción nunca se lanzaba. Cualquier usuario autenticado
-- podía resolver la alerta de un paciente sin nutriólogo asignado. Fix:
-- "is distinct from" (NULL-safe) + nutriologo_id NULL exige superadmin.
--
-- ALTO — condición de carrera en resolver_alerta_radar: el UPDATE original
-- solo filtraba por id, no por estado_alerta = 'abierta', y no verificaba
-- FOUND — dos resoluciones concurrentes de la misma alerta ambas
-- "tenían éxito", la segunda pisando en silencio fecha_resolucion /
-- motivo_resolucion / cooldown_until de la primera. Fix: el UPDATE exige
-- estado_alerta = 'abierta' y se verifica FOUND.
--
-- MEDIO — resolver_alerta_radar aceptaba motivo = 'auto_resuelta' de un
-- caller humano, dejando resolver una alerta sin cooldown y sin
-- distinguirse de una resolución automática real (contamina la futura
-- medición de resultado de intervención, R4A). Fix: un caller humano solo
-- puede pasar 'intervencion' — 'auto_resuelta' queda reservado al motor
-- (_radar_gestionar_alerta).
--
-- ALTO — carrera de inserción no capturada en _radar_gestionar_alerta: dos
-- ejecuciones solapadas de calcular_radar_paciente para el mismo
-- paciente+fecha (dos crons superpuestos, o dos llamadas manuales) podían
-- ver ambas "sin alerta abierta" antes de que ninguna hiciera commit;
-- la segunda INSERT chocaba contra el índice único parcial y lanzaba
-- unique_violation sin capturar. Fix: ON CONFLICT ... DO NOTHING contra
-- ese mismo índice — la ejecución que pierde la carrera simplemente no
-- inserta (la otra ya abrió la alerta real).
--
-- ALTO — ejecutar_radar_diario sin aislamiento de errores por paciente:
-- una sola falla (incluida la carrera de arriba, antes del fix) abortaba
-- la transacción completa, revirtiendo el trabajo de TODOS los pacientes
-- ya procesados en esa corrida. Fix: cada iteración corre dentro de su
-- propio BEGIN/EXCEPTION (subtransacción vía savepoint implícito de
-- PL/pgSQL) — una falla aislada solo pierde ese paciente, no el lote.
--
-- MEDIO — ni calcular_radar_paciente ni ejecutar_radar_diario excluían a
-- pacientes con is_active = false (estatus podía seguir siendo
-- 'aprobado' tras una desactivación) — un paciente desactivado seguía
-- acumulando snapshots y alertas. Fix: se exige coalesce(is_active, true)
-- en ambos, igual que ya hace get_current_user_is_active() para el mismo
-- default seguro cuando la columna es NULL.
--
-- MEDIO — _radar_gestionar_alerta (prefijo "_" = privada por convención)
-- no tenía EXECUTE revocado de public. Hoy no era explotable (radar_alertas
-- no tiene policy de INSERT/UPDATE para authenticated, así que una llamada
-- directa fallaba con 42501), pero un futuro cambio de RLS la volvería
-- explotable sin que nadie lo notara. Fix: revoke explícito — no necesita
-- grant de reemplazo porque solo se invoca desde funciones SECURITY
-- DEFINER propiedad de postgres, que como superusuario nunca requiere uno.
--
-- MEDIO — v_tiene_plan (planes_nutricionales) no tenía índice de apoyo,
-- a diferencia de rutinas(user_id) y medidas(user_id, fecha desc) que sí
-- lo tienen — full scan por paciente evaluado. Fix: mismo patrón de índice.

create or replace function public._radar_gestionar_alerta(
  p_paciente_id       uuid,
  p_nutriologo_id     uuid,
  p_regla             text,
  p_tier              text,
  p_activo            boolean,
  p_requiere_2_dias   boolean,
  p_fecha             date,
  p_rules_version     text,
  p_detalle           jsonb
) returns boolean
language plpgsql
as $$
declare
  v_alerta            radar_alertas;
  v_en_cooldown       radar_alertas;
  v_recurrencia       radar_alertas;
begin
  select * into v_alerta from radar_alertas
    where paciente_id = p_paciente_id and regla_principal = p_regla and estado_alerta = 'abierta'
    limit 1;

  if v_alerta.id is not null then
    -- Idempotencia: si esta alerta ya fue evaluada hoy (una segunda
    -- corrida del mismo día), no reprocesar el contador de días ausentes.
    if v_alerta.ultima_fecha_evaluada = p_fecha then
      return true;
    end if;

    if p_activo then
      update radar_alertas
        set reglas_activas = p_detalle,
            dias_condicion_ausente = 0,
            ultima_fecha_evaluada = p_fecha,
            updated_at = now()
        where id = v_alerta.id;
      return true;
    else
      if p_requiere_2_dias and v_alerta.dias_condicion_ausente < 1 then
        -- Primer día sin la condición: no se resuelve todavía (evita
        -- parpadeo por un solo día bueno — Blueprint v1.1 y la prueba de
        -- sensibilidad de R4A).
        update radar_alertas
          set dias_condicion_ausente = v_alerta.dias_condicion_ausente + 1,
              ultima_fecha_evaluada = p_fecha,
              updated_at = now()
          where id = v_alerta.id;
        return true;
      else
        update radar_alertas
          set estado_alerta = 'resuelta',
              fecha_resolucion = p_fecha,
              motivo_resolucion = 'auto_resuelta',
              ultima_fecha_evaluada = p_fecha,
              updated_at = now()
          where id = v_alerta.id;
        return false;
      end if;
    end if;
  else
    if not p_activo then
      return false;
    end if;

    -- Cooldown: solo se activa tras una resolución por intervención
    -- (resolver_alerta_radar). Una resolución automática no protege
    -- ninguna medición, así que no genera cooldown.
    select * into v_en_cooldown from radar_alertas
      where paciente_id = p_paciente_id and regla_principal = p_regla
        and estado_alerta = 'resuelta' and cooldown_until is not null and cooldown_until >= p_fecha
      order by fecha_resolucion desc limit 1;

    if v_en_cooldown.id is not null then
      return false;
    end if;

    select * into v_recurrencia from radar_alertas
      where paciente_id = p_paciente_id and regla_principal = p_regla
        and estado_alerta = 'resuelta' and fecha_resolucion >= p_fecha - 30
      order by fecha_resolucion desc limit 1;

    -- Auditoría (Sección 75): ON CONFLICT contra el índice único parcial
    -- en vez de dejar que un INSERT concurrente lance unique_violation sin
    -- capturar (ver nota de la Sección 75 arriba). La ejecución que pierde
    -- la carrera simplemente no inserta su fila — la otra ya abrió la
    -- alerta real, así que el resultado observable (existe una alerta
    -- abierta) es idéntico para ambas.
    insert into radar_alertas (
      paciente_id, nutriologo_id, regla_principal, tier, reglas_activas,
      fecha_apertura, ultima_fecha_evaluada, recurrence_of, rules_version
    ) values (
      p_paciente_id, p_nutriologo_id, p_regla, p_tier, p_detalle,
      p_fecha, p_fecha, v_recurrencia.id, p_rules_version
    )
    on conflict (paciente_id, regla_principal) where estado_alerta = 'abierta' do nothing;
    return true;
  end if;
end;
$$;

revoke execute on function public._radar_gestionar_alerta(uuid, uuid, text, text, boolean, boolean, date, text, jsonb) from public;

-- Re-declaración completa de calcular_radar_paciente: único cambio real es
-- la línea del guard inicial, que ahora también exige is_active — el resto
-- queda carácter por carácter idéntico a la Sección 74.
create or replace function public.calcular_radar_paciente(
  p_paciente_id uuid,
  p_fecha       date default (now() at time zone 'America/Mexico_City')::date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rules_version constant text := 'v1.0';
  v_perfil perfiles;

  -- Dominios aplicables
  v_tiene_rutina boolean;
  v_tiene_plan boolean;
  v_rutina_id uuid;

  -- Nutrición (ventana móvil de 7 días)
  v_nutri_dias_con_check int;
  v_nutrition_adherence numeric;
  v_nutrition_confidence numeric;

  -- Entrenamiento (semana calendario lunes-domingo)
  v_semana_inicio date;
  v_semana_fin date;
  v_dias_transcurridos_semana int;
  v_sesiones_programadas int;
  v_sesiones_completadas int;
  v_training_adherence numeric;
  v_training_confidence numeric;

  -- Adherence Global / Data Confidence Global
  v_peso_total numeric;
  v_suma numeric;
  v_adherence_global numeric;
  v_min_domain_confidence numeric;
  v_adherence_global_calidad text;
  v_conf_sum numeric;
  v_conf_count int;
  v_data_confidence_global numeric;

  -- R8
  v_dias_desde_radar_started int;
  v_r8_activo boolean;

  -- R1
  v_dias_desde_activo int;
  v_senales_historicas int;
  v_historial_regular boolean;
  v_r1_activo boolean;

  -- R2
  v_r2_activo boolean;
  v_cita_id uuid;
  v_cita_fecha date;

  -- R3 (baseline)
  v_baseline_candidatos numeric[];
  v_baseline_n int;
  v_baseline numeric;
  v_r3_activo boolean;

  -- R4
  v_r4_activo boolean;

  -- R5
  v_ultima_medida date;
  v_medidas_ultimos_90 int;
  v_habito_medidas_regular boolean;
  v_dias_desde_medida int;
  v_r5_activo boolean;

  -- R6
  v_r6_dia_patron int;
  v_r6_activo boolean;

  -- R7
  v_dias_confianza_baja_previos int;
  v_r7_activo boolean;

  -- R9
  v_r9_historicos numeric[];
  v_r9_n int;
  v_r9_stddev numeric;
  v_citas_confirmadas int;
  v_citas_totales int;
  v_citas_ok boolean;
  v_r9_activo boolean;

  -- Salida
  v_riesgo_confirmado_puntos int;
  v_senal_insuficiente boolean;
  v_estado text;
  v_reglas_disparadas jsonb;
  v_breakdown jsonb;
  v_explicaciones jsonb;
  v_accion_sugerida text;

  v_r1_abierta boolean;
  v_r2_abierta boolean;
  v_r3_abierta boolean;
  v_r4_abierta boolean;
  v_r7_abierta boolean;
begin
  select * into v_perfil from perfiles where id = p_paciente_id;
  -- Auditoría (Sección 75): se agrega "not coalesce(v_perfil.is_active, true)"
  -- — un paciente aprobado pero desactivado ya no acumula snapshots/alertas.
  if v_perfil.id is null or v_perfil.estatus <> 'aprobado' or not coalesce(v_perfil.is_active, true) then
    return;
  end if;

  v_tiene_rutina := exists (select 1 from rutinas where user_id = p_paciente_id and activa);
  v_tiene_plan := exists (select 1 from planes_nutricionales where user_id = p_paciente_id and activo);

  -- ── R8: paciente nuevo / sin dominio aplicable aún ──────────────────
  v_dias_desde_radar_started := case when v_perfil.radar_started_at is null then null
    else p_fecha - (v_perfil.radar_started_at at time zone 'America/Mexico_City')::date end;
  v_r8_activo := (v_perfil.radar_started_at is null)
    or (v_dias_desde_radar_started < 14)
    or (not (v_tiene_rutina or v_tiene_plan));

  -- ── Nutrición ────────────────────────────────────────────────────────
  select count(*), avg(case estado when 'seguido' then 1.0 when 'parcial' then 0.5 else 0.0 end) * 100
    into v_nutri_dias_con_check, v_nutrition_adherence
    from nutricion_checks
    where user_id = p_paciente_id and fecha between p_fecha - 6 and p_fecha;
  if v_nutri_dias_con_check = 0 then
    v_nutrition_adherence := null;
  end if;
  v_nutrition_confidence := (v_nutri_dias_con_check / 7.0) * 100;

  -- ── Entrenamiento (semana calendario, no día programado fijo) ───────
  if v_tiene_rutina then
    select id into v_rutina_id from rutinas
      where user_id = p_paciente_id and activa order by created_at desc limit 1;
    select count(*) into v_sesiones_programadas
      from rutina_dias where rutina_id = v_rutina_id and es_descanso = false;

    v_semana_inicio := p_fecha - (extract(isodow from p_fecha)::int - 1);
    v_semana_fin := v_semana_inicio + 6;
    v_dias_transcurridos_semana := (least(p_fecha, v_semana_fin) - v_semana_inicio) + 1;

    select count(distinct dc.dia_id) into v_sesiones_completadas
      from dias_completados dc
      join rutina_dias rd on rd.id = dc.dia_id and rd.rutina_id = v_rutina_id
      where dc.user_id = p_paciente_id
        and dc.fecha between v_semana_inicio and least(v_semana_fin, p_fecha);

    if v_sesiones_programadas > 0 then
      v_training_adherence := least(100, (v_sesiones_completadas::numeric / v_sesiones_programadas) * 100);
    else
      v_training_adherence := null;
    end if;
    v_training_confidence := least(100, (v_dias_transcurridos_semana / 7.0) * 100);
  else
    v_training_adherence := null;
    v_training_confidence := null;
  end if;

  -- ── Adherence Global (ponderado por confianza de cada dominio) ──────
  v_peso_total := 0; v_suma := 0;
  if v_nutrition_adherence is not null then
    v_suma := v_suma + v_nutrition_adherence * v_nutrition_confidence;
    v_peso_total := v_peso_total + v_nutrition_confidence;
  end if;
  if v_training_adherence is not null then
    v_suma := v_suma + v_training_adherence * v_training_confidence;
    v_peso_total := v_peso_total + v_training_confidence;
  end if;
  if v_peso_total > 0 then
    v_adherence_global := v_suma / v_peso_total;
  else
    v_adherence_global := null;
  end if;

  -- ── Data Confidence Global (promedio simple de dominios aplicables) ─
  v_conf_sum := v_nutrition_confidence;
  v_conf_count := 1;
  if v_tiene_rutina then
    v_conf_sum := v_conf_sum + v_training_confidence;
    v_conf_count := v_conf_count + 1;
  end if;
  v_data_confidence_global := v_conf_sum / v_conf_count;

  -- ── Calidad de Adherence Global (cierre de consistencia #2) ─────────
  v_min_domain_confidence := v_nutrition_confidence;
  if v_tiene_rutina then
    v_min_domain_confidence := least(v_min_domain_confidence, v_training_confidence);
  end if;
  v_adherence_global_calidad := case
    when v_min_domain_confidence < 20 then 'incompleto'
    when v_min_domain_confidence < 50 then 'parcial'
    else 'completo'
  end;

  -- ── R9: estable (evaluado antes que R3/R4 porque los suprime) ───────
  -- Deliberadamente NO incluye el valor de HOY en la muestra: R9 mide
  -- estabilidad HISTÓRICA para poder suprimir una caída real del día
  -- actual con más evidencia acumulada (si hoy se incluyera, una caída
  -- real de hoy invalidaría por sí misma la "estabilidad" y R9 nunca
  -- podría suprimir nada — dejaría de tener el propósito anti-alarma-falsa
  -- para el que existe).
  select array_agg(adherence_global) into v_r9_historicos
    from score_snapshots
    where paciente_id = p_paciente_id
      and snapshot_date in (p_fecha - 7, p_fecha - 14, p_fecha - 21, p_fecha - 28,
                             p_fecha - 35, p_fecha - 42, p_fecha - 49)
      and adherence_global is not null;
  v_r9_n := coalesce(array_length(v_r9_historicos, 1), 0);
  if v_r9_n >= 4 then
    select stddev_pop(x) into v_r9_stddev from unnest(v_r9_historicos) x;
  else
    v_r9_stddev := null;
  end if;

  select count(*) filter (where estado = 'confirmada'), count(*) filter (where estado <> 'cancelada')
    into v_citas_confirmadas, v_citas_totales
    from citas where user_id = p_paciente_id and fecha between p_fecha - 90 and p_fecha;
  v_citas_ok := (v_citas_totales = 0) or (v_citas_confirmadas::numeric / v_citas_totales >= 0.80);

  v_r9_activo := (not v_r8_activo) and v_r9_stddev is not null and v_r9_stddev < 10 and v_citas_ok;

  -- ── R1: silencio tras historial de actividad regular ────────────────
  v_dias_desde_activo := case when v_perfil.last_active_at is null then null
    else p_fecha - (v_perfil.last_active_at at time zone 'America/Mexico_City')::date end;
  select count(*) into v_senales_historicas
    from (
      select fecha from nutricion_checks where user_id = p_paciente_id and fecha between p_fecha - 35 and p_fecha - 8
      union all
      select fecha from dias_completados where user_id = p_paciente_id and fecha between p_fecha - 35 and p_fecha - 8
    ) s;
  v_historial_regular := v_senales_historicas >= 16;
  v_r1_activo := (not v_r8_activo) and v_dias_desde_activo is not null
    and v_dias_desde_activo >= 5 and v_historial_regular;

  -- ── R2: cita sin confirmar dentro de 72h ────────────────────────────
  select id, fecha into v_cita_id, v_cita_fecha from citas
    where user_id = p_paciente_id and estado = 'pendiente' and fecha between p_fecha and p_fecha + 3
    order by fecha limit 1;
  v_r2_activo := (not v_r8_activo) and v_cita_id is not null;

  -- ── R3: caída de adherencia vs. baseline de 4 semanas ───────────────
  select array_agg(adherence_global) into v_baseline_candidatos
    from score_snapshots
    where paciente_id = p_paciente_id
      and snapshot_date in (p_fecha - 7, p_fecha - 14, p_fecha - 21, p_fecha - 28)
      and data_confidence_global >= 50
      and adherence_global is not null;
  v_baseline_n := coalesce(array_length(v_baseline_candidatos, 1), 0);
  if v_baseline_n >= 2 then
    select avg(x) into v_baseline from unnest(v_baseline_candidatos) x;
  else
    v_baseline := null;
  end if;

  v_r3_activo := (not v_r8_activo) and (not v_r9_activo)
    and v_baseline is not null and v_adherence_global is not null
    and v_data_confidence_global >= 50
    and v_adherence_global <= v_baseline - 20;

  -- ── R4: entrenamientos omitidos esta semana ─────────────────────────
  v_r4_activo := (not v_r8_activo) and (not v_r9_activo)
    and v_tiene_rutina and v_training_adherence is not null
    and v_training_adherence < 60 and v_training_confidence >= 60;

  -- ── R5: medidas desactualizadas (contexto, sin alerta propia) ───────
  select max(fecha) into v_ultima_medida from medidas where user_id = p_paciente_id;
  select count(*) into v_medidas_ultimos_90 from medidas where user_id = p_paciente_id and fecha >= p_fecha - 90;
  v_habito_medidas_regular := v_medidas_ultimos_90 >= 6;
  v_dias_desde_medida := case when v_ultima_medida is null then null else p_fecha - v_ultima_medida end;
  v_r5_activo := (not v_r8_activo) and v_dias_desde_medida is not null
    and v_dias_desde_medida >= 21 and v_habito_medidas_regular;

  -- ── R6: patrón de día de semana en nutrición, ≥3 semanas distintas ──
  select dow into v_r6_dia_patron
    from (
      select extract(dow from fecha)::int as dow, date_trunc('week', fecha) as semana
      from nutricion_checks
      where user_id = p_paciente_id and fecha between p_fecha - 27 and p_fecha
        and estado in ('parcial', 'no_seguido')
      group by dow, semana
    ) sub
    group by dow
    having count(*) >= 3
    order by count(*) desc
    limit 1;
  v_r6_activo := (not v_r8_activo) and v_r6_dia_patron is not null;

  -- ── R7: confianza global baja sostenida ≥7 días (incluyendo hoy) ────
  select count(*) into v_dias_confianza_baja_previos
    from score_snapshots
    where paciente_id = p_paciente_id
      and snapshot_date between p_fecha - 6 and p_fecha - 1
      and data_confidence_global < 30;
  v_r7_activo := (not v_r8_activo) and v_data_confidence_global < 30 and v_dias_confianza_baja_previos = 6;

  -- ── Puntos de riesgo confirmado (R3 + R4 + R6) ──────────────────────
  v_riesgo_confirmado_puntos := (case when v_r3_activo then 25 else 0 end)
    + (case when v_r4_activo then 15 else 0 end)
    + (case when v_r6_activo then 10 else 0 end);
  v_senal_insuficiente := v_r1_activo or v_r7_activo;

  -- ── Lifecycle de alertas (R1, R2, R3, R4, R7 — R5/R6 son contexto) ──
  v_r1_abierta := public._radar_gestionar_alerta(p_paciente_id, v_perfil.nutricionista_id,
    'RADAR_R1_SILENCIO_TRAS_HISTORIAL', 'media', v_r1_activo, false, p_fecha, v_rules_version,
    jsonb_build_object('dias_desde_activo', v_dias_desde_activo));

  v_r2_abierta := public._radar_gestionar_alerta(p_paciente_id, v_perfil.nutricionista_id,
    'RADAR_R2_CITA_SIN_CONFIRMAR', 'alta', v_r2_activo, false, p_fecha, v_rules_version,
    jsonb_build_object('cita_id', v_cita_id, 'cita_fecha', v_cita_fecha));

  v_r3_abierta := public._radar_gestionar_alerta(p_paciente_id, v_perfil.nutricionista_id,
    'RADAR_R3_CAIDA_ADHERENCIA', 'alta', v_r3_activo, true, p_fecha, v_rules_version,
    jsonb_build_object('baseline', v_baseline, 'actual', v_adherence_global));

  v_r4_abierta := public._radar_gestionar_alerta(p_paciente_id, v_perfil.nutricionista_id,
    'RADAR_R4_ENTRENAMIENTOS_OMITIDOS', 'media', v_r4_activo, true, p_fecha, v_rules_version,
    jsonb_build_object('sesiones_completadas', v_sesiones_completadas, 'sesiones_programadas', v_sesiones_programadas));

  v_r7_abierta := public._radar_gestionar_alerta(p_paciente_id, v_perfil.nutricionista_id,
    'RADAR_R7_CONFIANZA_GLOBAL_BAJA', 'media', v_r7_activo, false, p_fecha, v_rules_version,
    jsonb_build_object('data_confidence_global', v_data_confidence_global));

  -- ── Estado final (cierres de consistencia #1 y #3) ──────────────────
  -- El color se deriva de la EXISTENCIA de alerta abierta (no del booleano
  -- crudo del día), así la histéresis de R3/R4 (2 días de gracia dentro de
  -- _radar_gestionar_alerta) se hereda automáticamente por el estado sin
  -- necesitar una segunda banda de umbrales.
  v_estado := case
    when v_r8_activo then 'blanco'
    when v_r3_abierta or v_r4_abierta then 'rojo'
    when v_r2_abierta then 'naranja'
    when v_r1_abierta or v_r7_abierta or v_data_confidence_global < 50 then 'amarillo'
    else 'verde'
  end;

  v_reglas_disparadas := jsonb_build_array(
    jsonb_build_object('id', 'RADAR_R1_SILENCIO_TRAS_HISTORIAL', 'activa', v_r1_activo),
    jsonb_build_object('id', 'RADAR_R2_CITA_SIN_CONFIRMAR', 'activa', v_r2_activo),
    jsonb_build_object('id', 'RADAR_R3_CAIDA_ADHERENCIA', 'activa', v_r3_activo, 'puntos', case when v_r3_activo then 25 else 0 end),
    jsonb_build_object('id', 'RADAR_R4_ENTRENAMIENTOS_OMITIDOS', 'activa', v_r4_activo, 'puntos', case when v_r4_activo then 15 else 0 end),
    jsonb_build_object('id', 'RADAR_R5_MEDIDAS_DESACTUALIZADAS', 'activa', v_r5_activo),
    jsonb_build_object('id', 'RADAR_R6_PATRON_DIA_SEMANA', 'activa', v_r6_activo, 'dia', v_r6_dia_patron, 'puntos', case when v_r6_activo then 10 else 0 end),
    jsonb_build_object('id', 'RADAR_R7_CONFIANZA_GLOBAL_BAJA', 'activa', v_r7_activo),
    jsonb_build_object('id', 'RADAR_R8_PACIENTE_NUEVO', 'activa', v_r8_activo),
    jsonb_build_object('id', 'RADAR_R9_ESTABLE', 'activa', v_r9_activo)
  );

  v_breakdown := jsonb_build_object(
    'nutri_dias_con_check', v_nutri_dias_con_check,
    'tiene_rutina', v_tiene_rutina,
    'tiene_plan', v_tiene_plan,
    'sesiones_completadas', v_sesiones_completadas,
    'sesiones_programadas', v_sesiones_programadas,
    'dias_transcurridos_semana', v_dias_transcurridos_semana,
    'baseline_valor', v_baseline,
    'baseline_semanas_usadas', v_baseline_n,
    'dias_desde_activo', v_dias_desde_activo,
    'dias_desde_medida', v_dias_desde_medida,
    'r9_stddev', v_r9_stddev,
    'r9_muestras', v_r9_n
  );

  v_explicaciones := '[]'::jsonb;
  if v_r3_activo then
    v_explicaciones := v_explicaciones || jsonb_build_array(
      format('Tu adherencia bajó de %s%% a %s%% en las últimas semanas.', round(v_baseline), round(v_adherence_global)));
  end if;
  if v_r4_activo then
    v_explicaciones := v_explicaciones || jsonb_build_array(
      format('%s de %s entrenamientos programados no se han registrado esta semana.', v_sesiones_programadas - v_sesiones_completadas, v_sesiones_programadas));
  end if;
  if v_r2_activo then
    v_explicaciones := v_explicaciones || jsonb_build_array(
      format('Tiene una cita el %s sin confirmar.', v_cita_fecha));
  end if;
  if v_r1_activo then
    v_explicaciones := v_explicaciones || jsonb_build_array(
      format('No hemos tenido noticias en %s días, tras un patrón de actividad regular.', v_dias_desde_activo));
  end if;
  if v_r7_activo then
    v_explicaciones := v_explicaciones || jsonb_build_array('Muy poca información esta semana — no podemos evaluar bien cómo le está yendo.');
  end if;

  -- Regla principal = mayor puntaje entre las reglas confirmadas activas;
  -- si ninguna, R2; si ninguna, R1/R7. Define LA acción mostrada.
  v_accion_sugerida := case
    when v_r3_activo then 'Revisar qué dificultó seguir el plan esta semana.' || (case when v_r6_activo then ' El patrón se concentra los mismos días de la semana.' else '' end)
    when v_r4_activo then 'Preguntar si el horario o la rutina actual siguen siendo viables.'
    when v_r2_activo then 'Confirmar asistencia a la próxima consulta.'
    when v_r1_activo then 'Contactar para confirmar cómo va — no asumir incumplimiento.'
    when v_r7_activo then 'Contacto ligero para reactivar el registro.'
    else null
  end;

  insert into score_snapshots (
    paciente_id, nutriologo_id, snapshot_date, rules_version,
    nutrition_adherence, nutrition_confidence, training_adherence, training_confidence,
    adherence_global, adherence_global_calidad, data_confidence_global,
    riesgo_confirmado_puntos, senal_insuficiente, estado,
    reglas_disparadas, breakdown, explicaciones, accion_sugerida
  ) values (
    p_paciente_id, v_perfil.nutricionista_id, p_fecha, v_rules_version,
    v_nutrition_adherence, v_nutrition_confidence, v_training_adherence, v_training_confidence,
    v_adherence_global, v_adherence_global_calidad, v_data_confidence_global,
    v_riesgo_confirmado_puntos, v_senal_insuficiente, v_estado,
    v_reglas_disparadas, v_breakdown, v_explicaciones, v_accion_sugerida
  )
  on conflict (paciente_id, snapshot_date) do update set
    nutriologo_id = excluded.nutriologo_id,
    rules_version = excluded.rules_version,
    nutrition_adherence = excluded.nutrition_adherence,
    nutrition_confidence = excluded.nutrition_confidence,
    training_adherence = excluded.training_adherence,
    training_confidence = excluded.training_confidence,
    adherence_global = excluded.adherence_global,
    adherence_global_calidad = excluded.adherence_global_calidad,
    data_confidence_global = excluded.data_confidence_global,
    riesgo_confirmado_puntos = excluded.riesgo_confirmado_puntos,
    senal_insuficiente = excluded.senal_insuficiente,
    estado = excluded.estado,
    reglas_disparadas = excluded.reglas_disparadas,
    breakdown = excluded.breakdown,
    explicaciones = excluded.explicaciones,
    accion_sugerida = excluded.accion_sugerida;
end;
$$;

-- Re-declaración completa de resolver_alerta_radar con las 3 correcciones
-- (bypass NULL-safe, carrera en el UPDATE, motivo restringido a
-- 'intervencion' para un caller humano).
create or replace function public.resolver_alerta_radar(
  p_alerta_id uuid,
  p_motivo text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alerta radar_alertas;
  v_rol text;
begin
  -- Auditoría (Sección 75): 'auto_resuelta' queda reservado al motor
  -- (_radar_gestionar_alerta) — un caller humano solo puede registrar una
  -- resolución por intervención. Permitir 'auto_resuelta' aquí dejaba a
  -- un nutriólogo descartar una alerta sin cooldown y sin distinguirse de
  -- una resolución automática real, contaminando la futura medición de
  -- resultado de intervención (R4A).
  if p_motivo <> 'intervencion' then
    raise exception 'motivo_resolucion inválido para resolución manual: %. Solo se acepta ''intervencion''.', p_motivo;
  end if;

  select * into v_alerta from radar_alertas where id = p_alerta_id and estado_alerta = 'abierta';
  if v_alerta.id is null then
    raise exception 'Alerta no encontrada o ya resuelta.';
  end if;

  v_rol := public.get_user_rol();
  -- Auditoría (Sección 75): comparación NULL-segura. nutriologo_id puede
  -- ser NULL (perfiles.nutricionista_id se pone en NULL si esa cuenta se
  -- elimina, Sección 27) — con "<>" contra NULL, la condición completa
  -- evaluaba a NULL, y PL/pgSQL trata un IF con condición NULL como falso:
  -- CUALQUIER usuario autenticado podía resolver la alerta de un paciente
  -- sin nutriólogo asignado. "is distinct from" es NULL-safe, y además,
  -- sin nutriólogo asignado, ahora se exige superadmin explícitamente.
  if v_rol <> 'superadmin'
     and (v_alerta.nutriologo_id is null or auth.uid() is distinct from v_alerta.nutriologo_id)
  then
    raise exception 'No tienes permiso para resolver esta alerta.';
  end if;

  -- Auditoría (Sección 75): se agrega "and estado_alerta = 'abierta'" a la
  -- condición del UPDATE (no solo al SELECT de arriba) y se verifica
  -- FOUND — cierra la ventana de carrera entre el SELECT y el UPDATE: dos
  -- resoluciones concurrentes de la misma alerta ya no pueden ambas
  -- "tener éxito" pisando en silencio fecha_resolucion/motivo/cooldown.
  update radar_alertas
    set estado_alerta = 'resuelta',
        fecha_resolucion = (now() at time zone 'America/Mexico_City')::date,
        motivo_resolucion = p_motivo,
        cooldown_until = (now() at time zone 'America/Mexico_City')::date + 14,
        updated_at = now()
    where id = p_alerta_id and estado_alerta = 'abierta';

  if not found then
    raise exception 'La alerta ya fue resuelta por otra operación concurrente.';
  end if;
end;
$$;

revoke execute on function public.resolver_alerta_radar(uuid, text) from public, anon;
grant execute on function public.resolver_alerta_radar(uuid, text) to authenticated;

-- Re-declaración completa de ejecutar_radar_diario: se agrega aislamiento
-- de errores por paciente (subtransacción vía BEGIN/EXCEPTION) y el
-- filtro de is_active.
create or replace function public.ejecutar_radar_diario(
  p_fecha date default (now() at time zone 'America/Mexico_City')::date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente_id uuid;
begin
  for v_paciente_id in
    select id from perfiles
    where estatus = 'aprobado' and rol = 'usuario' and coalesce(is_active, true)
  loop
    -- Auditoría (Sección 75): BEGIN/EXCEPTION anidado crea una
    -- subtransacción (savepoint implícito de PL/pgSQL) — una falla en un
    -- paciente (ej. una carrera que igual se colara pese al ON CONFLICT,
    -- o cualquier otro error inesperado) ya no revierte el trabajo de
    -- todos los pacientes ya procesados en esta misma corrida.
    begin
      perform public.calcular_radar_paciente(v_paciente_id, p_fecha);
    exception when others then
      raise warning 'calcular_radar_paciente falló para paciente %: % (%)', v_paciente_id, sqlerrm, sqlstate;
    end;
  end loop;
end;
$$;

revoke execute on function public.ejecutar_radar_diario(date) from public, anon, authenticated;
grant execute on function public.ejecutar_radar_diario(date) to service_role;

create index on planes_nutricionales(user_id);

-- ============================================================
-- ROLLBACK Sección 75 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección): revierte las funciones a su forma de la Sección
-- 74 (ver el bloque de esa sección para el texto completo) y elimina el
-- índice agregado aquí:
--
-- drop index if exists planes_nutricionales_user_id_idx;
-- [recrear _radar_gestionar_alerta, calcular_radar_paciente,
--  resolver_alerta_radar, ejecutar_radar_diario tal como quedaron en la
--  Sección 74, si se decide revertir esta corrección]
-- ============================================================

-- ============================================================
-- 76. MIGRACIÓN — MyFitTrack Radar (R4B): segunda ronda de correcciones
-- de auditoría (brechas explícitas no cerradas por la Sección 75)
-- ============================================================
--
-- 1. MOTIVOS HUMANOS — resolver_alerta_radar aceptaba únicamente
--    'intervencion' desde la Sección 75. El Blueprint v1.1 (revisión de
--    7 puntos, punto 6) exige que "sin acción" tenga un motivo explícito
--    y distinguible — no puede quedar indistinguible de "nadie la vio
--    nunca". Se amplía el conjunto humano válido a 'intervencion' y
--    'sin_accion'. 'auto_resuelta' sigue reservado EXCLUSIVAMENTE al
--    motor (_radar_gestionar_alerta) y se sigue rechazando desde esta RPC.
--    Se corrige además un bug NULL-unsafe: "p_motivo <> 'intervencion'"
--    evaluaba a NULL (no a verdadero) cuando p_motivo era NULL — el mismo
--    patrón de bug ya identificado y corregido para nutriologo_id en la
--    Sección 75 — dejando pasar un NULL sin rechazarlo. El chequeo nuevo
--    es explícito: "p_motivo is null or p_motivo = '' or p_motivo not in
--    (...)".
--
--    Cooldown para 'sin_accion': se revisó el Blueprint v1.1 y la
--    especificación R4A completa buscando una razón funcional YA
--    DOCUMENTADA para que 'sin_accion' tuviera un cooldown distinto de
--    'intervencion' — no se encontró ninguna. Ambos son resoluciones
--    HUMANAS deliberadas de la misma alerta; dejar 'sin_accion' SIN
--    cooldown abriría exactamente la vía de abuso que motivó restringir
--    los motivos en primer lugar (descartar una alerta repetidamente sin
--    ningún costo). Se aplica el MISMO cooldown de 14 días a ambos
--    motivos. Si en el futuro se decide que 'sin_accion' necesita una
--    ventana distinta, debe ser una decisión de producto explícita nueva,
--    no una inferencia de esta corrección.
--
-- 2. REGISTRO DE ERRORES DEL BATCH — ejecutar_radar_diario silenciaba el
--    detalle del error tras capturarlo (solo un RAISE WARNING, efímero,
--    que nadie revisa después). Se agrega radar_ejecucion_errores como
--    registro durable, visible solo para superadmin, y se conserva el
--    RAISE WARNING como canal adicional (no reemplaza al registro
--    durable, lo complementa para quien esté mirando la sesión en vivo).
--
-- 3. ADVISORY LOCK — ejecutar_radar_diario no impedía dos corridas
--    solapadas del lote completo (dos crons superpuestos). Se agrega
--    pg_try_advisory_xact_lock (NO pg_advisory_lock/pg_try_advisory_lock
--    de sesión: esos permanecerían retenidos si la conexión se reutiliza
--    desde un pool como el de Supabase/PgBouncer, incluso después de que
--    la función termine) — se libera automáticamente al terminar la
--    transacción actual, sin importar cómo termine. Si no se obtiene el
--    lock, se decidió LANZAR UNA EXCEPCIÓN descriptiva en vez de retornar
--    silenciosamente: la firma actual es "returns void", que no tiene
--    ningún otro canal para distinguir "corrí y procesé 0 pacientes" de
--    "no corrí porque otra ejecución ya estaba en curso" — un caller
--    (cron, monitor) que solo mira "¿la llamada tuvo éxito?" necesita que
--    esta situación se vea como una falla, no como un éxito silencioso.
--
-- 4. TRIGGER — marcar_radar_started_at (Sección 72) no tenía
--    "set search_path" explícito, a diferencia de toda función SECURITY
--    DEFINER de este archivo. Se agrega por consistencia — el cuerpo no
--    tiene referencias a objetos de esquema sin calificar que dependieran
--    de esto (solo usa NEW/OLD, que no son objetos de esquema, y now(),
--    built-in de pg_catalog siempre resuelto sin ambigüedad).
--
-- 5. ÍNDICE — se revisaron TODAS las consultas reales contra
--    planes_nutricionales por user_id en el repositorio antes de decidir:
--      · mobile-app/src/lib/api/nutricion.ts:24 — .eq('user_id',...).eq('activo', true)
--      · mobile-app/src/store/news.ts:39         — .eq('user_id',...).eq('activo', true)
--      · admin-web/app/_data/nutricion.ts:60      — .eq('user_id',...).eq('activo', true)
--      · calcular_radar_paciente (Sección 74/75)  — where user_id=... and activo
--    Las CUATRO consultas reales que filtran por user_id filtran también
--    por activo = true — ninguna consulta real necesita el historial
--    completo de planes por usuario. (Las policies de planes_nutricionales
--    y plan_equivalentes en Sección 47 sí consultan sin ese filtro, pero
--    lo hacen por auth.uid()/id de plan, no por user_id de un tercero, así
--    que no son parte de este patrón de acceso). Con esa evidencia, el
--    índice completo de la Sección 75 se reemplaza por uno parcial —
--    misma utilidad para todo lo que existe hoy, menor tamaño y menor
--    costo de mantenimiento en cada INSERT/UPDATE de la tabla. Se le da
--    nombre explícito para que quede claro que es intencional, no un
--    autogenerado más.

alter table radar_alertas drop constraint if exists radar_alertas_motivo_resolucion_check;
alter table radar_alertas add constraint radar_alertas_motivo_resolucion_check
  check (motivo_resolucion in ('intervencion', 'auto_resuelta', 'sin_accion'));

create or replace function public.resolver_alerta_radar(
  p_alerta_id uuid,
  p_motivo text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alerta radar_alertas;
  v_rol text;
begin
  if p_motivo is null or p_motivo = '' or p_motivo not in ('intervencion', 'sin_accion') then
    raise exception 'motivo_resolucion inválido para resolución manual: %. Solo se acepta ''intervencion'' o ''sin_accion''.', coalesce(p_motivo, '(NULL)');
  end if;

  select * into v_alerta from radar_alertas where id = p_alerta_id and estado_alerta = 'abierta';
  if v_alerta.id is null then
    raise exception 'Alerta no encontrada o ya resuelta.';
  end if;

  v_rol := public.get_user_rol();
  if v_rol <> 'superadmin'
     and (v_alerta.nutriologo_id is null or auth.uid() is distinct from v_alerta.nutriologo_id)
  then
    raise exception 'No tienes permiso para resolver esta alerta.';
  end if;

  -- 'intervencion' y 'sin_accion' comparten el mismo cooldown de 14 días
  -- — ver justificación en el encabezado de esta sección.
  update radar_alertas
    set estado_alerta = 'resuelta',
        fecha_resolucion = (now() at time zone 'America/Mexico_City')::date,
        motivo_resolucion = p_motivo,
        cooldown_until = (now() at time zone 'America/Mexico_City')::date + 14,
        updated_at = now()
    where id = p_alerta_id and estado_alerta = 'abierta';

  if not found then
    raise exception 'La alerta ya fue resuelta por otra operación concurrente.';
  end if;
end;
$$;

revoke execute on function public.resolver_alerta_radar(uuid, text) from public, anon;
grant execute on function public.resolver_alerta_radar(uuid, text) to authenticated;

create table public.radar_ejecucion_errores (
  id              uuid        default uuid_generate_v4() primary key,
  paciente_id     uuid        references auth.users(id) on delete set null,
  fecha_ejecucion date        not null,
  sqlstate        text,
  mensaje_error   text,
  created_at      timestamptz not null default now()
);

create index on radar_ejecucion_errores(fecha_ejecucion desc);
create index on radar_ejecucion_errores(paciente_id) where paciente_id is not null;

alter table radar_ejecucion_errores enable row level security;

-- Solo superadmin lee — ni siquiera el nutriólogo dueño del paciente. El
-- mensaje de error es un detalle operativo interno del motor, no
-- información clínica que le corresponda ver a un nutriólogo, y mantener
-- la superficie de lectura mínima reduce el riesgo de filtrar cualquier
-- detalle inesperado que un mensaje de error de Postgres pudiera incluir.
create policy "radar_ejecucion_errores_select" on radar_ejecucion_errores
for select to authenticated using (public.get_user_rol() = 'superadmin');

-- Sin políticas de INSERT/UPDATE/DELETE para authenticated/anon — solo
-- ejecutar_radar_diario (SECURITY DEFINER, propiedad de postgres) escribe,
-- igual patrón que score_snapshots/radar_alertas (Sección 73).

create or replace function public.ejecutar_radar_diario(
  p_fecha date default (now() at time zone 'America/Mexico_City')::date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente_id uuid;
  -- Clave arbitraria pero constante y documentada para el advisory lock de
  -- esta función. c_lock_key1 = 72501 es un "namespace" fijo elegido para
  -- este archivo de corrección (sin significado fuera de este comentario,
  -- simplemente un valor que no colisiona con ningún otro pg_advisory_*
  -- usado en este proyecto — no existe otro en todo supabase_schema.sql).
  -- c_lock_key2 = 1 identifica ESTA función específica, por si en el
  -- futuro se necesitan más locks de radar bajo el mismo namespace sin
  -- colisionar entre ellos.
  c_lock_key1 constant int := 72501;
  c_lock_key2 constant int := 1;
begin
  -- xact (no de sesión): se libera solo al terminar ESTA transacción,
  -- pase lo que pase — nunca queda retenido por una conexión reutilizada
  -- de un pool (PgBouncer/Supabase), a diferencia de pg_advisory_lock o
  -- pg_try_advisory_lock (ambos de sesión).
  if not pg_try_advisory_xact_lock(c_lock_key1, c_lock_key2) then
    raise exception 'ejecutar_radar_diario ya está corriendo en otra transacción — esta corrida se cancela sin procesar ningún paciente (advisory lock %,% no disponible).', c_lock_key1, c_lock_key2;
  end if;

  for v_paciente_id in
    select id from perfiles
    where estatus = 'aprobado' and rol = 'usuario' and coalesce(is_active, true)
  loop
    -- BEGIN/EXCEPTION anidado = subtransacción (savepoint implícito de
    -- PL/pgSQL): una falla en un paciente no revierte el trabajo ya
    -- confirmado de los demás pacientes de esta misma corrida.
    begin
      perform public.calcular_radar_paciente(v_paciente_id, p_fecha);
    exception when others then
      -- El registro del error también corre dentro de su propia
      -- subtransacción: si ESCRIBIR el log fallara por cualquier razón,
      -- eso tampoco debe cancelar el resto del lote.
      begin
        insert into public.radar_ejecucion_errores (paciente_id, fecha_ejecucion, sqlstate, mensaje_error)
        values (v_paciente_id, p_fecha, sqlstate, left(sqlerrm, 500));
      exception when others then
        raise warning 'No se pudo registrar en radar_ejecucion_errores el error de radar para paciente %: %', v_paciente_id, sqlerrm;
      end;
      raise warning 'calcular_radar_paciente falló para paciente %: % (%)', v_paciente_id, sqlerrm, sqlstate;
    end;
  end loop;
end;
$$;

revoke execute on function public.ejecutar_radar_diario(date) from public, anon, authenticated;
grant execute on function public.ejecutar_radar_diario(date) to service_role;

create or replace function public.marcar_radar_started_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estatus = 'aprobado'
     and old.estatus is distinct from 'aprobado'
     and new.radar_started_at is null
  then
    new.radar_started_at := now();
  end if;
  return new;
end;
$$;

drop index if exists planes_nutricionales_user_id_idx;
create index planes_nutricionales_user_id_activo_idx on planes_nutricionales(user_id) where activo;

-- ============================================================
-- ROLLBACK Sección 76 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop index if exists planes_nutricionales_user_id_activo_idx;
-- create index on planes_nutricionales(user_id);
-- [recrear marcar_radar_started_at, ejecutar_radar_diario,
--  resolver_alerta_radar tal como quedaron en la Sección 75]
-- drop table if exists public.radar_ejecucion_errores;
-- alter table radar_alertas drop constraint if exists radar_alertas_motivo_resolucion_check;
-- alter table radar_alertas add constraint radar_alertas_motivo_resolucion_check
--   check (motivo_resolucion in ('intervencion', 'auto_resuelta'));
-- ============================================================

-- ============================================================
-- 77. MIGRACIÓN — MyFitTrack Radar (R4C-1): observabilidad de ejecución
-- diaria — SIN crear el cron real todavía (eso es R4C-2).
-- ============================================================
-- Diseño acordado antes de escribir este SQL (ver respuesta previa a la
-- autorización de R4C-1) — resumen de las decisiones clave:
--
-- 1. ejecutar_radar_diario NO cambia de firma. Su único cambio es que la
--    excepción de "lock no disponible" ahora lleva un SQLSTATE propio
--    ('RDLCK') en vez del genérico P0001 que comparte con cualquier otra
--    excepción de este archivo — así el wrapper puede distinguir esa
--    condición sin depender del texto del mensaje (frágil ante cambios de
--    redacción futuros).
--
-- 2. Los contadores de radar_ejecuciones se calculan por CORRELACIÓN
--    EXACTA (no aproximada) usando que now() es constante durante toda
--    una transacción de Postgres: el wrapper y ejecutar_radar_diario
--    corren en la MISMA transacción, así que todo lo que esa corrida
--    escribe (radar_ejecucion_errores.created_at, radar_alertas.updated_at)
--    comparte el mismo valor exacto de now() que el wrapper capturó al
--    empezar. Esto es exacto, no una ventana de tiempo aproximada, PORQUE
--    el advisory lock garantiza que nunca hay dos corridas reales
--    solapadas — de ahí que NO haga falta pasar ejecucion_id a través del
--    motor (calcular_radar_paciente/_radar_gestionar_alerta quedan
--    intactos).
--
-- 3. pacientes_procesados = candidatos - con_error (por complemento, sin
--    volver a consultar score_snapshots — evita mezclar corridas
--    anteriores, reintentos o ejecuciones concurrentes). snapshots_generados
--    se define IGUAL a pacientes_procesados: el motor garantiza 1 snapshot
--    válido por paciente sin error, y distinguir INSERT-fresco de
--    UPDATE-por-conflicto no aporta nada que esta métrica necesite y
--    requeriría instrumentar el motor solo para eso.
--
-- 4. pacientes_omitidos NO se agrega: es exactamente igual a con_error
--    dado que is_active/estatus ya filtran ANTES de contar candidatos —
--    no existe hoy ninguna otra categoría de "candidato saltado sin
--    error". Esquema mínimo.
--
-- 5. trigger_origen nunca es un parámetro que un cliente controle: dos
--    funciones públicas delgadas (radar_cron_tick, sin acceso de cliente;
--    radar_ejecutar_manual, solo superadmin) llaman a un helper privado
--    compartido pasándole un literal fijo ('cron' / 'manual'). Un cliente
--    no puede falsificar el origen porque nunca lo pasa como argumento.
--
-- 6. resultado = 'exitoso' cuando candidatos = 0 — el scheduler funcionó
--    correctamente y simplemente no había trabajo; "nada que hacer" no es
--    una falla.
--
-- 7. Ventana de ticks (para R4C-2, documentada aquí porque el wrapper ya
--    la implementa): radar_cron_tick() solo actúa si la hora CDMX está en
--    [03:10, 04:00) — la fuente de verdad de "es hora" y "qué fecha es"
--    sigue siendo (now() at time zone 'America/Mexico_City') dentro de
--    Postgres, nunca un offset UTC fijo. El cron en sí (fuera de este
--    archivo, R4C-2) disparará cada 15 min entre las 8-9 UTC — una
--    franja que cubre esa ventana CDMX tanto en UTC-6 (actual) como en un
--    eventual UTC-5, sin tener que tocar nunca la expresión cron.
--
-- 8. Retención: ninguna todavía — se conserva todo durante Radar v1
--    (volumen diminuto en el piloto), decisión explícitamente diferida.

-- ── 77.1 — SQLSTATE propio para la excepción de lock ────────────────────
-- Re-declaración completa: único cambio real es agregar "using errcode =
-- 'RDLCK'" a la excepción de lock — el resto queda idéntico a como quedó
-- en la Sección 76.
create or replace function public.ejecutar_radar_diario(
  p_fecha date default (now() at time zone 'America/Mexico_City')::date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente_id uuid;
  c_lock_key1 constant int := 72501;
  c_lock_key2 constant int := 1;
begin
  if not pg_try_advisory_xact_lock(c_lock_key1, c_lock_key2) then
    raise exception 'ejecutar_radar_diario ya está corriendo en otra transacción — esta corrida se cancela sin procesar ningún paciente (advisory lock %,% no disponible).', c_lock_key1, c_lock_key2
      using errcode = 'RDLCK';
  end if;

  for v_paciente_id in
    select id from perfiles
    where estatus = 'aprobado' and rol = 'usuario' and coalesce(is_active, true)
  loop
    begin
      perform public.calcular_radar_paciente(v_paciente_id, p_fecha);
    exception when others then
      begin
        insert into public.radar_ejecucion_errores (paciente_id, fecha_ejecucion, sqlstate, mensaje_error)
        values (v_paciente_id, p_fecha, sqlstate, left(sqlerrm, 500));
      exception when others then
        raise warning 'No se pudo registrar en radar_ejecucion_errores el error de radar para paciente %: %', v_paciente_id, sqlerrm;
      end;
      raise warning 'calcular_radar_paciente falló para paciente %: % (%)', v_paciente_id, sqlerrm, sqlstate;
    end;
  end loop;
end;
$$;

revoke execute on function public.ejecutar_radar_diario(date) from public, anon, authenticated;
grant execute on function public.ejecutar_radar_diario(date) to service_role;

-- ── 77.2 — radar_ejecuciones ─────────────────────────────────────────────
create table public.radar_ejecuciones (
  id                                 uuid        default uuid_generate_v4() primary key,
  fecha_evaluada                     date        not null,
  iniciado_at                        timestamptz not null,
  finalizado_at                      timestamptz,
  resultado                          text        check (resultado in ('exitoso', 'parcial', 'fallo_total', 'omitido_por_lock')),
  pacientes_candidatos               int         not null default 0,
  pacientes_procesados               int,
  pacientes_con_error                int,
  snapshots_generados                int,
  alertas_abiertas                   int,
  alertas_resueltas_automaticamente  int,
  trigger_origen                     text        not null check (trigger_origen in ('cron', 'manual')),
  created_at                         timestamptz not null default now()
);

create index on radar_ejecuciones(fecha_evaluada desc);
create index on radar_ejecuciones(resultado);

alter table radar_ejecuciones enable row level security;

-- Igual patrón que radar_ejecucion_errores: solo superadmin lee, nadie
-- inserta/actualiza/borra vía RLS — solo el motor SECURITY DEFINER escribe.
create policy "radar_ejecuciones_select" on radar_ejecuciones
for select to authenticated using (public.get_user_rol() = 'superadmin');

-- ── 77.3 — vínculo de radar_ejecucion_errores con su ejecución ──────────
alter table radar_ejecucion_errores add column if not exists ejecucion_id uuid references radar_ejecuciones(id) on delete set null;
create index on radar_ejecucion_errores(ejecucion_id);

-- ── 77.4 — helper privado compartido (nunca invocable por un cliente) ──
create or replace function public._radar_ejecutar_con_observabilidad(p_trigger_origen text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date := (now() at time zone 'America/Mexico_City')::date;
  v_now timestamptz := now(); -- congelado durante toda esta transacción: clave de correlación exacta
  v_inicio timestamptz := clock_timestamp();
  v_ejecucion_id uuid;
  v_candidatos int;
  v_con_error int;
  v_procesados int;
  v_alertas_abiertas int;
  v_alertas_auto_resueltas int;
  v_resultado text;
  v_sqlstate text;
begin
  -- Defensivo — nunca debería dispararse dado que solo se llama
  -- internamente con literales fijos ('cron'/'manual'), nunca con un
  -- valor que un cliente controle.
  if p_trigger_origen not in ('cron', 'manual') then
    raise exception 'trigger_origen inválido: %', p_trigger_origen;
  end if;

  select count(*) into v_candidatos
    from perfiles where estatus = 'aprobado' and rol = 'usuario' and coalesce(is_active, true);

  insert into radar_ejecuciones (fecha_evaluada, iniciado_at, pacientes_candidatos, trigger_origen)
    values (v_fecha, v_inicio, v_candidatos, p_trigger_origen)
    returning id into v_ejecucion_id;

  begin
    perform public.ejecutar_radar_diario(v_fecha);
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = 'RDLCK' then
      update radar_ejecuciones set
        finalizado_at = clock_timestamp(), resultado = 'omitido_por_lock',
        pacientes_procesados = 0, pacientes_con_error = 0,
        snapshots_generados = 0, alertas_abiertas = 0, alertas_resueltas_automaticamente = 0
      where id = v_ejecucion_id;
      return;
    else
      -- No debería ocurrir (ejecutar_radar_diario ya aísla errores por
      -- paciente), pero si algo inesperado escapara igual, se cierra la
      -- fila como fallo_total en vez de dejarla huérfana con resultado=null.
      update radar_ejecuciones set
        finalizado_at = clock_timestamp(), resultado = 'fallo_total',
        pacientes_procesados = 0, pacientes_con_error = v_candidatos,
        snapshots_generados = 0, alertas_abiertas = 0, alertas_resueltas_automaticamente = 0
      where id = v_ejecucion_id;
      return;
    end if;
  end;

  -- Correlación exacta (ver punto 2 del encabezado de esta sección).
  update radar_ejecucion_errores set ejecucion_id = v_ejecucion_id
    where fecha_ejecucion = v_fecha and created_at = v_now and ejecucion_id is null;

  select count(*) into v_con_error from radar_ejecucion_errores where ejecucion_id = v_ejecucion_id;
  v_procesados := v_candidatos - v_con_error;

  select count(*) into v_alertas_abiertas
    from radar_alertas where updated_at = v_now and estado_alerta = 'abierta';
  select count(*) into v_alertas_auto_resueltas
    from radar_alertas where updated_at = v_now and estado_alerta = 'resuelta' and motivo_resolucion = 'auto_resuelta';

  v_resultado := case
    when v_candidatos = 0 then 'exitoso'
    when v_con_error = 0 then 'exitoso'
    when v_procesados > 0 then 'parcial'
    else 'fallo_total'
  end;

  update radar_ejecuciones set
    finalizado_at = clock_timestamp(),
    resultado = v_resultado,
    pacientes_procesados = v_procesados,
    pacientes_con_error = v_con_error,
    snapshots_generados = v_procesados,
    alertas_abiertas = v_alertas_abiertas,
    alertas_resueltas_automaticamente = v_alertas_auto_resueltas
  where id = v_ejecucion_id;
end;
$$;

revoke execute on function public._radar_ejecutar_con_observabilidad(text) from public;

-- ── 77.5 — entrypoints públicos (los únicos que pueden fijar trigger_origen) ──
-- Sin parámetros, sin acceso de cliente — pensada para que R4C-2 la
-- agende con pg_cron. Decide la ventana horaria y el "ya corrió hoy"
-- enteramente en America/Mexico_City, nunca con un offset UTC fijo.
create or replace function public.radar_cron_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hora_cdmx time := (now() at time zone 'America/Mexico_City')::time;
  v_fecha_cdmx date := (now() at time zone 'America/Mexico_City')::date;
begin
  if v_hora_cdmx < time '03:10' or v_hora_cdmx >= time '04:00' then
    return; -- fuera de la ventana objetivo — no hace nada, no registra nada
  end if;

  if exists (
    select 1 from radar_ejecuciones
    where fecha_evaluada = v_fecha_cdmx and resultado in ('exitoso', 'parcial', 'fallo_total')
  ) then
    return; -- ya hubo una corrida real hoy — evita reintentos redundantes cada 15 min dentro de la ventana
  end if;

  perform public._radar_ejecutar_con_observabilidad('cron');
end;
$$;

revoke execute on function public.radar_cron_tick() from public, anon, authenticated;
grant execute on function public.radar_cron_tick() to service_role;

-- Ejecución manual controlada (paso 6 del plan de despliegue de R4C, y
-- útil para depuración) — solo superadmin, sin restricción de ventana
-- horaria ni de "ya corrió hoy" (es una decisión humana explícita).
create or replace function public.radar_ejecutar_manual()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_user_rol() <> 'superadmin' then
    raise exception 'Solo superadmin puede ejecutar Radar manualmente.';
  end if;
  perform public._radar_ejecutar_con_observabilidad('manual');
end;
$$;

revoke execute on function public.radar_ejecutar_manual() from public, anon;
grant execute on function public.radar_ejecutar_manual() to authenticated;

-- ============================================================
-- ROLLBACK Sección 77 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop function if exists public.radar_ejecutar_manual();
-- drop function if exists public.radar_cron_tick();
-- drop function if exists public._radar_ejecutar_con_observabilidad(text);
-- alter table radar_ejecucion_errores drop column if exists ejecucion_id;
-- drop table if exists public.radar_ejecuciones;
-- [recrear ejecutar_radar_diario tal como quedó en la Sección 76, sin el
--  "using errcode = 'RDLCK'", si se decide revertir también ese cambio]
-- ============================================================

-- ============================================================
-- 78. MIGRACIÓN — MyFitTrack Radar (R4C-2): cierre de un hueco de grants
-- real encontrado al desplegar por primera vez a Supabase hosted
-- ============================================================
-- Las Secciones 75 y 76 revocaron EXECUTE de _radar_gestionar_alerta y
-- _radar_ejecutar_con_observabilidad "from public" únicamente — suficiente
-- en el stack local, pero NO en un proyecto Supabase real: la plataforma
-- hosted configura ALTER DEFAULT PRIVILEGES a nivel de base de datos que
-- otorga EXECUTE directamente a anon/authenticated/service_role (como
-- grants individuales, no vía PUBLIC) sobre toda función nueva del schema
-- public. Revocar de PUBLIC no retira un grant ya dado a un rol
-- específico por esa otra vía — por eso en producción ambas funciones
-- quedaron invocables por anon/authenticated pese al "revoke ... from
-- public" ya escrito. Confirmado con evidencia real antes de corregir:
--   * _radar_ejecutar_con_observabilidad SÍ es SECURITY DEFINER (owner
--     postgres) — antes de este fix, una llamada directa de un
--     authenticated corría con privilegios elevados; RLS NO era la
--     barrera real para esta función específica.
--   * _radar_gestionar_alerta es SECURITY INVOKER (confirmado con
--     select prosecdef from pg_proc) — para esta sí RLS de radar_alertas
--     seguía siendo una barrera real adicional (sin policy de
--     INSERT/UPDATE para authenticated), pero de todas formas no debía
--     depender de eso como única defensa.
--
-- El resto de las funciones de Radar (calcular_radar_paciente,
-- ejecutar_radar_diario, radar_cron_tick) ya revocaban "from public,
-- anon, authenticated" explícitamente desde que se escribieron — nunca
-- tuvieron este problema. Verificado en la misma auditoría puntual que
-- ningún otro SECURITY DEFINER de public quedó expuesto por el mismo
-- default privilege (ver reporte de la auditoría, no repetido aquí).
revoke execute on function public._radar_gestionar_alerta(uuid, uuid, text, text, boolean, boolean, date, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public._radar_ejecutar_con_observabilidad(text)
  from public, anon, authenticated;

-- ============================================================
-- ROLLBACK Sección 78 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección; revertirla reabriría el hueco de seguridad ya
-- corregido, así que no hay un escenario legítimo para hacerlo):
--
-- grant execute on function public._radar_gestionar_alerta(uuid, uuid, text, text, boolean, boolean, date, text, jsonb) to anon, authenticated;
-- grant execute on function public._radar_ejecutar_con_observabilidad(text) to anon, authenticated;
-- ============================================================

-- ============================================================
-- 79. MIGRACIÓN — MyFitTrack Radar (R5): vista de lectura para el
-- dashboard web — sin funciones privilegiadas nuevas
-- ============================================================
-- R5 (admin-web) necesita "el snapshot más reciente de cada paciente" para
-- la lista priorizada, sin caer en N+1 (una consulta por paciente). La
-- solución mínima es una VISTA de solo lectura con DISTINCT ON — NO una
-- función SECURITY DEFINER: con "security_invoker = true" (soportado
-- desde PG15, este proyecto corre PG17), la vista ejecuta con los
-- privilegios de quien la consulta, así que las políticas RLS de
-- score_snapshots (Sección 73) se aplican exactamente igual que si el
-- cliente consultara la tabla directamente — un nutriólogo solo ve el
-- último snapshot de sus propios pacientes, superadmin ve todos, un
-- paciente no ve nada. No hay bypass de RLS en ningún punto, y no se
-- introduce ninguna superficie privilegiada nueva.
create view public.radar_ultimo_snapshot
with (security_invoker = true)
as
select distinct on (paciente_id) *
from public.score_snapshots
order by paciente_id, snapshot_date desc, created_at desc;

-- Igual que con las funciones de Radar (Sección 78): un GRANT explícito a
-- authenticated y un REVOKE explícito de anon, sin depender de si la
-- plataforma hosted auto-expone vistas nuevas por default o no — ya
-- aprendimos en R4C-2 a no asumir eso.
revoke all on public.radar_ultimo_snapshot from public, anon;
grant select on public.radar_ultimo_snapshot to authenticated;

-- ============================================================
-- ROLLBACK Sección 79 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop view if exists public.radar_ultimo_snapshot;
-- ============================================================

-- ============================================================
-- 80. MIGRACIÓN — MyFitTrack Radar (R6): registro de intervenciones
-- ============================================================
-- R6 convierte Radar de observación en acción: el nutriólogo puede
-- registrar qué hizo frente a una alerta (o frente al estado general de un
-- paciente sin una alerta puntual) y esa intervención resuelve la alerta
-- correspondiente de forma atómica. R7 (medición de resultado a 14 días,
-- scoring de efectividad) queda explícitamente fuera — ver decisión 6.
--
-- Decisiones de diseño:
--
-- 1. TABLA intervenciones — inmutable en R6 (sin UPDATE ni DELETE
--    expuestos a authenticated/anon, igual que score_snapshots/
--    radar_alertas/radar_ejecucion_errores). El Blueprint deja abierta la
--    posibilidad de permitir editar la nota durante 24h, pero eso exige
--    una segunda RPC + ventana de tiempo + decidir qué campos son
--    editables sin comprometer el snapshot "antes" — complejidad real sin
--    beneficio claro en el MVP. Se prioriza integridad del dataset
--    (ninguna intervención registrada puede alterarse después) sobre
--    conveniencia de edición, como se pidió explícitamente.
--
-- 2. SNAPSHOT "ANTES" — se congela adherence_antes/risk_antes/
--    confianza_antes/snapshot_id/rules_version leyendo el score_snapshot
--    más reciente del paciente EN EL MOMENTO de la intervención, nunca "el
--    snapshot más cercano" calculado después. Si el paciente no tiene
--    ningún snapshot todavía (no debería ocurrir en la práctica, porque
--    ejecutar_radar_diario corre para todo paciente aprobado desde el día
--    en que se aprueba — ver Sección 74, caso R8/⚪ — pero no se fuerza),
--    estos campos simplemente quedan NULL: no se inventa un snapshot
--    ficticio.
--
-- 3. RELACIÓN CON ALERTA — alerta_id es NULL-able. Si viene de una
--    card/alerta concreta, el propio flujo de UI siempre la manda; si
--    viene de RadarTab sin alerta puntual, se permite NULL en vez de
--    forzar una alerta ficticia. Esto no complica el dataset: cualquier
--    métrica futura de "tiempo alerta→intervención" o "efectividad por
--    alerta" simplemente filtra where alerta_id is not null.
--
-- 4. ATOMICIDAD — registrar_intervencion_radar hace INSERT de la
--    intervención y UPDATE de radar_alertas en el mismo cuerpo PL/pgSQL
--    (misma transacción implícita de la llamada RPC): si el UPDATE de la
--    alerta no encuentra una fila 'abierta' (ya se resolvió por otra
--    llamada concurrente, o el caller reintentó sobre una alerta ya
--    resuelta), se lanza una excepción y Postgres revierte TODO —
--    incluyendo el INSERT de la intervención ya ejecutado antes en la
--    misma función. No quedan intervenciones huérfanas. Esto también es
--    la defensa contra doble-registro accidental: un segundo intento sobre
--    la misma alerta falla limpiamente en vez de crear una segunda
--    intervención.
--
--    Se decidió NO reutilizar resolver_alerta_radar (Sección 76) para el
--    paso de resolución, aunque ambas funciones hacen conceptualmente lo
--    mismo: resolver_alerta_radar valida ownership contra
--    radar_alertas.nutriologo_id (una foto fija del dueño al momento en
--    que se abrió la alerta), mientras que esta RPC valida contra
--    perfiles.nutricionista_id (la asignación VIGENTE). Si un paciente
--    fuera reasignado de nutriólogo entre la apertura de la alerta y el
--    registro de la intervención, encadenar ambas funciones rechazaría a
--    un nutriólogo actual legítimo. Se duplica deliberadamente la lógica
--    de resolución (mismo cooldown de 14 días, mismo cálculo de fecha) con
--    un comentario cruzado explícito para que ambas se mantengan en
--    sincronía si el cooldown cambia algún día. resolver_alerta_radar NO
--    se modifica y sigue disponible tal cual para cualquier flujo futuro
--    de "resolver sin registrar intervención" (hoy no expuesto en UI).
--
-- 5. RESOLUTION_TYPE — el Blueprint habla de "resolution_type" y
--    "resolved_at"; esta migración los mapea a las columnas YA EXISTENTES
--    radar_alertas.motivo_resolucion y radar_alertas.fecha_resolucion
--    (Sección 73/76) en vez de crear columnas paralelas con otro nombre.
--    'sin_accion' (valor ya soportado desde la Sección 76) es exactamente
--    el "resolution_type = sin_accion_justificada" que pide el Blueprint —
--    mismo concepto, nombre ya establecido y ya cubierto por tests
--    existentes; renombrarlo sería una migración cosmética sin valor. El
--    "resolved_at" preciso (momento exacto, no solo el día) queda
--    disponible como intervenciones.created_at cuando la intervención
--    resuelve una alerta, sin necesitar una columna timestamptz redundante
--    en radar_alertas — todo el resto del motor de Radar ya es
--    date-granular (snapshot_date, fecha_apertura, fecha_resolucion).
--
-- 6. RESULTADO FUTURO (R7) — NO se agregan columnas "preparadas" para
--    medir efectividad (p.ej. adherence_despues, efectividad_score):
--    revisado el Blueprint v1.1 y R4A completos, no existe un diseño YA
--    APROBADO para esas columnas — inventarlas ahora sería adivinar el
--    diseño de R7. Se agrega únicamente resultado_estado, default
--    'pendiente', con un check que hoy solo admite ese valor. Cuando R7
--    defina sus estados reales (p.ej. 'efectiva'/'no_efectiva'), se
--    ampliará el check con un ALTER — el mismo patrón ya usado para
--    radar_alertas.motivo_resolucion en la Sección 76.
--
-- 7. SUBTIPO — un solo campo de texto (no una tabla de catálogo) con un
--    CHECK que ata cada subtipo a su tipo exacto. Las opciones "Otra" de
--    cada categoría se guardan como 'otro_contacto'/'otro_alimentacion'/
--    'otro_rutina' (no un 'otro' plano compartido): son la única forma de
--    que la métrica "tipos de intervención" (punto 13 del alcance) pueda
--    distinguir después un "otro" de contacto de un "otro" de rutina sin
--    tener que releer la nota libre. No es una categoría nueva — es la
--    misma opción "Otra" de la especificación, solo con un valor de BD
--    que preserva a qué paso pertenecía.
--
-- 8. IDEMPOTENCIA/RETRY — una intervención ligada a alerta_id es
--    naturalmente idempotente ante reintentos: un segundo submit sobre la
--    misma alerta ya resuelta falla (ver punto 4), nunca crea una segunda
--    fila silenciosamente. Una intervención SIN alerta_id no tiene un
--    estado previo que deduplicar — dos submits legítimos y dos reintentos
--    accidentales son indistinguibles a nivel de base de datos. Agregar
--    una idempotency key explícita (columna + índice único opcional)
--    resolvería esto, pero no es un requisito claro del alcance de R6 y
--    añade una superficie nueva; se documenta como deuda técnica menor en
--    vez de construirse sin pedido explícito. La mitigación práctica queda
--    del lado de UI: deshabilitar el botón de "Guardar" tras el primer
--    click.

create table public.intervenciones (
  id                  uuid        default uuid_generate_v4() primary key,
  paciente_id         uuid        references auth.users(id) on delete cascade not null,
  nutriologo_id       uuid        references auth.users(id) on delete set null,
  alerta_id           uuid        references radar_alertas(id) on delete set null,

  tipo                text        not null check (tipo in (
                          'contacto', 'ajuste_alimentacion', 'ajuste_rutina',
                          'reagendar_cita', 'motivacion_seguimiento', 'sin_accion', 'otra'
                      )),
  subtipo             text,
  nota                text,
  motivo_sin_accion   text        check (motivo_sin_accion in (
                          'hable_recientemente', 'no_relevante',
                          'comportamiento_habitual', 'esperare_consulta', 'otro'
                      )),

  -- Snapshot "antes" — congelado al momento de la intervención, nunca
  -- recalculado después (decisión 2).
  adherence_antes     numeric(5,2),
  risk_antes          int,
  confianza_antes     numeric(5,2),
  snapshot_id         uuid        references score_snapshots(id) on delete set null,
  rules_version       text,

  -- Reservado para R7 (decisión 6) — R6 nunca escribe otro valor.
  resultado_estado    text        not null default 'pendiente' check (resultado_estado in ('pendiente')),

  created_at          timestamptz not null default now(),

  -- 'sin_accion' exige motivo explícito; cualquier otro tipo lo prohíbe
  -- (nunca debe quedar ambiguo si "sin acción" fue justificado o no).
  check (tipo <> 'sin_accion' or motivo_sin_accion is not null),
  check (tipo = 'sin_accion' or motivo_sin_accion is null),

  -- Subtipo atado a su tipo exacto (decisión 7). Los tipos sin paso 2
  -- (reagendar_cita, motivacion_seguimiento, sin_accion, otra) no admiten
  -- subtipo.
  check (
    (tipo = 'contacto' and (subtipo is null or subtipo in ('whatsapp', 'llamada', 'consulta', 'otro_contacto')))
    or (tipo = 'ajuste_alimentacion' and (subtipo is null or subtipo in ('flexibilizacion_finde', 'cambio_equivalentes', 'cambio_alimentos', 'ajuste_horarios', 'otro_alimentacion')))
    or (tipo = 'ajuste_rutina' and (subtipo is null or subtipo in ('cambio_ejercicios', 'cambio_volumen', 'cambio_frecuencia', 'ajuste_cargas', 'otro_rutina')))
    or (tipo in ('reagendar_cita', 'motivacion_seguimiento', 'sin_accion', 'otra') and subtipo is null)
  )
);

create index on intervenciones (paciente_id, created_at desc);
create index on intervenciones (alerta_id) where alerta_id is not null;

alter table intervenciones enable row level security;

-- Mismo patrón que score_snapshots/radar_alertas (Sección 73): visibilidad
-- por asignación VIGENTE del paciente (perfiles.nutricionista_id), no por
-- quién registró la fila — si un paciente se reasigna, el nuevo
-- nutriólogo dueño hereda visibilidad del historial clínico, igual que ya
-- ocurre con medidas/rutinas/planes_nutricionales. El paciente NO tiene
-- política de SELECT — cero acceso, como pide el alcance.
create policy "intervenciones_select" on intervenciones
for select to authenticated using (
  exists (select 1 from perfiles where id = intervenciones.paciente_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

-- Sin políticas de INSERT/UPDATE/DELETE para authenticated/anon — toda
-- escritura pasa por registrar_intervencion_radar (SECURITY DEFINER,
-- propiedad de postgres, evade RLS igual que calcular_radar_paciente).
-- Inmutable por diseño (decisión 1): ni siquiera existe un UPDATE/DELETE
-- de emergencia para superadmin — si algún día se necesita corregir un
-- dato erróneo, es una decisión de producto nueva, no un descuido aquí.

alter table radar_alertas add column if not exists intervention_id uuid references intervenciones(id) on delete set null;
create index on radar_alertas (intervention_id) where intervention_id is not null;

create or replace function public.registrar_intervencion_radar(
  p_paciente_id       uuid,
  p_alerta_id         uuid,
  p_tipo              text,
  p_subtipo           text,
  p_nota              text,
  p_motivo_sin_accion text
) returns intervenciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_rol           text;
  v_alerta        radar_alertas;
  v_snapshot      score_snapshots;
  v_motivo_res    text;
  v_intervencion  intervenciones;
begin
  if v_uid is null then
    raise exception 'No autenticado.';
  end if;

  v_rol := public.get_user_rol();
  if v_rol not in ('admin', 'superadmin') then
    raise exception 'Solo un nutriólogo puede registrar intervenciones.';
  end if;

  -- Ownership contra la asignación VIGENTE (perfiles.nutricionista_id),
  -- nunca contra un uuid de nutriólogo mandado por el frontend (decisión
  -- explícita del alcance: "no acepta nutriologo_id confiando ciegamente
  -- en frontend") — por eso esta función ni siquiera recibe ese parámetro,
  -- se deriva de auth.uid().
  --
  -- SIN excepción para superadmin (corrección post-R6): una intervención
  -- representa una acción profesional real de seguimiento, no un
  -- privilegio administrativo. superadmin conserva lectura global (RLS de
  -- SELECT, sin cambios) pero solo puede REGISTRAR una intervención sobre
  -- un paciente si además es su nutricionista_id vigente — exactamente la
  -- misma condición que cualquier otro nutriólogo. Esto protege la
  -- integridad futura del dataset profesional→intervención→resultado
  -- (R7): un rol administrativo no debe poder generar una fila que se lea
  -- después como "seguimiento clínico realizado".
  if not exists (
    select 1 from perfiles where id = p_paciente_id and nutricionista_id = v_uid
  ) then
    raise exception 'No tienes permiso para registrar una intervención para este paciente.';
  end if;

  if p_tipo not in ('contacto', 'ajuste_alimentacion', 'ajuste_rutina', 'reagendar_cita', 'motivacion_seguimiento', 'sin_accion', 'otra') then
    raise exception 'tipo de intervención inválido: %', coalesce(p_tipo, '(NULL)');
  end if;

  if p_tipo = 'sin_accion' then
    if p_motivo_sin_accion is null or p_motivo_sin_accion = '' then
      raise exception 'motivo_sin_accion es obligatorio cuando tipo = sin_accion.';
    end if;
    if p_motivo_sin_accion not in ('hable_recientemente', 'no_relevante', 'comportamiento_habitual', 'esperare_consulta', 'otro') then
      raise exception 'motivo_sin_accion inválido: %', p_motivo_sin_accion;
    end if;
  elsif p_motivo_sin_accion is not null then
    raise exception 'motivo_sin_accion solo aplica cuando tipo = sin_accion.';
  end if;

  if p_tipo = 'contacto' then
    if p_subtipo is not null and p_subtipo not in ('whatsapp', 'llamada', 'consulta', 'otro_contacto') then
      raise exception 'subtipo inválido para tipo=contacto: %', p_subtipo;
    end if;
  elsif p_tipo = 'ajuste_alimentacion' then
    if p_subtipo is not null and p_subtipo not in ('flexibilizacion_finde', 'cambio_equivalentes', 'cambio_alimentos', 'ajuste_horarios', 'otro_alimentacion') then
      raise exception 'subtipo inválido para tipo=ajuste_alimentacion: %', p_subtipo;
    end if;
  elsif p_tipo = 'ajuste_rutina' then
    if p_subtipo is not null and p_subtipo not in ('cambio_ejercicios', 'cambio_volumen', 'cambio_frecuencia', 'ajuste_cargas', 'otro_rutina') then
      raise exception 'subtipo inválido para tipo=ajuste_rutina: %', p_subtipo;
    end if;
  elsif p_subtipo is not null then
    raise exception 'El tipo % no admite subtipo.', p_tipo;
  end if;

  if p_alerta_id is not null then
    select * into v_alerta from radar_alertas where id = p_alerta_id;
    if v_alerta.id is null then
      raise exception 'Alerta no encontrada.';
    end if;
    if v_alerta.paciente_id <> p_paciente_id then
      raise exception 'La alerta no pertenece a este paciente.';
    end if;
    if v_alerta.estado_alerta <> 'abierta' then
      raise exception 'Esta alerta ya fue resuelta — no se puede registrar una nueva intervención sobre ella.';
    end if;
  end if;

  -- Snapshot "antes" (decisión 2) — el más reciente disponible, NULL si no
  -- existe ninguno todavía. Nunca se recalcula.
  select * into v_snapshot from score_snapshots
    where paciente_id = p_paciente_id
    order by snapshot_date desc, created_at desc
    limit 1;

  insert into intervenciones (
    paciente_id, nutriologo_id, alerta_id, tipo, subtipo, nota, motivo_sin_accion,
    adherence_antes, risk_antes, confianza_antes, snapshot_id, rules_version
  ) values (
    p_paciente_id, v_uid, p_alerta_id, p_tipo, p_subtipo, nullif(trim(p_nota), ''), p_motivo_sin_accion,
    v_snapshot.adherence_global, v_snapshot.riesgo_confirmado_puntos, v_snapshot.data_confidence_global,
    v_snapshot.id, v_snapshot.rules_version
  ) returning * into v_intervencion;

  if p_alerta_id is not null then
    -- Duplica deliberadamente la resolución de resolver_alerta_radar en
    -- vez de llamarla — ver decisión 4 (divergencia de ownership check en
    -- el caso de reasignación de paciente). Mismo cooldown de 14 días.
    v_motivo_res := case when p_tipo = 'sin_accion' then 'sin_accion' else 'intervencion' end;
    update radar_alertas
      set estado_alerta = 'resuelta',
          fecha_resolucion = (now() at time zone 'America/Mexico_City')::date,
          motivo_resolucion = v_motivo_res,
          cooldown_until = (now() at time zone 'America/Mexico_City')::date + 14,
          intervention_id = v_intervencion.id,
          updated_at = now()
      where id = p_alerta_id and estado_alerta = 'abierta';

    if not found then
      raise exception 'La alerta ya fue resuelta por otra operación concurrente.';
    end if;
  end if;

  return v_intervencion;
end;
$$;

revoke execute on function public.registrar_intervencion_radar(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.registrar_intervencion_radar(uuid, uuid, text, text, text, text) to authenticated;

-- ============================================================
-- ROLLBACK Sección 80 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- revoke execute on function public.registrar_intervencion_radar(uuid, uuid, text, text, text, text) from authenticated;
-- drop function if exists public.registrar_intervencion_radar(uuid, uuid, text, text, text, text);
-- drop index if exists radar_alertas_intervention_id_idx;
-- alter table radar_alertas drop column if exists intervention_id;
-- drop table if exists public.intervenciones;
-- ============================================================

-- ============================================================
-- 81. MIGRACIÓN — MyFitTrack Radar (R7): medición post-intervención
-- ============================================================
-- Cierra el loop señal→alerta→intervención→qué ocurrió después. Mide
-- ASOCIACIÓN TEMPORAL, nunca causalidad — de ahí que los 6 estados finales
-- sean deliberadamente descriptivos (mejoro/estable/empeoro/inconcluso/
-- confundido) y no evaluativos (nunca "efectiva"/"funcionó").
--
-- Decisiones de diseño:
--
-- 1. VENTANAS, EXACTAS Y DETERMINISTAS (timezone America/Mexico_City en
--    todos los cálculos, igual que el resto del motor):
--      fecha_intervencion := (intervenciones.created_at at time zone
--        'America/Mexico_City')::date
--      Ventana "antes"    := [fecha_intervencion - 7, fecha_intervencion - 1]  (7 días, ambos límites incluidos)
--      Ventana "después"  := [fecha_intervencion + 1, fecha_intervencion + 14] (14 días, ambos límites incluidos)
--    El día de la intervención (día 0) NO pertenece a ninguna ventana —
--    exactamente lo pedido ("no incluyas el día de la intervención si
--    puede contaminar ambas ventanas"). La ventana solo se considera
--    cerrada, y por lo tanto evaluable, cuando p_fecha >= fecha_intervencion + 14.
--
-- 2. "ANTES" NO SE RECALCULA — se reutilizan adherence_antes/
--    risk_points_antes/confianza_antes tal como los congeló R6 (Sección
--    80) al momento de registrar la intervención: el snapshot más
--    reciente disponible EN ESE MOMENTO. Evalué recalcular "antes" como
--    un promedio de los 7 días previos y decidí NO hacerlo, por dos
--    razones: (a) violaría la garantía explícita de R6 de que estos
--    campos "se congelan al momento de la intervención, nunca se
--    reconstruyen después" (Sección 80, decisión 2) — recalcularlos aquí,
--    14 días más tarde, sería exactamente esa reconstrucción prohibida;
--    (b) adherence_global YA es una métrica ponderada/con ventana propia
--    dentro del motor (Sección 74) — promediar varios snapshots ya
--    suavizados sería un doble suavizado sin beneficio claro. La ventana
--    "antes" de 7 días SÍ se usa, pero como una COMPUERTA de frescura: si
--    el snapshot congelado como "antes" tiene una fecha anterior a
--    fecha_intervencion-7 (hueco de datos), no se considera comparable y
--    el resultado es 'inconcluso' — ver decisión 5.
--
-- 3. "DESPUÉS" = el snapshot MÁS RECIENTE dentro de la ventana de 14 días,
--    no un promedio — por la misma razón de no doble-suavizar, y porque
--    el Blueprint pide evaluar "al terminar la ventana", es decir el
--    estado más cercano al final del período, no un promedio de todo el
--    período. Si no existe NINGÚN snapshot dentro de la ventana (hueco de
--    datos, paciente inactivo, etc.) — NUNCA se rellena silenciosamente:
--    el resultado queda 'inconcluso' con el motivo explícito.
--
-- 4. RENOMBRE risk_antes → risk_points_antes (más NUEVA columna
--    risk_points_despues, nunca "risk_despues") — decisión explícita:
--    riesgo_confirmado_puntos NUNCA fue una escala 0-100 (lección de R5),
--    así que "risk" a secas invita a leerlo como porcentaje. Factible sin
--    romper nada porque R6 nunca se desplegó a producción todavía (sigue
--    solo en supabase_schema.sql + entornos locales) — se ajusta también
--    registrar_intervencion_radar (mismo cuerpo, solo el nombre de
--    columna en el INSERT) y los tests existentes de intervenciones.sql.
--
-- 5. CONFIANZA — umbral mínimo 50% en AMBOS lados (confianza_antes Y la
--    confianza del snapshot "después"), más el chequeo de frescura de la
--    decisión 2. Además: si el CONJUNTO de dominios evaluables cambió
--    entre antes y después (ej. training_confidence pasó de NULL a
--    tener valor, o viceversa — el dominio de nutrición siempre existe,
--    training es el único opcional per Sección 73), el resultado también
--    es 'inconcluso' — evita exactamente el caso que preocupa: que una
--    "mejora" de confianza global sea en realidad la desaparición del
--    dominio con peor información, no una mejora real de datos. No se
--    parsea el jsonb de breakdown para esto: nutrition_confidence/
--    training_confidence ya son columnas de primer nivel en
--    score_snapshots (Sección 73), suficientes para esta comparación.
--
-- 6. UMBRAL DE CLASIFICACIÓN — se mantiene ±10 puntos de adherencia
--    (delta_adherence > +10 → mejoro; [-10,+10] → estable; < -10 →
--    empeoro) DESPUÉS de revisarlo contra lo construido: adherence_global
--    ya es un promedio ponderado por confianza de dominio (Sección 74),
--    ya representativo de una ventana de datos real (no un valor crudo de
--    un solo día) — el problema matemático que el Blueprint original
--    corría (comparar puntos crudos sin exigir confianza mínima en ambos
--    lados) queda resuelto por la decisión 5, no por cambiar el umbral en
--    sí. ±10 puntos porcentuales de adherencia sigue siendo una banda
--    razonable dado que adherence_global ya viene suavizado; no se
--    encontró evidencia en este dataset (todavía sin volumen real) para
--    justificar un umbral distinto — queda documentado para revisarse con
--    datos reales de producción.
--
-- 7. CONFOUNDERS (evaluados ANTES de clasificar por umbral — un segundo
--    evento SIEMPRE gana sobre el número, sea cual sea):
--    a. Segunda intervención del mismo paciente con fecha (America/
--       Mexico_City) dentro de la ventana "después" — sin filtrar por
--       tipo ni por su propio resultado_estado (cualquier otra
--       intervención cuenta, incluida otra que también siga pendiente).
--    b. Cita con estado='confirmada' y fecha dentro de la ventana
--       "después". LIMITACIÓN DOCUMENTADA: la tabla citas (Sección 3,
--       "estado in ('pendiente','confirmada','cancelada')") NO distingue
--       "asistida" de "confirmada" — no existe ese dato hoy. Se usa
--       'confirmada' como aproximación de "hubo una consulta programada
--       que probablemente ocurrió"; una cita confirmada con no-show real
--       generaría un falso positivo de confounder. Documentado en vez de
--       fingir precisión que el schema no tiene, como se pidió.
--    c. Plan nutricional o rutina NUEVOS (created_at dentro de la ventana
--       "después") — solo cuenta como confounder si el tipo de la
--       intervención evaluada NO es, respectivamente, 'ajuste_alimentacion'
--       o 'ajuste_rutina' (si lo es, el cambio de plan/rutina bien podría
--       ser la intervención misma, no un evento aparte). Sí es detectable
--       con datos reales: planes_nutricionales y rutinas tienen created_at
--       confiable (Secciones 1 y 5) — se implementa de verdad, sin
--       necesidad de documentarlo como limitación.
--
-- 8. INMUTABILIDAD — evaluar_resultado_intervencion es un no-op (return
--    silencioso, sin excepción) si resultado_estado ya no es 'pendiente'
--    O si la ventana de 14 días todavía no cerró. Una vez calculado, el
--    resultado NUNCA se recalcula — ni por una segunda corrida diaria, ni
--    por un cambio futuro de rules_version. rules_version_resultado
--    identifica la versión del ALGORITMO DE CLASIFICACIÓN (esta Sección
--    81), deliberadamente separada de score_snapshots.rules_version (la
--    versión del MOTOR DE SCORING, Sección 74) — son dos cosas que pueden
--    evolucionar en momentos distintos.
--
-- 9. DELTAS — delta_adherence/delta_risk/delta_confianza NO se
--    persisten: son triviales (despues - antes) y 100% reproducibles a
--    partir de columnas ya almacenadas, exactamente el caso que el
--    alcance permite omitir ("no es obligatorio si son triviales y
--    reproducibles"). Se calculan en el frontend (admin-web/app/_data/radar.ts)
--    donde se necesitan para el copy de la UI.
--
-- 10. snapshot_id_despues — columna NO listada explícitamente en el
--    alcance, agregada por simetría directa con snapshot_id ("antes"):
--    sin ella, el snapshot exacto usado como "después" no sería
--    reproducible después de que rules_version o el propio snapshot
--    cambien de forma. Mismo principio de reproducibilidad que ya motivó
--    guardar snapshot_id en R6.
--
-- 11. INTEGRACIÓN CON LA EJECUCIÓN DIARIA — ejecutar_radar_diario, después
--    de su loop existente de pacientes, agrega un segundo loop sobre
--    intervenciones pendientes con ventana ya cerrada. Un fallo al
--    evaluar UNA intervención se aísla igual que un fallo de
--    calcular_radar_paciente (subtransacción + registro en
--    radar_ejecucion_errores, con el mensaje prefijado "INTERVENCION
--    <id>:" para poder contarlos por separado) y NO cancela el resto del
--    lote. radar_ejecuciones gana dos columnas nuevas
--    (intervenciones_evaluadas/intervenciones_con_error), pobladas por
--    _radar_ejecutar_con_observabilidad con la misma técnica de
--    correlación exacta por timestamp ya usada para alertas_abiertas/
--    alertas_resueltas_automaticamente (Sección 77) — no se agregó
--    ninguna métrica decorativa adicional.

alter table intervenciones rename column risk_antes to risk_points_antes;

alter table intervenciones
  add column adherence_despues       numeric(5,2),
  add column risk_points_despues     int,
  add column confianza_despues       numeric(5,2),
  add column snapshot_id_despues     uuid references score_snapshots(id) on delete set null,
  add column resultado_calculado_at  timestamptz,
  add column rules_version_resultado text,
  add column confound_detalle        text;

alter table intervenciones drop constraint if exists intervenciones_resultado_estado_check;
alter table intervenciones add constraint intervenciones_resultado_estado_check
  check (resultado_estado in ('pendiente', 'mejoro', 'estable', 'empeoro', 'inconcluso', 'confundido'));

-- Query de la Sección 81.11 abajo: "pendientes cuya ventana ya cerró" es
-- monótona en created_at — un índice parcial (solo filas pendiente, la
-- inmensa minoría una vez que el sistema lleva un tiempo corriendo) basta.
create index intervenciones_pendientes_created_at_idx on intervenciones (created_at) where resultado_estado = 'pendiente';

-- Re-declaración completa de registrar_intervencion_radar: único cambio
-- real es el nombre de columna en el INSERT (risk_antes →
-- risk_points_antes, decisión 4) — el resto del cuerpo es idéntico a la
-- Sección 80.
create or replace function public.registrar_intervencion_radar(
  p_paciente_id       uuid,
  p_alerta_id         uuid,
  p_tipo              text,
  p_subtipo           text,
  p_nota              text,
  p_motivo_sin_accion text
) returns intervenciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_rol           text;
  v_alerta        radar_alertas;
  v_snapshot      score_snapshots;
  v_motivo_res    text;
  v_intervencion  intervenciones;
begin
  if v_uid is null then
    raise exception 'No autenticado.';
  end if;

  v_rol := public.get_user_rol();
  if v_rol not in ('admin', 'superadmin') then
    raise exception 'Solo un nutriólogo puede registrar intervenciones.';
  end if;

  -- Ownership contra la asignación VIGENTE (perfiles.nutricionista_id),
  -- nunca contra un uuid de nutriólogo mandado por el frontend (decisión
  -- explícita del alcance: "no acepta nutriologo_id confiando ciegamente
  -- en frontend") — por eso esta función ni siquiera recibe ese parámetro,
  -- se deriva de auth.uid().
  --
  -- SIN excepción para superadmin (corrección post-R6): una intervención
  -- representa una acción profesional real de seguimiento, no un
  -- privilegio administrativo. superadmin conserva lectura global (RLS de
  -- SELECT, sin cambios) pero solo puede REGISTRAR una intervención sobre
  -- un paciente si además es su nutricionista_id vigente — exactamente la
  -- misma condición que cualquier otro nutriólogo. Esto protege la
  -- integridad futura del dataset profesional→intervención→resultado
  -- (R7): un rol administrativo no debe poder generar una fila que se lea
  -- después como "seguimiento clínico realizado".
  if not exists (
    select 1 from perfiles where id = p_paciente_id and nutricionista_id = v_uid
  ) then
    raise exception 'No tienes permiso para registrar una intervención para este paciente.';
  end if;

  if p_tipo not in ('contacto', 'ajuste_alimentacion', 'ajuste_rutina', 'reagendar_cita', 'motivacion_seguimiento', 'sin_accion', 'otra') then
    raise exception 'tipo de intervención inválido: %', coalesce(p_tipo, '(NULL)');
  end if;

  if p_tipo = 'sin_accion' then
    if p_motivo_sin_accion is null or p_motivo_sin_accion = '' then
      raise exception 'motivo_sin_accion es obligatorio cuando tipo = sin_accion.';
    end if;
    if p_motivo_sin_accion not in ('hable_recientemente', 'no_relevante', 'comportamiento_habitual', 'esperare_consulta', 'otro') then
      raise exception 'motivo_sin_accion inválido: %', p_motivo_sin_accion;
    end if;
  elsif p_motivo_sin_accion is not null then
    raise exception 'motivo_sin_accion solo aplica cuando tipo = sin_accion.';
  end if;

  if p_tipo = 'contacto' then
    if p_subtipo is not null and p_subtipo not in ('whatsapp', 'llamada', 'consulta', 'otro_contacto') then
      raise exception 'subtipo inválido para tipo=contacto: %', p_subtipo;
    end if;
  elsif p_tipo = 'ajuste_alimentacion' then
    if p_subtipo is not null and p_subtipo not in ('flexibilizacion_finde', 'cambio_equivalentes', 'cambio_alimentos', 'ajuste_horarios', 'otro_alimentacion') then
      raise exception 'subtipo inválido para tipo=ajuste_alimentacion: %', p_subtipo;
    end if;
  elsif p_tipo = 'ajuste_rutina' then
    if p_subtipo is not null and p_subtipo not in ('cambio_ejercicios', 'cambio_volumen', 'cambio_frecuencia', 'ajuste_cargas', 'otro_rutina') then
      raise exception 'subtipo inválido para tipo=ajuste_rutina: %', p_subtipo;
    end if;
  elsif p_subtipo is not null then
    raise exception 'El tipo % no admite subtipo.', p_tipo;
  end if;

  if p_alerta_id is not null then
    select * into v_alerta from radar_alertas where id = p_alerta_id;
    if v_alerta.id is null then
      raise exception 'Alerta no encontrada.';
    end if;
    if v_alerta.paciente_id <> p_paciente_id then
      raise exception 'La alerta no pertenece a este paciente.';
    end if;
    if v_alerta.estado_alerta <> 'abierta' then
      raise exception 'Esta alerta ya fue resuelta — no se puede registrar una nueva intervención sobre ella.';
    end if;
  end if;

  -- Snapshot "antes" (decisión 2) — el más reciente disponible, NULL si no
  -- existe ninguno todavía. Nunca se recalcula.
  select * into v_snapshot from score_snapshots
    where paciente_id = p_paciente_id
    order by snapshot_date desc, created_at desc
    limit 1;

  insert into intervenciones (
    paciente_id, nutriologo_id, alerta_id, tipo, subtipo, nota, motivo_sin_accion,
    adherence_antes, risk_points_antes, confianza_antes, snapshot_id, rules_version
  ) values (
    p_paciente_id, v_uid, p_alerta_id, p_tipo, p_subtipo, nullif(trim(p_nota), ''), p_motivo_sin_accion,
    v_snapshot.adherence_global, v_snapshot.riesgo_confirmado_puntos, v_snapshot.data_confidence_global,
    v_snapshot.id, v_snapshot.rules_version
  ) returning * into v_intervencion;

  if p_alerta_id is not null then
    -- Duplica deliberadamente la resolución de resolver_alerta_radar en
    -- vez de llamarla — ver decisión 4 de la Sección 80 (divergencia de
    -- ownership check en el caso de reasignación de paciente). Mismo
    -- cooldown de 14 días.
    v_motivo_res := case when p_tipo = 'sin_accion' then 'sin_accion' else 'intervencion' end;
    update radar_alertas
      set estado_alerta = 'resuelta',
          fecha_resolucion = (now() at time zone 'America/Mexico_City')::date,
          motivo_resolucion = v_motivo_res,
          cooldown_until = (now() at time zone 'America/Mexico_City')::date + 14,
          intervention_id = v_intervencion.id,
          updated_at = now()
      where id = p_alerta_id and estado_alerta = 'abierta';

    if not found then
      raise exception 'La alerta ya fue resuelta por otra operación concurrente.';
    end if;
  end if;

  return v_intervencion;
end;
$$;

-- GRANT/REVOKE sin cambios respecto a la Sección 80 (create or replace no
-- los toca, pero se re-emiten por claridad y para no depender de que
-- sobrevivan implícitamente).
revoke execute on function public.registrar_intervencion_radar(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.registrar_intervencion_radar(uuid, uuid, text, text, text, text) to authenticated;

create or replace function public.evaluar_resultado_intervencion(
  p_intervencion_id uuid,
  p_fecha           date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Versión del ALGORITMO de clasificación (decisión 8) — independiente
  -- de score_snapshots.rules_version.
  c_rules_version_resultado constant text := 'radar-resultado-v1';

  v_i                   intervenciones;
  v_fecha_intervencion  date;
  v_despues_inicio      date;
  v_despues_fin         date;
  v_snap_despues        score_snapshots;
  v_snap_antes          score_snapshots;
  v_antes_fresco        boolean;
  v_resultado           text;
  v_detalle             text;
  v_adherence_despues   numeric(5,2);
  v_risk_despues        int;
  v_confianza_despues   numeric(5,2);
  v_snapshot_despues_id uuid;
  v_delta               numeric(6,2);
  v_otra_fecha          date;
  v_cita_fecha          date;
begin
  select * into v_i from intervenciones where id = p_intervencion_id;
  if v_i.id is null then
    raise exception 'Intervención % no encontrada.', p_intervencion_id;
  end if;

  -- Inmutabilidad (decisión 8): no-op silencioso si ya se calculó, o si la
  -- ventana todavía no cierra — ninguno de los dos casos es un error.
  if v_i.resultado_estado <> 'pendiente' then
    return;
  end if;

  v_fecha_intervencion := (v_i.created_at at time zone 'America/Mexico_City')::date;
  if p_fecha < v_fecha_intervencion + 14 then
    return;
  end if;

  v_despues_inicio := v_fecha_intervencion + 1;
  v_despues_fin    := v_fecha_intervencion + 14;

  select * into v_snap_despues from score_snapshots
    where paciente_id = v_i.paciente_id
      and snapshot_date between v_despues_inicio and v_despues_fin
    order by snapshot_date desc, created_at desc
    limit 1;

  if v_snap_despues.id is null then
    v_resultado := 'inconcluso';
    v_detalle := 'No hay snapshots de Radar en la ventana de 14 días posteriores a la intervención.';
  else
    v_adherence_despues := v_snap_despues.adherence_global;
    v_risk_despues := v_snap_despues.riesgo_confirmado_puntos;
    v_confianza_despues := v_snap_despues.data_confidence_global;
    v_snapshot_despues_id := v_snap_despues.id;

    -- ── Confounders (decisión 7) — siempre antes de clasificar ─────────
    if exists (
      select 1 from intervenciones
      where paciente_id = v_i.paciente_id and id <> v_i.id
        and (created_at at time zone 'America/Mexico_City')::date between v_despues_inicio and v_despues_fin
    ) then
      select (created_at at time zone 'America/Mexico_City')::date into v_otra_fecha
        from intervenciones
        where paciente_id = v_i.paciente_id and id <> v_i.id
          and (created_at at time zone 'America/Mexico_City')::date between v_despues_inicio and v_despues_fin
        order by created_at asc limit 1;
      v_resultado := 'confundido';
      v_detalle := format('Se registró otra intervención el %s.', to_char(v_otra_fecha, 'DD/MM/YYYY'));
    end if;

    if v_resultado is null and exists (
      select 1 from citas
      where user_id = v_i.paciente_id and estado = 'confirmada'
        and fecha between v_despues_inicio and v_despues_fin
    ) then
      select fecha into v_cita_fecha from citas
        where user_id = v_i.paciente_id and estado = 'confirmada'
          and fecha between v_despues_inicio and v_despues_fin
        order by fecha asc limit 1;
      v_resultado := 'confundido';
      v_detalle := format('Hubo una consulta confirmada el %s durante la ventana de seguimiento.', to_char(v_cita_fecha, 'DD/MM/YYYY'));
    end if;

    if v_resultado is null and v_i.tipo <> 'ajuste_alimentacion' and exists (
      select 1 from planes_nutricionales
      where user_id = v_i.paciente_id
        and (created_at at time zone 'America/Mexico_City')::date between v_despues_inicio and v_despues_fin
    ) then
      v_resultado := 'confundido';
      v_detalle := 'Se creó un plan nutricional nuevo durante la ventana de seguimiento.';
    end if;

    if v_resultado is null and v_i.tipo <> 'ajuste_rutina' and exists (
      select 1 from rutinas
      where user_id = v_i.paciente_id
        and (created_at at time zone 'America/Mexico_City')::date between v_despues_inicio and v_despues_fin
    ) then
      v_resultado := 'confundido';
      v_detalle := 'Se creó una rutina nueva durante la ventana de seguimiento.';
    end if;

    -- ── Clasificación numérica (solo si no hubo confounder) ────────────
    if v_resultado is null then
      if v_i.snapshot_id is not null then
        select * into v_snap_antes from score_snapshots where id = v_i.snapshot_id;
      end if;
      v_antes_fresco := v_snap_antes.id is not null and v_snap_antes.snapshot_date >= v_fecha_intervencion - 7;

      if not v_antes_fresco
         or v_i.confianza_antes is null or v_i.confianza_antes < 50
         or v_confianza_despues < 50
      then
        v_resultado := 'inconcluso';
        v_detalle := 'Confianza insuficiente antes o después de la intervención para comparar con seguridad.';
      elsif (v_snap_antes.training_confidence is not null) <> (v_snap_despues.training_confidence is not null) then
        v_resultado := 'inconcluso';
        v_detalle := 'El conjunto de dominios con información evaluable cambió entre antes y después — la comparación no es confiable.';
      elsif v_i.adherence_antes is null or v_adherence_despues is null then
        v_resultado := 'inconcluso';
        v_detalle := 'No hay un valor de adherencia comparable antes y después.';
      else
        v_delta := v_adherence_despues - v_i.adherence_antes;
        v_resultado := case
          when v_delta > 10 then 'mejoro'
          when v_delta < -10 then 'empeoro'
          else 'estable'
        end;
      end if;
    end if;
  end if;

  update intervenciones set
    resultado_estado = v_resultado,
    adherence_despues = v_adherence_despues,
    risk_points_despues = v_risk_despues,
    confianza_despues = v_confianza_despues,
    snapshot_id_despues = v_snapshot_despues_id,
    confound_detalle = v_detalle,
    resultado_calculado_at = now(),
    rules_version_resultado = c_rules_version_resultado
  where id = v_i.id;
end;
$$;

revoke execute on function public.evaluar_resultado_intervencion(uuid, date) from public, anon, authenticated;
grant execute on function public.evaluar_resultado_intervencion(uuid, date) to service_role;

-- Re-declaración completa de ejecutar_radar_diario: agrega el segundo
-- loop de la decisión 11 después del loop de pacientes existente (Sección
-- 77.1), sin cambiar su firma ni el comportamiento del primer loop.
create or replace function public.ejecutar_radar_diario(
  p_fecha date default (now() at time zone 'America/Mexico_City')::date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente_id uuid;
  v_intervencion_id uuid;
  c_lock_key1 constant int := 72501;
  c_lock_key2 constant int := 1;
begin
  if not pg_try_advisory_xact_lock(c_lock_key1, c_lock_key2) then
    raise exception 'ejecutar_radar_diario ya está corriendo en otra transacción — esta corrida se cancela sin procesar ningún paciente (advisory lock %,% no disponible).', c_lock_key1, c_lock_key2
      using errcode = 'RDLCK';
  end if;

  for v_paciente_id in
    select id from perfiles
    where estatus = 'aprobado' and rol = 'usuario' and coalesce(is_active, true)
  loop
    begin
      perform public.calcular_radar_paciente(v_paciente_id, p_fecha);
    exception when others then
      begin
        insert into public.radar_ejecucion_errores (paciente_id, fecha_ejecucion, sqlstate, mensaje_error)
        values (v_paciente_id, p_fecha, sqlstate, left(sqlerrm, 500));
      exception when others then
        raise warning 'No se pudo registrar en radar_ejecucion_errores el error de radar para paciente %: %', v_paciente_id, sqlerrm;
      end;
      raise warning 'calcular_radar_paciente falló para paciente %: % (%)', v_paciente_id, sqlerrm, sqlstate;
    end;
  end loop;

  -- R7 (Sección 81, decisión 11): tras generar los snapshots del día,
  -- evaluar cualquier intervención pendiente cuya ventana de 14 días ya
  -- haya cerrado. Aislado igual que el loop de arriba — un fallo aquí
  -- nunca cancela el resto del lote (ni el de pacientes, ya terminado, ni
  -- otras intervenciones).
  for v_intervencion_id in
    select id from intervenciones
    where resultado_estado = 'pendiente'
      and (created_at at time zone 'America/Mexico_City')::date + 14 <= p_fecha
  loop
    begin
      perform public.evaluar_resultado_intervencion(v_intervencion_id, p_fecha);
    exception when others then
      begin
        insert into public.radar_ejecucion_errores (paciente_id, fecha_ejecucion, sqlstate, mensaje_error)
        values (
          (select paciente_id from intervenciones where id = v_intervencion_id),
          p_fecha, sqlstate,
          left('INTERVENCION ' || v_intervencion_id || ': ' || sqlerrm, 500)
        );
      exception when others then
        raise warning 'No se pudo registrar en radar_ejecucion_errores el error de evaluación de intervención %: %', v_intervencion_id, sqlerrm;
      end;
      raise warning 'evaluar_resultado_intervencion falló para intervención %: % (%)', v_intervencion_id, sqlerrm, sqlstate;
    end;
  end loop;
end;
$$;

revoke execute on function public.ejecutar_radar_diario(date) from public, anon, authenticated;
grant execute on function public.ejecutar_radar_diario(date) to service_role;

alter table public.radar_ejecuciones
  add column intervenciones_evaluadas  int,
  add column intervenciones_con_error  int;

-- Re-declaración completa de _radar_ejecutar_con_observabilidad: agrega el
-- cálculo de las 2 columnas nuevas, misma técnica de correlación exacta
-- por timestamp ya usada para alertas_abiertas/alertas_resueltas_automaticamente
-- (Sección 77.4) — los errores de intervención se distinguen de los de
-- paciente por el prefijo "INTERVENCION " que ejecutar_radar_diario ya les
-- da al mensaje.
create or replace function public._radar_ejecutar_con_observabilidad(p_trigger_origen text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date := (now() at time zone 'America/Mexico_City')::date;
  v_now timestamptz := now();
  v_inicio timestamptz := clock_timestamp();
  v_ejecucion_id uuid;
  v_candidatos int;
  v_con_error int;
  v_procesados int;
  v_alertas_abiertas int;
  v_alertas_auto_resueltas int;
  v_intervenciones_evaluadas int;
  v_intervenciones_con_error int;
  v_resultado text;
  v_sqlstate text;
begin
  if p_trigger_origen not in ('cron', 'manual') then
    raise exception 'trigger_origen inválido: %', p_trigger_origen;
  end if;

  select count(*) into v_candidatos
    from perfiles where estatus = 'aprobado' and rol = 'usuario' and coalesce(is_active, true);

  insert into radar_ejecuciones (fecha_evaluada, iniciado_at, pacientes_candidatos, trigger_origen)
    values (v_fecha, v_inicio, v_candidatos, p_trigger_origen)
    returning id into v_ejecucion_id;

  begin
    perform public.ejecutar_radar_diario(v_fecha);
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = 'RDLCK' then
      update radar_ejecuciones set
        finalizado_at = clock_timestamp(), resultado = 'omitido_por_lock',
        pacientes_procesados = 0, pacientes_con_error = 0,
        snapshots_generados = 0, alertas_abiertas = 0, alertas_resueltas_automaticamente = 0,
        intervenciones_evaluadas = 0, intervenciones_con_error = 0
      where id = v_ejecucion_id;
      return;
    else
      update radar_ejecuciones set
        finalizado_at = clock_timestamp(), resultado = 'fallo_total',
        pacientes_procesados = 0, pacientes_con_error = v_candidatos,
        snapshots_generados = 0, alertas_abiertas = 0, alertas_resueltas_automaticamente = 0,
        intervenciones_evaluadas = 0, intervenciones_con_error = 0
      where id = v_ejecucion_id;
      return;
    end if;
  end;

  update radar_ejecucion_errores set ejecucion_id = v_ejecucion_id
    where fecha_ejecucion = v_fecha and created_at = v_now and ejecucion_id is null;

  select count(*) into v_con_error
    from radar_ejecucion_errores where ejecucion_id = v_ejecucion_id and mensaje_error not like 'INTERVENCION %';
  v_procesados := v_candidatos - v_con_error;

  select count(*) into v_intervenciones_con_error
    from radar_ejecucion_errores where ejecucion_id = v_ejecucion_id and mensaje_error like 'INTERVENCION %';
  select count(*) into v_intervenciones_evaluadas
    from intervenciones where resultado_calculado_at = v_now;

  select count(*) into v_alertas_abiertas
    from radar_alertas where updated_at = v_now and estado_alerta = 'abierta';
  select count(*) into v_alertas_auto_resueltas
    from radar_alertas where updated_at = v_now and estado_alerta = 'resuelta' and motivo_resolucion = 'auto_resuelta';

  v_resultado := case
    when v_candidatos = 0 then 'exitoso'
    when v_con_error = 0 then 'exitoso'
    when v_procesados > 0 then 'parcial'
    else 'fallo_total'
  end;

  update radar_ejecuciones set
    finalizado_at = clock_timestamp(),
    resultado = v_resultado,
    pacientes_procesados = v_procesados,
    pacientes_con_error = v_con_error,
    snapshots_generados = v_procesados,
    alertas_abiertas = v_alertas_abiertas,
    alertas_resueltas_automaticamente = v_alertas_auto_resueltas,
    intervenciones_evaluadas = v_intervenciones_evaluadas,
    intervenciones_con_error = v_intervenciones_con_error
  where id = v_ejecucion_id;
end;
$$;

revoke execute on function public._radar_ejecutar_con_observabilidad(text) from public;

-- ============================================================
-- ROLLBACK Sección 81 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- [recrear _radar_ejecutar_con_observabilidad, ejecutar_radar_diario,
--  registrar_intervencion_radar tal como quedaron en las Secciones 77/80]
-- alter table radar_ejecuciones drop column if exists intervenciones_evaluadas;
-- alter table radar_ejecuciones drop column if exists intervenciones_con_error;
-- drop function if exists public.evaluar_resultado_intervencion(uuid, date);
-- drop index if exists intervenciones_pendientes_created_at_idx;
-- alter table intervenciones drop constraint if exists intervenciones_resultado_estado_check;
-- alter table intervenciones add constraint intervenciones_resultado_estado_check
--   check (resultado_estado in ('pendiente'));
-- alter table intervenciones drop column if exists confound_detalle;
-- alter table intervenciones drop column if exists rules_version_resultado;
-- alter table intervenciones drop column if exists resultado_calculado_at;
-- alter table intervenciones drop column if exists snapshot_id_despues;
-- alter table intervenciones drop column if exists confianza_despues;
-- alter table intervenciones drop column if exists risk_points_despues;
-- alter table intervenciones drop column if exists adherence_despues;
-- alter table intervenciones rename column risk_points_antes to risk_antes;
-- ============================================================

-- ============================================================
-- 82. MIGRACIÓN — corrección de incidente: proteger al último superadmin
-- ============================================================
-- Incidente real en producción (2026-09-21): un superadmin (sesión válida,
-- propia) invocó vía curl un UPDATE directo a PostgREST
-- (`patch /rest/v1/perfiles?id=eq.<uuid>` con `{"rol":"usuario"}`),
-- replicando exactamente lo que hace admin-web/app/(admin)/administradores/
-- page.tsx (handleRemoveAdmin, Sección "Administradores") pero sin pasar
-- por la UI — que ni siquiera muestra el botón "Quitar acceso" sobre una
-- fila con rol='superadmin' (page.tsx: `!isSelf && a.rol !== "superadmin"`).
-- El resultado: se auto-degradó a 'usuario', se quedó sin ningún
-- superadmin en el sistema, y quedó sin poder recuperar el acceso desde
-- la aplicación — el propio trg_proteger_columnas_sensibles_perfiles
-- (Sección 45/70) exige v_rol='superadmin' para CUALQUIER cambio futuro de
-- rol, así que sin superadmin restante no hay camino de regreso salvo
-- acceso directo a la base de datos.
--
-- Diagnóstico: esto NO fue una política de RLS rota ni un hueco de
-- permisos — el actor genuinamente TENÍA rol='superadmin' al momento de
-- la llamada, así que tanto la policy de UPDATE ("perfiles: actualizar
-- multi-tenant") como el trigger existente lo permitieron correctamente,
-- tal como están diseñados. El hueco real es que nada impide dejar el
-- sistema en un estado sin ningún superadmin — ni la UI (que además es
-- trivialmente evitable con curl, ya que el cliente hace un
-- supabase.from("perfiles").update(...) directo, sin RPC ni Edge Function
-- de por medio) ni la base de datos. Cerrar esto únicamente en el
-- frontend no serviría de nada — cualquier curl directo a PostgREST lo
-- seguiría evitando exactamente igual. Tiene que cerrarse en el trigger,
-- el único punto que ningún cliente (UI, curl, o cualquier otro) puede
-- rodear.
--
-- Se re-declara la función completa del trigger (Sección 45/70), agregando
-- un cuarto chequeo dentro del bloque de rol/nutricionista_id/
-- stripe_customer_id ya existente — los tres bloques existentes quedan
-- carácter por carácter idénticos. Se protege específicamente "el último
-- superadmin" (no "el último admin"): mientras quede al menos un
-- superadmin, ese superadmin siempre puede restaurar a cualquier otro vía
-- la propia UI — el escenario catastrófico es exclusivamente llegar a
-- CERO superadmins.
create or replace function public.proteger_columnas_sensibles_perfiles()
returns trigger
language plpgsql
as $$
declare
  v_rol      text;
  v_allowed  boolean;
begin
  -- Edge Functions con service role key: sin restricción.
  if current_user = 'service_role' then
    return new;
  end if;

  v_rol := public.get_user_rol();

  -- rol / nutricionista_id / stripe_customer_id: solo superadmin.
  if new.rol is distinct from old.rol
     or new.nutricionista_id is distinct from old.nutricionista_id
     or new.stripe_customer_id is distinct from old.stripe_customer_id
  then
    if v_rol is distinct from 'superadmin' then
      raise exception 'No tienes permiso para modificar rol, nutricionista_id o stripe_customer_id.';
    end if;

    -- Sección 82: nunca dejar el sistema sin ningún superadmin — ni
    -- siquiera un superadmin puede quitarse (o quitarle a otro) el rol si
    -- es el último que queda. Con 2+ superadmins, esto no bloquea nada.
    if old.rol = 'superadmin' and new.rol is distinct from 'superadmin' then
      if not exists (
        select 1 from perfiles where rol = 'superadmin' and id <> old.id
      ) then
        raise exception 'No puedes quitar el rol de superadmin al último superadmin del sistema — dejaría el panel de administración sin nadie que pueda recuperarlo.';
      end if;
    end if;
  end if;

  -- estatus / is_active / plan_membresia: superadmin, o el nutriólogo
  -- dueño del paciente — nunca el propio paciente sobre sí mismo.
  if new.estatus is distinct from old.estatus
     or new.is_active is distinct from old.is_active
     or new.plan_membresia is distinct from old.plan_membresia
  then
    v_allowed := coalesce(
      coalesce(v_rol = 'superadmin', false)
      or (
        auth.uid() is not null
        and old.nutricionista_id is not null
        and auth.uid() = old.nutricionista_id
        and auth.uid() <> old.id
      ),
      false
    );

    if not v_allowed then
      raise exception 'No tienes permiso para modificar estatus, is_active o plan_membresia de este perfil.';
    end if;
  end if;

  -- last_active_at: exclusivamente vía registrar_actividad() (SECURITY
  -- DEFINER, dueño "postgres") — ver Sección 70 para el diseño y las dos
  -- alternativas descartadas.
  if new.last_active_at is distinct from old.last_active_at then
    if current_user is distinct from 'postgres' then
      raise exception 'last_active_at solo se puede modificar mediante registrar_actividad().';
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================
-- ROLLBACK Sección 82 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección; revertirla reabre el incidente que la motivó, así
-- que no hay un escenario legítimo para hacerlo):
--
-- [recrear proteger_columnas_sensibles_perfiles sin el chequeo de "último
--  superadmin", tal como quedó en la Sección 70]
-- ============================================================

-- ============================================================
-- 83. MIGRACIÓN — Perfil profesional de nutriólogos (Fase A: schema, RLS,
-- vistas públicas, storage — SIN admin-web ni mobile-app todavía)
-- ============================================================
-- Objetivo: un directorio tipo "perfil profesional de salud" para que un
-- paciente pueda conocer/elegir nutriólogo (especialidades, servicios y
-- precios, experiencia, formación, consultorios, disponibilidad general),
-- editable por el propio nutriólogo o por superadmin desde admin-web (esa
-- UI es Fase B, fuera de esta migración).
--
-- Decisiones de diseño (revisadas contra el schema real antes de escribir
-- esto — ver Secciones 1-2, 6-8, 13, 23, 45/56/70/82):
--
-- 1. NO SE DUPLICA INFORMACIÓN DE `perfiles`. nombre_completo, avatar_url,
--    telefono, fecha_nacimiento y sexo siguen siendo la única fuente de
--    verdad para esos datos — nutriologo_perfiles solo agrega lo que
--    perfiles nunca tuvo. No se crea un "nombre/apellidos" separado (todo
--    el resto del proyecto ya asume nombre_completo como campo único) ni
--    una "foto profesional" distinta de avatar_url.
--
-- 2. PATRONES REUTILIZADOS, no reinventados:
--    - especialidades / nutriologo_especialidades: mismo molde que
--      suplementos (catálogo compartido, sin created_by) + recetas_guardadas
--      (junction M2M de PK compuesta), Secciones 7 y 6.
--    - Todas las tablas hijas (servicios/certificaciones/experiencia/
--      consultorios/disponibilidad): mismo molde de RLS que
--      plan_suplementacion/citas — "dueño (nutriologo_id = auth.uid()) OR
--      superadmin", Sección 51.
--    - Vistas públicas: mismo molde que nutricionistas_publicos (Sección
--      56) — `security_invoker = false, security_barrier = true`, sin
--      policy RLS directa a anon en ninguna tabla base, revoke all + grant
--      select a anon/authenticated únicamente sobre la vista. `
--      nutricionistas_publicos` NO se toca — sigue usándose tal cual en
--      mobile-app/src/app/(auth)/register.tsx.
--    - Columnas protegidas (verificado/destacado/orden_directorio): mismo
--      idioma exacto que proteger_columnas_sensibles_perfiles (Sección 82)
--      — "if v_rol is distinct from 'superadmin' then raise exception".
--
-- 3. SUPERFICIE PÚBLICA MÍNIMA (decisión explícita, revisada campo por
--    campo): las vistas públicas NUNCA exponen correo_profesional ni
--    telefono_profesional (quedan solo en la tabla base, editables desde
--    admin-web, sin bandera de "publicar" todavía), ni el documento
--    original de una certificación (solo nombre/institución/año/
--    descripción), ni ninguna columna de perfiles fuera de
--    nombre_completo/avatar_url. Cero datos de rol/estatus/permisos.
--
-- 4. CERTIFICACIONES — BUCKET PRIVADO (a diferencia de los 4 buckets
--    existentes, todos public=true): el documento original de una
--    certificación es un dato sensible/verificable, no un asset de
--    marketing — solo el nutriólogo dueño o superadmin pueden leerlo
--    (política de storage acotada por prefijo de carpeta, nunca pública).
--    admin-web (Fase B) deberá usar createSignedUrl en vez de
--    getPublicUrl — primer bucket privado de este proyecto, documentado
--    aquí explícitamente porque es un patrón nuevo.
--
-- 5. idiomas (nutriologo_perfiles) e incluye (nutriologo_servicios) son
--    text[] simples, no tablas catálogo — son listas sin metadata propia
--    por ítem ni necesidad de filtrado/agregación cruzada como sí la
--    tiene especialidades (que el producto pidió explícitamente poder
--    filtrar) — desproporcionado normalizar esto en una tabla relacional.
--
-- 6. NUNCA DATOS FICTICIOS DE REVIEWS — no se agrega ninguna columna de
--    calificación/conteo de opiniones en esta migración porque no existe
--    todavía ningún módulo de reviews real. La UI (Fase C) deberá ocultar
--    por completo esa sección cuando no haya datos, nunca mostrar "0.0" ni
--    "(0 opiniones)" — no hay nada que preparar a nivel de schema para
--    esto todavía; se documenta aquí solo para que quede explícito que la
--    ausencia de esas columnas es deliberada, no un olvido.
--
-- 7. `patient_nutritionists` — SOLO PREPARACIÓN, con estrategia de
--    transición documentada (no ejecutada en esta migración):
--    perfiles.nutricionista_id sigue siendo HOY la única fuente funcional
--    real — ningún flujo existente (registro, invitar-usuario) se toca.
--    Esta tabla nace con un backfill de una sola vez (una fila 'activo'
--    por cada paciente con nutricionista_id actual) para no nacer vacía y
--    servir de historial desde ya. Cuando en el futuro se implemente
--    selección/cambio de nutriólogo, esa función deberá escribir en AMBAS
--    estructuras en la misma transacción (cerrar la fila activo anterior,
--    insertar la nueva, y solo entonces actualizar
--    perfiles.nutricionista_id) — nunca deben quedar desincronizadas. La
--    migración que retire la dependencia funcional de la columna es
--    trabajo futuro explícitamente fuera de este alcance.
--
-- 8. VALIDACIONES REALES EN POSTGRES, no solo en frontend: año de egreso
--    no futuro, años de experiencia >= 0, precio >= 0, duración > 0, URLs
--    de redes con esquema http(s)://, latitud/longitud dentro de rango,
--    fecha_fin >= fecha_inicio en experiencia, hora_inicio < hora_fin en
--    disponibilidad — constraints reales, no confiadas al cliente.

-- ── 83.1 — Catálogo de especialidades (molde: suplementos, Sección 7) ──
create table especialidades (
  id         uuid        default uuid_generate_v4() primary key,
  nombre     text        not null unique,
  created_at timestamptz not null default now()
);

insert into especialidades (nombre) values
  ('Nutrición clínica'),
  ('Nutrición deportiva'),
  ('Pérdida de peso'),
  ('Ganancia de masa muscular'),
  ('Recomposición corporal'),
  ('Diabetes'),
  ('Hipertensión'),
  ('Nutrición vegetariana / vegana'),
  ('Nutrición infantil'),
  ('Nutrición durante embarazo'),
  ('Trastornos metabólicos'),
  ('Educación nutricional')
on conflict (nombre) do nothing;

alter table especialidades enable row level security;

create policy "especialidades_select" on especialidades
for select to authenticated using (true);

create policy "especialidades_insert" on especialidades
for insert to authenticated with check (public.get_user_rol() in ('admin', 'superadmin'));

create policy "especialidades_update" on especialidades
for update to authenticated using (public.get_user_rol() in ('admin', 'superadmin'))
with check (public.get_user_rol() in ('admin', 'superadmin'));

create policy "especialidades_delete" on especialidades
for delete to authenticated using (public.get_user_rol() in ('admin', 'superadmin'));

-- ── 83.2 — nutriologo_perfiles (1:1 con perfiles) — decisiones 1, 5, 8 ──
create table nutriologo_perfiles (
  perfil_id                  uuid        primary key references perfiles(id) on delete cascade,

  -- Información profesional (perfiles ya cubre nombre/avatar/telefono/
  -- fecha_nacimiento/sexo — decisión 1, no se repiten aquí).
  titulo_profesional         text,
  foto_portada_url           text,
  foto_portada_storage_path  text,
  telefono_profesional       text,
  correo_profesional         text,
  cedula_profesional         text,
  universidad                text,
  anio_egreso                int,
  anos_experiencia           int,
  descripcion_corta          text,
  biografia                  text,
  idiomas                    text[]      not null default '{}',

  -- Redes y contacto
  instagram_url              text,
  facebook_url               text,
  tiktok_url                 text,
  sitio_web_url              text,

  -- Modalidad y estado del profesional
  modalidad                  text        check (modalidad in ('presencial', 'online', 'ambas')),
  perfil_visible             boolean     not null default false,
  aceptando_pacientes        boolean     not null default true,
  -- Columnas protegidas — solo superadmin puede modificarlas (ver 83.9).
  verificado                 boolean     not null default false,
  destacado                  boolean     not null default false,
  orden_directorio           int,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  check (anio_egreso is null or anio_egreso <= extract(year from now())::int),
  check (anos_experiencia is null or anos_experiencia >= 0),
  check (instagram_url is null or instagram_url ~* '^https?://'),
  check (facebook_url is null or facebook_url ~* '^https?://'),
  check (tiktok_url is null or tiktok_url ~* '^https?://'),
  check (sitio_web_url is null or sitio_web_url ~* '^https?://')
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_nutriologo_perfiles_updated_at
  before update on nutriologo_perfiles
  for each row
  execute function public.set_updated_at();

alter table nutriologo_perfiles enable row level security;

create policy "nutriologo_perfiles_select" on nutriologo_perfiles
for select to authenticated using (
  perfil_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_perfiles_insert" on nutriologo_perfiles
for insert to authenticated with check (
  perfil_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_perfiles_update" on nutriologo_perfiles
for update to authenticated using (
  perfil_id = auth.uid() or public.get_user_rol() = 'superadmin'
)
with check (
  perfil_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_perfiles_delete" on nutriologo_perfiles
for delete to authenticated using (public.get_user_rol() = 'superadmin');

-- Columnas protegidas — mismo idioma exacto que
-- proteger_columnas_sensibles_perfiles (Sección 82, decisión 2/3 de arriba).
create or replace function public.proteger_columnas_nutriologo_perfiles()
returns trigger
language plpgsql
as $$
declare
  v_rol text;
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if new.verificado is distinct from old.verificado
     or new.destacado is distinct from old.destacado
     or new.orden_directorio is distinct from old.orden_directorio
  then
    v_rol := public.get_user_rol();
    if v_rol is distinct from 'superadmin' then
      raise exception 'No tienes permiso para modificar verificado, destacado u orden_directorio.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_proteger_columnas_nutriologo_perfiles
  before update on nutriologo_perfiles
  for each row
  execute function public.proteger_columnas_nutriologo_perfiles();

-- ── 83.3 — nutriologo_especialidades (junction, molde: recetas_guardadas) ──
create table nutriologo_especialidades (
  nutriologo_id   uuid references perfiles(id) on delete cascade not null,
  especialidad_id uuid references especialidades(id) on delete cascade not null,
  created_at      timestamptz not null default now(),
  primary key (nutriologo_id, especialidad_id)
);

alter table nutriologo_especialidades enable row level security;

create policy "nutriologo_especialidades_select" on nutriologo_especialidades
for select to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_especialidades_insert" on nutriologo_especialidades
for insert to authenticated with check (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_especialidades_delete" on nutriologo_especialidades
for delete to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

-- ── 83.4 — nutriologo_servicios — decisión 5 (incluye text[]), 8 (checks) ──
create table nutriologo_servicios (
  id           uuid        default uuid_generate_v4() primary key,
  nutriologo_id uuid       references perfiles(id) on delete cascade not null,
  nombre       text        not null,
  descripcion  text,
  precio       numeric(10,2) not null check (precio >= 0),
  moneda       text        not null default 'MXN',
  duracion_min int         check (duracion_min is null or duracion_min > 0),
  modalidad    text        not null check (modalidad in ('online', 'presencial', 'ambas')),
  incluye      text[]      not null default '{}',
  activo       boolean     not null default true,
  orden        int         not null default 0,
  created_at   timestamptz not null default now()
);

create index on nutriologo_servicios (nutriologo_id);

alter table nutriologo_servicios enable row level security;

create policy "nutriologo_servicios_select" on nutriologo_servicios
for select to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_servicios_insert" on nutriologo_servicios
for insert to authenticated with check (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_servicios_update" on nutriologo_servicios
for update to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
)
with check (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_servicios_delete" on nutriologo_servicios
for delete to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

-- ── 83.5 — nutriologo_certificaciones — decisión 4 (documento privado) ──
create table nutriologo_certificaciones (
  id                      uuid        default uuid_generate_v4() primary key,
  nutriologo_id           uuid        references perfiles(id) on delete cascade not null,
  nombre                  text        not null,
  institucion             text        not null,
  anio                    int,
  descripcion             text,
  documento_url           text,
  documento_storage_path  text,
  orden                   int         not null default 0,
  created_at              timestamptz not null default now(),

  check (anio is null or anio <= extract(year from now())::int)
);

create index on nutriologo_certificaciones (nutriologo_id);

alter table nutriologo_certificaciones enable row level security;

create policy "nutriologo_certificaciones_select" on nutriologo_certificaciones
for select to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_certificaciones_insert" on nutriologo_certificaciones
for insert to authenticated with check (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_certificaciones_update" on nutriologo_certificaciones
for update to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
)
with check (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_certificaciones_delete" on nutriologo_certificaciones
for delete to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

-- ── 83.6 — nutriologo_experiencia — decisión 8 (fechas coherentes) ──
create table nutriologo_experiencia (
  id            uuid        default uuid_generate_v4() primary key,
  nutriologo_id uuid        references perfiles(id) on delete cascade not null,
  puesto        text        not null,
  institucion   text        not null,
  fecha_inicio  date,
  fecha_fin     date,
  actualidad    boolean     not null default false,
  descripcion   text,
  orden         int         not null default 0,
  created_at    timestamptz not null default now(),

  check (not actualidad or fecha_fin is null),
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);

create index on nutriologo_experiencia (nutriologo_id);

alter table nutriologo_experiencia enable row level security;

create policy "nutriologo_experiencia_select" on nutriologo_experiencia
for select to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_experiencia_insert" on nutriologo_experiencia
for insert to authenticated with check (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_experiencia_update" on nutriologo_experiencia
for update to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
)
with check (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_experiencia_delete" on nutriologo_experiencia
for delete to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

-- ── 83.7 — nutriologo_consultorios — decisión 8 (lat/long), preparada ──
-- para múltiples ubicaciones desde el día uno (ya es una relación 1:N).
create table nutriologo_consultorios (
  id                      uuid        default uuid_generate_v4() primary key,
  nutriologo_id           uuid        references perfiles(id) on delete cascade not null,
  nombre                  text,
  direccion               text,
  colonia                 text,
  alcaldia_municipio      text,
  ciudad                  text,
  estado                  text,
  codigo_postal           text,
  latitud                 numeric(9,6),
  longitud                numeric(9,6),
  instrucciones_adicionales text,
  orden                   int         not null default 0,
  created_at              timestamptz not null default now(),

  check (latitud is null or latitud between -90 and 90),
  check (longitud is null or longitud between -180 and 180)
);

create index on nutriologo_consultorios (nutriologo_id);

alter table nutriologo_consultorios enable row level security;

create policy "nutriologo_consultorios_select" on nutriologo_consultorios
for select to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_consultorios_insert" on nutriologo_consultorios
for insert to authenticated with check (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_consultorios_update" on nutriologo_consultorios
for update to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
)
with check (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_consultorios_delete" on nutriologo_consultorios
for delete to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

-- ── 83.8 — nutriologo_disponibilidad — disponibilidad general (no agenda ──
-- real todavía; preparada para eso: 1 fila por día de la semana ISO).
create table nutriologo_disponibilidad (
  id            uuid        default uuid_generate_v4() primary key,
  nutriologo_id uuid        references perfiles(id) on delete cascade not null,
  dia_semana    int         not null check (dia_semana between 1 and 7), -- ISO: 1=lunes .. 7=domingo
  disponible    boolean     not null default true,
  hora_inicio   time,
  hora_fin      time,
  created_at    timestamptz not null default now(),

  unique (nutriologo_id, dia_semana),
  check (disponible = false or (hora_inicio is not null and hora_fin is not null and hora_inicio < hora_fin))
);

alter table nutriologo_disponibilidad enable row level security;

create policy "nutriologo_disponibilidad_select" on nutriologo_disponibilidad
for select to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_disponibilidad_insert" on nutriologo_disponibilidad
for insert to authenticated with check (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_disponibilidad_update" on nutriologo_disponibilidad
for update to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
)
with check (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

create policy "nutriologo_disponibilidad_delete" on nutriologo_disponibilidad
for delete to authenticated using (
  nutriologo_id = auth.uid() or public.get_user_rol() = 'superadmin'
);

-- ── 83.9 — patient_nutritionists — decisión 7: SOLO preparación + backfill.
-- perfiles.nutricionista_id sigue siendo la fuente funcional real; ningún
-- flujo existente se modifica en esta migración.
create table patient_nutritionists (
  id               uuid        default uuid_generate_v4() primary key,
  paciente_id      uuid        references auth.users(id) on delete cascade not null,
  nutriologo_id    uuid        references auth.users(id) on delete set null,
  fecha_asignacion timestamptz not null default now(),
  fecha_fin        timestamptz,
  estado           text        not null default 'activo' check (estado in ('activo', 'finalizado')),
  asignado_por     uuid        references auth.users(id) on delete set null,
  motivo           text,
  created_at       timestamptz not null default now()
);

create index on patient_nutritionists (paciente_id);
create index on patient_nutritionists (nutriologo_id);
-- Como máximo una asignación ACTIVA por paciente — mismo mecanismo que ya
-- usa radar_alertas_una_abierta_por_regla (Sección 73) para "una sola
-- alerta abierta por problema".
create unique index patient_nutritionists_un_activo
  on patient_nutritionists (paciente_id)
  where estado = 'activo';

-- Backfill de una sola vez: una fila 'activo' por cada paciente que hoy
-- ya tiene nutricionista_id — para que la tabla nazca con el historial
-- actual en vez de vacía. asignado_por queda NULL (no sabemos quién hizo
-- la asignación original histórica).
insert into patient_nutritionists (paciente_id, nutriologo_id, fecha_asignacion, estado)
select id, nutricionista_id, created_at, 'activo'
from perfiles
where nutricionista_id is not null and rol = 'usuario';

alter table patient_nutritionists enable row level security;

-- Mismo patrón de lectura que perfiles/score_snapshots/radar_alertas:
-- el propio paciente, su nutriólogo (actual, vía perfiles.nutricionista_id
-- — no un self-join circular sobre esta misma tabla), o superadmin.
create policy "patient_nutritionists_select" on patient_nutritionists
for select to authenticated using (
  auth.uid() = paciente_id
  or exists (select 1 from perfiles where id = patient_nutritionists.paciente_id and nutricionista_id = auth.uid())
  or public.get_user_rol() = 'superadmin'
);

-- Sin policies de INSERT/UPDATE/DELETE para authenticated/anon todavía —
-- esta tabla es de solo lectura desde el cliente en esta fase (decisión
-- 7: nadie escribe aquí hasta que se implemente selección/cambio de
-- nutriólogo). El backfill de arriba corrió como postgres, evade RLS.

-- ── 83.10 — Storage: portada (bucket avatars existente) ──────────────
-- Mismo patrón ya usado para avatars/suplementos/ (Sección 64) — una
-- subcarpeta dedicada dentro del bucket existente, no un bucket nuevo.
create policy "avatars: gestion portada propia" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and name like ('portadas/' || auth.uid()::text || '.%'))
  with check (bucket_id = 'avatars' and name like ('portadas/' || auth.uid()::text || '.%'));

-- ── 83.11 — Storage: certificaciones-nutriologos (bucket NUEVO, PRIVADO) ──
-- Decisión 4: a diferencia de los 4 buckets existentes (todos
-- public=true), este es privado — el documento original de una
-- certificación solo lo puede leer su dueño o superadmin, nunca
-- públicamente. admin-web (Fase B) debe usar createSignedUrl, no
-- getPublicUrl.
insert into storage.buckets (id, name, public)
values ('certificaciones-nutriologos', 'certificaciones-nutriologos', false)
on conflict (id) do nothing;

create policy "certificaciones: lectura propia o superadmin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'certificaciones-nutriologos'
    and (name like (auth.uid()::text || '/%') or public.get_user_rol() = 'superadmin')
  );

create policy "certificaciones: gestion propia o superadmin" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'certificaciones-nutriologos'
    and (name like (auth.uid()::text || '/%') or public.get_user_rol() = 'superadmin')
  )
  with check (
    bucket_id = 'certificaciones-nutriologos'
    and (name like (auth.uid()::text || '/%') or public.get_user_rol() = 'superadmin')
  );

-- ── 83.12 — Vistas públicas — decisión 3: superficie mínima, mismo molde ──
-- que nutricionistas_publicos (Sección 56). Ninguna tabla base de arriba
-- otorga SELECT a anon — el acceso público pasa únicamente por aquí.
create view public.nutriologos_directorio_publico
with (security_invoker = false, security_barrier = true)
as
select
  p.id,
  p.nombre_completo,
  p.avatar_url,
  np.titulo_profesional,
  np.foto_portada_url,
  np.cedula_profesional,
  np.universidad,
  np.anos_experiencia,
  np.descripcion_corta,
  np.biografia,
  np.idiomas,
  np.modalidad,
  np.aceptando_pacientes,
  np.verificado,
  np.destacado,
  np.orden_directorio,
  np.instagram_url,
  np.facebook_url,
  np.tiktok_url,
  np.sitio_web_url,
  (
    select array_agg(e.nombre order by e.nombre)
    from nutriologo_especialidades ne
    join especialidades e on e.id = ne.especialidad_id
    where ne.nutriologo_id = p.id
  ) as especialidades,
  (
    select min(s.precio) from nutriologo_servicios s
    where s.nutriologo_id = p.id and s.activo
  ) as precio_desde
from perfiles p
join nutriologo_perfiles np on np.perfil_id = p.id
where p.rol in ('admin', 'superadmin') and p.is_active = true and np.perfil_visible = true;

revoke all on public.nutriologos_directorio_publico from public, anon, authenticated;
grant select on public.nutriologos_directorio_publico to anon, authenticated;

create view public.nutriologo_especialidades_publico
with (security_invoker = false, security_barrier = true)
as
select ne.nutriologo_id, e.id as especialidad_id, e.nombre
from nutriologo_especialidades ne
join especialidades e on e.id = ne.especialidad_id
join perfiles p on p.id = ne.nutriologo_id
join nutriologo_perfiles np on np.perfil_id = ne.nutriologo_id
where p.is_active = true and np.perfil_visible = true;

revoke all on public.nutriologo_especialidades_publico from public, anon, authenticated;
grant select on public.nutriologo_especialidades_publico to anon, authenticated;

create view public.nutriologo_servicios_publico
with (security_invoker = false, security_barrier = true)
as
select s.id, s.nutriologo_id, s.nombre, s.descripcion, s.precio, s.moneda,
       s.duracion_min, s.modalidad, s.incluye, s.orden
from nutriologo_servicios s
join perfiles p on p.id = s.nutriologo_id
join nutriologo_perfiles np on np.perfil_id = s.nutriologo_id
where s.activo and p.is_active = true and np.perfil_visible = true;

revoke all on public.nutriologo_servicios_publico from public, anon, authenticated;
grant select on public.nutriologo_servicios_publico to anon, authenticated;

create view public.nutriologo_experiencia_publico
with (security_invoker = false, security_barrier = true)
as
select x.id, x.nutriologo_id, x.puesto, x.institucion, x.fecha_inicio,
       x.fecha_fin, x.actualidad, x.descripcion, x.orden
from nutriologo_experiencia x
join perfiles p on p.id = x.nutriologo_id
join nutriologo_perfiles np on np.perfil_id = x.nutriologo_id
where p.is_active = true and np.perfil_visible = true;

revoke all on public.nutriologo_experiencia_publico from public, anon, authenticated;
grant select on public.nutriologo_experiencia_publico to anon, authenticated;

create view public.nutriologo_consultorios_publico
with (security_invoker = false, security_barrier = true)
as
select c.id, c.nutriologo_id, c.nombre, c.direccion, c.colonia,
       c.alcaldia_municipio, c.ciudad, c.estado, c.codigo_postal,
       c.latitud, c.longitud, c.instrucciones_adicionales, c.orden
from nutriologo_consultorios c
join perfiles p on p.id = c.nutriologo_id
join nutriologo_perfiles np on np.perfil_id = c.nutriologo_id
where p.is_active = true and np.perfil_visible = true;

revoke all on public.nutriologo_consultorios_publico from public, anon, authenticated;
grant select on public.nutriologo_consultorios_publico to anon, authenticated;

create view public.nutriologo_disponibilidad_publico
with (security_invoker = false, security_barrier = true)
as
select d.id, d.nutriologo_id, d.dia_semana, d.disponible, d.hora_inicio, d.hora_fin
from nutriologo_disponibilidad d
join perfiles p on p.id = d.nutriologo_id
join nutriologo_perfiles np on np.perfil_id = d.nutriologo_id
where p.is_active = true and np.perfil_visible = true;

revoke all on public.nutriologo_disponibilidad_publico from public, anon, authenticated;
grant select on public.nutriologo_disponibilidad_publico to anon, authenticated;

-- Decisión 4/3: SOLO nombre/institución/año/descripción — jamás
-- documento_url ni documento_storage_path.
create view public.nutriologo_certificaciones_publico
with (security_invoker = false, security_barrier = true)
as
select cert.id, cert.nutriologo_id, cert.nombre, cert.institucion, cert.anio,
       cert.descripcion, cert.orden
from nutriologo_certificaciones cert
join perfiles p on p.id = cert.nutriologo_id
join nutriologo_perfiles np on np.perfil_id = cert.nutriologo_id
where p.is_active = true and np.perfil_visible = true;

revoke all on public.nutriologo_certificaciones_publico from public, anon, authenticated;
grant select on public.nutriologo_certificaciones_publico to anon, authenticated;

-- ============================================================
-- ROLLBACK Sección 83 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop view if exists public.nutriologo_certificaciones_publico;
-- drop view if exists public.nutriologo_disponibilidad_publico;
-- drop view if exists public.nutriologo_consultorios_publico;
-- drop view if exists public.nutriologo_experiencia_publico;
-- drop view if exists public.nutriologo_servicios_publico;
-- drop view if exists public.nutriologo_especialidades_publico;
-- drop view if exists public.nutriologos_directorio_publico;
-- drop policy if exists "certificaciones: gestion propia o superadmin" on storage.objects;
-- drop policy if exists "certificaciones: lectura propia o superadmin" on storage.objects;
-- delete from storage.buckets where id = 'certificaciones-nutriologos';
-- drop policy if exists "avatars: gestion portada propia" on storage.objects;
-- drop table if exists patient_nutritionists;
-- drop table if exists nutriologo_disponibilidad;
-- drop table if exists nutriologo_consultorios;
-- drop table if exists nutriologo_experiencia;
-- drop table if exists nutriologo_certificaciones;
-- drop table if exists nutriologo_servicios;
-- drop table if exists nutriologo_especialidades;
-- drop trigger if exists trg_proteger_columnas_nutriologo_perfiles on nutriologo_perfiles;
-- drop function if exists public.proteger_columnas_nutriologo_perfiles();
-- drop trigger if exists trg_nutriologo_perfiles_updated_at on nutriologo_perfiles;
-- drop function if exists public.set_updated_at();
-- drop table if exists nutriologo_perfiles;
-- drop table if exists especialidades;
-- ============================================================

-- ============================================================
-- 84. MIGRACIÓN — corrección: superadmin debe poder gestionar la portada
-- profesional de OTROS nutriólogos (hallazgo durante Fase B admin-web)
-- ============================================================
-- La policy de Storage para la portada (83.10) solo permitía que el path
-- coincidiera con auth.uid() del actor, sin excepción para superadmin — a
-- diferencia de las policies de certificaciones-nutriologos (83.11), que sí
-- la incluyen. Esto bloqueaba a superadmin al intentar subir/reemplazar la
-- portada de otro nutriólogo desde admin-web, aunque sí podía editar la
-- fila en nutriologo_perfiles (esa tabla sí contempla superadmin). Se
-- corrige unificando el mismo patrón ya usado en certificaciones.
drop policy if exists "avatars: gestion portada propia" on storage.objects;

create policy "avatars: gestion portada propia" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'avatars' and (
      name like ('portadas/' || auth.uid()::text || '.%')
      or public.get_user_rol() = 'superadmin'
    )
  )
  with check (
    bucket_id = 'avatars' and (
      name like ('portadas/' || auth.uid()::text || '.%')
      or public.get_user_rol() = 'superadmin'
    )
  );

-- ============================================================
-- ROLLBACK Sección 84 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección; restaura la policy original de 83.10):
--
-- drop policy if exists "avatars: gestion portada propia" on storage.objects;
-- create policy "avatars: gestion portada propia" on storage.objects
--   for all to authenticated
--   using (bucket_id = 'avatars' and name like ('portadas/' || auth.uid()::text || '.%'))
--   with check (bucket_id = 'avatars' and name like ('portadas/' || auth.uid()::text || '.%'));
-- ============================================================

-- ============================================================
-- 85. MIGRACIÓN — columna objetivo en perfiles (registro sin nutriólogo)
-- ============================================================
-- Único campo nuevo necesario: no existe ningún lugar hoy para guardar el
-- objetivo de un paciente que se registra sin nutriólogo (planes_nutricionales
-- la gestiona el nutriólogo y no aplica a este flujo). telefono/fecha_nacimiento
-- ya existían y simplemente se reutilizan.
alter table perfiles add column if not exists objetivo text;

-- ============================================================
-- ROLLBACK Sección 85 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- alter table perfiles drop column if exists objetivo;
-- ============================================================

-- ============================================================
-- 86. MIGRACIÓN — crear_perfil_nuevo_usuario(): registro sin nutriólogo
-- ============================================================
-- Nueva rama ADITIVA controlada por raw_user_meta_data->>'sin_nutricionista'.
-- Si viene true: nutricionista_id queda NULL, is_active=true, estatus=
-- 'aprobado' (auto-aprobado, igual que pacientes creados desde admin-web en
-- la Sección 44 — no hay nutriólogo que los apruebe). Si viene false/ausente
-- (TODO registro actual y futuro que selecciona nutriólogo): exactamente la
-- misma lógica de siempre (fallback por email, is_active=false,
-- estatus='pendiente') — comportamiento 100% sin cambios para ese flujo.
-- También se guardan telefono/fecha_nacimiento/objetivo si vienen en
-- metadata (antes nunca venían, así que para el flujo actual quedan NULL
-- igual que hasta ahora).
create or replace function crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer as $$
declare
  v_nutricionista_id uuid;
  v_sin_nutricionista boolean;
  v_is_active boolean;
  v_estatus text;
begin
  v_sin_nutricionista := coalesce((new.raw_user_meta_data->>'sin_nutricionista')::boolean, false);

  if v_sin_nutricionista then
    v_nutricionista_id := null;
    v_is_active := true;
    v_estatus := 'aprobado';
  else
    v_nutricionista_id := (new.raw_user_meta_data->>'nutricionista_id')::uuid;
    if v_nutricionista_id is null then
      select id into v_nutricionista_id
      from auth.users
      where email = 'j.rym5312@gmail.com'
      limit 1;
    end if;
    v_is_active := false;
    v_estatus := 'pendiente';
  end if;

  insert into public.perfiles (
    id, nombre_completo, email, telefono, fecha_nacimiento, objetivo,
    nutricionista_id, is_active, estatus
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    new.raw_user_meta_data->>'telefono',
    (new.raw_user_meta_data->>'fecha_nacimiento')::date,
    new.raw_user_meta_data->>'objetivo',
    v_nutricionista_id,
    v_is_active,
    v_estatus
  );
  return new;
end;
$$;

-- ============================================================
-- ROLLBACK Sección 86 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección; restaura la versión anterior, sin rama
-- sin_nutricionista ni columnas telefono/fecha_nacimiento/objetivo en el insert):
--
-- create or replace function crear_perfil_nuevo_usuario()
-- returns trigger language plpgsql security definer as $$
-- declare
--   v_nutricionista_id uuid;
-- begin
--   v_nutricionista_id := (new.raw_user_meta_data->>'nutricionista_id')::uuid;
--   if v_nutricionista_id is null then
--     select id into v_nutricionista_id from auth.users where email = 'j.rym5312@gmail.com' limit 1;
--   end if;
--   insert into public.perfiles (id, nombre_completo, email, nutricionista_id, is_active, estatus)
--   values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, v_nutricionista_id, false, 'pendiente');
--   return new;
-- end;
-- $$;
-- ============================================================

-- ============================================================
-- 87. MIGRACIÓN — tabla ejercicios_personalizados (aislada, RLS dueño-only)
-- ============================================================
-- Ejercicios que cada paciente crea para sí mismo, disponibles para TODOS
-- los pacientes (con y sin nutriólogo). Deliberadamente NO vive dentro de
-- rutinas/rutina_dias/rutina_ejercicios/ejercicios (esas tablas y su RLS
-- son exclusivas del nutriólogo) — es una tabla y un set de políticas 100%
-- nuevas e independientes, dueño-only por user_id = auth.uid(), sin
-- relación con nutricionista_id ni con get_user_rol(). "Marcar como usado"
-- se resuelve con la columna ultima_vez_usado en vez de una tabla de logs
-- separada (mínimo viable, menor blast radius).
create table if not exists ejercicios_personalizados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  grupo_muscular text,
  series integer,
  repeticiones text,
  peso_sugerido_kg numeric,
  unidad_peso text not null default 'kg',
  descanso_seg integer,
  notas text,
  ultima_vez_usado timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ejercicios_personalizados_user_id
  on ejercicios_personalizados(user_id);

drop trigger if exists trg_ejercicios_personalizados_updated_at on ejercicios_personalizados;
create trigger trg_ejercicios_personalizados_updated_at
  before update on ejercicios_personalizados
  for each row execute function public.set_updated_at();

alter table ejercicios_personalizados enable row level security;

drop policy if exists "ejercicios_personalizados_select" on ejercicios_personalizados;
drop policy if exists "ejercicios_personalizados_insert" on ejercicios_personalizados;
drop policy if exists "ejercicios_personalizados_update" on ejercicios_personalizados;
drop policy if exists "ejercicios_personalizados_delete" on ejercicios_personalizados;

create policy "ejercicios_personalizados_select" on ejercicios_personalizados
for select to authenticated using (user_id = auth.uid());

create policy "ejercicios_personalizados_insert" on ejercicios_personalizados
for insert to authenticated with check (user_id = auth.uid());

create policy "ejercicios_personalizados_update" on ejercicios_personalizados
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ejercicios_personalizados_delete" on ejercicios_personalizados
for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- ROLLBACK Sección 87 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop table if exists ejercicios_personalizados;
-- ============================================================

-- ============================================================
-- 88. MIGRACIÓN — perfiles.plan_membresia admite el plan "pro"
-- ============================================================
-- Bug bloqueante encontrado en la auditoría final de Stripe: el plan "pro"
-- ya tiene su price_id (mobile-app/src/constants/planes.ts) y su propio
-- mapeo en supabase/functions/stripe-webhook/index.ts, pero el CHECK
-- constraint original (Sección 1) solo permitía 'basico'/'premium'.
-- Cualquier pago del plan "pro" hacía que el webhook fallara con un 500 en
-- bucle de reintentos de Stripe (nunca lograba sincronizar plan_membresia).
alter table perfiles drop constraint if exists perfiles_plan_membresia_check;

alter table perfiles add constraint perfiles_plan_membresia_check
  check (plan_membresia in ('basico', 'pro', 'premium'));

-- ============================================================
-- ROLLBACK Sección 88 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección; volvería a romper el plan "pro"):
--
-- alter table perfiles drop constraint if exists perfiles_plan_membresia_check;
-- alter table perfiles add constraint perfiles_plan_membresia_check
--   check (plan_membresia in ('basico', 'premium'));
-- ============================================================

-- ============================================================
-- 89. MIGRACIÓN — idempotencia de stripe-webhook (stripe_webhook_events)
-- ============================================================
-- Defensa en profundidad pedida explícitamente en la auditoría de Stripe:
-- Stripe puede reenviar el mismo webhook más de una vez (timeout, reintento
-- manual, etc.). El código actual ya es naturalmente idempotente (upsert
-- por stripe_subscription_id, update sin efectos acumulativos), pero esta
-- tabla deja la protección explícita por event.id en vez de depender solo
-- de esa idempotencia incidental. Mismo patrón deny-by-default que
-- "suscripciones" (Sección 62 de supabase_stripe_schema.sql): RLS enabled,
-- cero policies, grants revocados — solo accesible por service_role desde
-- stripe-webhook.
create table if not exists stripe_webhook_events (
  event_id   text primary key,
  event_type text not null,
  created_at timestamptz not null default now()
);

alter table stripe_webhook_events enable row level security;
revoke all on stripe_webhook_events from anon, authenticated;

-- ============================================================
-- ROLLBACK Sección 89 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop table if exists stripe_webhook_events;
-- ============================================================

-- ============================================================
-- 90. MIGRACIÓN — soporte multi-proveedor en suscripciones (RevenueCat)
-- ============================================================
-- Decisión de negocio: el checkout de suscripción DENTRO de la app móvil
-- migra de Stripe Checkout a compra nativa (StoreKit/Google Play Billing
-- vía RevenueCat) — exigido por la Guideline 3.1.1 de Apple y la política
-- de pagos de Google Play para contenido digital desbloqueado dentro de
-- la app. Stripe se queda para cobros que no pasen por el checkout de la
-- app móvil (issue #34).
--
-- "suscripciones" se define en supabase_stripe_schema.sql, pero esta
-- sección vive aquí (no ahí) porque todo cambio de esquema nuevo se
-- agrega al final de supabase_schema.sql, sin excepción por tema.
--
-- stripe_subscription_id/stripe_price_id eran NOT NULL porque solo
-- existían filas de Stripe. Las filas nuevas de RevenueCat no los tienen
-- — mismo patrón ya usado para stripe_customer_id (Sección 57 de
-- supabase_stripe_schema.sql): UNIQUE sobre una columna nullable sigue
-- bloqueando duplicados reales sin impedir múltiples NULL.
alter table public.suscripciones alter column stripe_subscription_id drop not null;
alter table public.suscripciones alter column stripe_price_id drop not null;

alter table public.suscripciones
  add column if not exists provider text not null default 'stripe'
    check (provider in ('stripe', 'revenuecat'));

-- Identificador estable de la suscripción en el store (originalTransactionId
-- de RevenueCat) — el equivalente de stripe_subscription_id para este
-- proveedor.
alter table public.suscripciones
  add column if not exists revenuecat_subscription_id text;

create unique index if not exists suscripciones_revenuecat_subscription_id_key
  on public.suscripciones (revenuecat_subscription_id)
  where provider = 'revenuecat';

-- plan_key guarda el plan ya resuelto para filas de RevenueCat (su
-- entitlement se define 1:1 con 'pro'/'premium', sin necesitar una tabla
-- de mapeo como PRICE_ID_TO_PLAN de Stripe).
alter table public.suscripciones
  add column if not exists plan_key text check (plan_key in ('pro', 'premium'));

alter table public.suscripciones drop constraint if exists suscripciones_provider_fields_check;
alter table public.suscripciones add constraint suscripciones_provider_fields_check
  check (
    (provider = 'stripe' and stripe_subscription_id is not null)
    or
    (provider = 'revenuecat' and revenuecat_subscription_id is not null and plan_key is not null)
  );

-- No se toca el RLS de "suscripciones" (habilitado, cero policies, grants
-- revocados — Sección 62 de supabase_stripe_schema.sql): ya cubre las
-- columnas nuevas sin trabajo adicional, mismo acceso exclusivo por
-- service_role.

-- ============================================================
-- ROLLBACK Sección 90 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección; volvería a dejar "suscripciones" solo-Stripe):
--
-- alter table public.suscripciones drop constraint if exists suscripciones_provider_fields_check;
-- drop index if exists suscripciones_revenuecat_subscription_id_key;
-- alter table public.suscripciones drop column if exists plan_key;
-- alter table public.suscripciones drop column if exists revenuecat_subscription_id;
-- alter table public.suscripciones drop column if exists provider;
-- alter table public.suscripciones alter column stripe_price_id set not null;
-- alter table public.suscripciones alter column stripe_subscription_id set not null;
-- ============================================================

-- ============================================================
-- 91. MIGRACIÓN — idempotencia de revenuecat-webhook
-- ============================================================
-- Mismo patrón que stripe_webhook_events (Sección 89): RevenueCat puede
-- reenviar el mismo webhook más de una vez. RLS deny-by-default, cero
-- policies, solo accesible por service_role desde revenuecat-webhook.
create table if not exists revenuecat_webhook_events (
  event_id   text primary key,
  event_type text not null,
  created_at timestamptz not null default now()
);

alter table revenuecat_webhook_events enable row level security;
revoke all on revenuecat_webhook_events from anon, authenticated;

-- ============================================================
-- ROLLBACK Sección 91 (referencia — NO ejecutar salvo que se decida
-- revertir esta sección):
--
-- drop table if exists revenuecat_webhook_events;
-- ============================================================
