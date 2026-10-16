-- Musika: schema principal
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- Perfis (fã e artista usam o mesmo login)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_.]{3,30}$'),
  display_name text,
  avatar_url text,
  city text,
  uf text,
  xp integer not null default 0,
  streak integer not null default 0,
  last_active date,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  base text;
  candidate text;
begin
  base := lower(regexp_replace(split_part(coalesce(new.email, 'fa'), '@', 1), '[^a-z0-9_.]', '', 'g'));
  if length(base) < 3 then base := base || '_fa'; end if;
  base := left(base, 22);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := base || floor(random() * 9000 + 1000)::int;
  end loop;
  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data->>'display_name', base));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Artistas
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name text not null,
  genre text,
  city text,
  uf text,
  bio text,
  avatar_path text,
  verified boolean not null default false,
  booking_whatsapp text,
  instagram text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists artists_name_trgm on public.artists using gin (name gin_trgm_ops);

create table if not exists public.artist_members (
  artist_id uuid references public.artists(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'manager', 'editor')),
  created_at timestamptz not null default now(),
  primary key (artist_id, user_id)
);

-- Lançamentos (CD, single, ao vivo)
create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,80}$'),
  title text not null,
  kind text not null default 'cd' check (kind in ('cd', 'single', 'ao_vivo')),
  genre text,
  cover_path text,
  publish_at timestamptz not null default now(),
  download_allowed boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'processing', 'ready', 'error')),
  created_at timestamptz not null default now(),
  unique (artist_id, slug)
);
create index if not exists releases_title_trgm on public.releases using gin (title gin_trgm_ops);
create index if not exists releases_publish on public.releases (status, publish_at desc);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  position integer not null default 1,
  title text not null,
  duration_sec numeric,
  upload_path text,
  hls_path text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists tracks_release on public.tracks (release_id, position);
create index if not exists tracks_title_trgm on public.tracks using gin (title gin_trgm_ops);

-- Fila de conversão de áudio
create table if not exists public.transcode_jobs (
  id bigserial primary key,
  track_id uuid not null references public.tracks(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists transcode_jobs_status on public.transcode_jobs (status, id);

-- Eventos de play (base de tops, painel e pontos)
create table if not exists public.play_events (
  id bigserial primary key,
  track_id uuid not null references public.tracks(id) on delete cascade,
  release_id uuid not null,
  artist_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  anon_id text,
  seconds integer not null,
  completed boolean not null,
  counted boolean not null,
  source text,
  ref_user uuid,
  created_at timestamptz not null default now()
);
create index if not exists play_events_artist_time on public.play_events (artist_id, created_at);
create index if not exists play_events_user_track on public.play_events (user_id, track_id, created_at desc);
create index if not exists play_events_release on public.play_events (release_id, created_at);

create table if not exists public.track_stats_daily (
  track_id uuid not null references public.tracks(id) on delete cascade,
  release_id uuid not null,
  artist_id uuid not null,
  day date not null,
  plays integer not null default 0,
  completes integer not null default 0,
  downloads integer not null default 0,
  primary key (track_id, day)
);
create index if not exists tsd_release_day on public.track_stats_daily (release_id, day);
create index if not exists tsd_day on public.track_stats_daily (day);

-- Social
create table if not exists public.follows (
  user_id uuid references public.profiles(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create table if not exists public.likes (
  user_id uuid references public.profiles(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

-- Gamificação
create table if not exists public.points_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  action text not null,
  points integer not null,
  ref text,
  created_at timestamptz not null default now()
);
create unique index if not exists points_ledger_idem on public.points_ledger (user_id, action, ref) where ref is not null;
create index if not exists points_ledger_user_day on public.points_ledger (user_id, artist_id, action, created_at);

create table if not exists public.fan_scores (
  user_id uuid references public.profiles(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  xp integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);
create index if not exists fan_scores_artist on public.fan_scores (artist_id, xp desc);

create table if not exists public.badges (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null default '★'
);

create table if not exists public.user_badges (
  user_id uuid references public.profiles(id) on delete cascade,
  code text references public.badges(code) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, code)
);

insert into public.badges (code, name, description, icon) values
  ('pioneiro', 'Pioneiro', 'Esteve entre os 100 primeiros a ouvir um lançamento inteiro', '🚀'),
  ('maratona', 'Maratona', 'Ouviu 100 faixas até o fim', '🎧'),
  ('fiel', 'Fiel', 'Ouviu música 7 dias seguidos', '🔥'),
  ('divulgador', 'Divulgador', 'Trouxe 10 ouvintes novos por link compartilhado', '📣')
on conflict (code) do nothing;

create table if not exists public._musika_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
