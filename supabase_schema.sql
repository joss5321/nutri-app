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
  id         uuid        default uuid_generate_v4() primary key,
  nombre     text        not null,
  emoji      text,
  tags       text,
  tiempo_min int,
  nivel      text        check (nivel in ('Fácil', 'Medio', 'Difícil')),
  calorias   int,
  porciones  text,
  created_at timestamptz not null default now()
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

-- recetas (catálogo global, solo lectura)
alter table recetas enable row level security;
create policy "recetas: lectura para autenticados"
  on recetas for select using (auth.role() = 'authenticated');

alter table receta_ingredientes enable row level security;
create policy "ingredientes: lectura para autenticados"
  on receta_ingredientes for select using (auth.role() = 'authenticated');

alter table receta_pasos enable row level security;
create policy "pasos: lectura para autenticados"
  on receta_pasos for select using (auth.role() = 'authenticated');

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
