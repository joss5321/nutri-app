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
