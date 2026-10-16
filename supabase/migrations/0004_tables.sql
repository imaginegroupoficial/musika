-- Musika fase 2: tabelas de anúncios, pagamentos, fã-clube, missões, recompensas, agenda, playlists, comentários e admin
create extension if not exists pgcrypto;

-- Configurações editáveis pelo admin (preços, frequência de anúncios)
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.settings (key, value) values
  ('premium_price_cents', '990'),
  ('premium_days', '30'),
  ('cpm_audio_cents', '2500'),
  ('cpm_banner_cents', '800'),
  ('ad_every_n_tracks', '3'),
  ('boost_day_cents', '{"home_hero": 4990, "home_row": 1990, "search": 990}'),
  ('fanclub_fee_pct', '15'),
  ('min_campaign_cents', '5000'),
  ('admin_emails', '[]')
on conflict (key) do nothing;

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists premium_until timestamptz;
alter table public.tracks add column if not exists lyrics text;
alter table public.fan_scores add column if not exists spent integer not null default 0;

-- Pagamentos (Pix via Pagar.me)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('premium', 'fanclub', 'boost', 'ad_campaign')),
  ref_id uuid,
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired', 'refunded', 'canceled')),
  provider text not null default 'pagarme',
  provider_order_id text,
  pix_qr_code text,
  pix_qr_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_user on public.payments (user_id, created_at desc);
create unique index if not exists payments_order on public.payments (provider_order_id) where provider_order_id is not null;

-- Fã-clube
create table if not exists public.fanclub_plans (
  artist_id uuid primary key references public.artists(id) on delete cascade,
  price_cents integer not null check (price_cents >= 500),
  perks text not null default '',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.fanclub_members (
  user_id uuid references public.profiles(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  member_until timestamptz not null,
  since timestamptz not null default now(),
  primary key (user_id, artist_id)
);
create table if not exists public.artist_posts (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (length(body) between 1 and 2000),
  image_path text,
  fanclub_only boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists artist_posts_artist on public.artist_posts (artist_id, created_at desc);

create table if not exists public.artist_earnings (
  id bigserial primary key,
  artist_id uuid not null references public.artists(id) on delete cascade,
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  gross_cents integer not null,
  fee_cents integer not null,
  net_cents integer not null,
  paid_out_at timestamptz,
  created_at timestamptz not null default now()
);

-- Impulsionamento de lançamento
create table if not exists public.boosts (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  placement text not null check (placement in ('home_hero', 'home_row', 'search')),
  days integer not null check (days between 1 and 60),
  amount_cents integer not null,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'ended', 'canceled')),
  starts_at timestamptz,
  ends_at timestamptz,
  impressions integer not null default 0,
  clicks integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists boosts_active on public.boosts (placement, status, ends_at);

-- Rede de anúncios própria
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  advertiser text not null,
  kind text not null check (kind in ('audio', 'banner')),
  status text not null default 'draft' check (status in ('draft', 'pending_payment', 'pending_review', 'active', 'paused', 'rejected', 'ended')),
  media_path text,
  duration_sec integer,
  headline text,
  click_url text check (click_url is null or click_url ~ '^https?://'),
  target_genres text[] not null default '{}',
  target_ufs text[] not null default '{}',
  cpm_cents integer not null,
  budget_cents integer not null default 0,
  spent_cents numeric(12, 2) not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists ad_campaigns_serve on public.ad_campaigns (kind, status);

create table if not exists public.ad_events (
  id bigserial primary key,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  kind text not null check (kind in ('impression', 'click', 'complete')),
  user_id uuid,
  anon_id text,
  context text,
  created_at timestamptz not null default now()
);
create index if not exists ad_events_campaign on public.ad_events (campaign_id, kind, created_at);
create index if not exists ad_events_viewer on public.ad_events (anon_id, created_at) where anon_id is not null;

-- Agenda e check-in
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  venue text,
  city text,
  uf text,
  starts_at timestamptz not null,
  ticket_url text check (ticket_url is null or ticket_url ~ '^https?://'),
  checkin_secret text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
create index if not exists events_artist on public.events (artist_id, starts_at);
create table if not exists public.checkins (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Missões e recompensas do artista
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  description text,
  kind text not null check (kind in ('listen_release', 'listen_tracks', 'share', 'checkin')),
  target_id uuid,
  goal integer not null check (goal between 1 and 1000),
  points integer not null check (points between 1 and 500),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.mission_progress (
  mission_id uuid references public.missions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  progress integer not null default 0,
  completed_at timestamptz,
  primary key (mission_id, user_id)
);
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  description text,
  cost_points integer not null check (cost_points > 0),
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact text not null,
  cost_points integer not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'canceled')),
  created_at timestamptz not null default now()
);

-- Equipe do artista
create table if not exists public.artist_invites (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  artist_id uuid not null references public.artists(id) on delete cascade,
  role text not null default 'editor' check (role in ('manager', 'editor')),
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz
);

-- Playlists
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  description text,
  is_public boolean not null default true,
  collaborative boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists playlists_owner on public.playlists (owner_id, updated_at desc);
create table if not exists public.playlist_members (
  playlist_id uuid references public.playlists(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (playlist_id, user_id)
);
create table if not exists public.playlist_tracks (
  id bigserial primary key,
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  position integer not null default 0,
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  unique (playlist_id, track_id)
);

-- Comentários e denúncias
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  at_second integer,
  body text not null check (length(body) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_release on public.comments (release_id, created_at desc);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  target_kind text not null check (target_kind in ('release', 'track', 'comment', 'artist', 'campaign')),
  target_id uuid not null,
  reason text not null check (length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

insert into public.badges (code, name, description, icon) values
  ('presente', 'Presente', 'Fez check-in em um show', '🎤'),
  ('missao', 'Missão cumprida', 'Concluiu uma missão de artista', '🎯'),
  ('socio', 'Sócio do fã-clube', 'Entrou para o fã-clube de um artista', '💛')
on conflict (code) do nothing;
