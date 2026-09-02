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
