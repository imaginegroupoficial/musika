-- Musika: perfil completo, configurações do ouvinte e notificações (no site, no celular e por e-mail)

-- Perfil: bio e preferências
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.profiles add constraint profiles_bio_len check (bio is null or length(bio) <= 300);
exception when duplicate_object then null; end $$;
grant update (bio, prefs) on public.profiles to authenticated;

-- lê uma preferência booleana (padrão quando não existe)
create or replace function public.pref_on(p_prefs jsonb, p_key text, p_default boolean default true)
returns boolean language sql immutable as $$
  select coalesce((p_prefs ->> p_key)::boolean, p_default);
$$;

-- Fotos de perfil: cada um só grava na própria pasta
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;
drop policy if exists musika_avatars_insert on storage.objects;
create policy musika_avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists musika_avatars_update on storage.objects;
create policy musika_avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists musika_avatars_delete on storage.objects;
create policy musika_avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists musika_avatars_read on storage.objects;
create policy musika_avatars_read on storage.objects for select using (bucket_id = 'avatars');

-- Notificações
create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('lancamento', 'show', 'lembrete', 'post', 'insignia', 'nivel', 'aviso')),
  title text not null,
  body text,
  link text check (link is null or link ~ '^(https?://|/)'),
  image_path text,
  artist_id uuid references public.artists(id) on delete cascade,
  ref text not null,
  deliver_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, ref)
);
create index if not exists notifications_feed on public.notifications (user_id, deliver_at desc);
create index if not exists notifications_outbox on public.notifications (deliver_at) where pushed_at is null;

alter table public.notifications enable row level security;
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select using (user_id = auth.uid() and deliver_at <= now());
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;
grant usage on sequence public.notifications_id_seq to service_role;

-- Inscrições de notificação no celular/navegador (Web Push)
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- o sino atualiza na hora pelo Realtime
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when duplicate_object then null; end $$;

-- Lançamento pronto: avisa quem segue o artista (na hora da estreia, se for agendado)
create or replace function public.notify_release() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  a public.artists;
  v_kind text;
begin
  if new.status <> 'ready' or old.status = 'ready' then return new; end if;
  select * into a from public.artists where id = new.artist_id;
  v_kind := case new.kind when 'single' then 'o single' when 'ao_vivo' then 'o ao vivo' else 'o CD' end;
  insert into public.notifications (user_id, kind, title, body, link, image_path, artist_id, ref, deliver_at)
  select f.user_id, 'lancamento',
         a.name || ' lançou ' || v_kind || ' ' || new.title,
         'Ouça agora e ganhe 10 pontos nas primeiras 48 horas.',
         '/' || a.slug || '/' || new.slug, new.cover_path, a.id,
         'lancamento:' || new.id, greatest(new.publish_at, now())
    from public.follows f
    join public.profiles p on p.id = f.user_id
   where f.artist_id = a.id
     and public.pref_on(p.prefs, 'n_lancamentos')
     and not exists (select 1 from public.artist_members m where m.artist_id = a.id and m.user_id = f.user_id)
  on conflict (user_id, ref) do nothing;
  return new;
end $$;
drop trigger if exists releases_notify on public.releases;
create trigger releases_notify after update of status on public.releases
  for each row execute function public.notify_release();

-- Show novo: avisa os seguidores; véspera: lembra quem é do mesmo estado
create or replace function public.notify_event() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  a public.artists;
  v_quando text;
  v_onde text;
begin
  select * into a from public.artists where id = new.artist_id;
  v_quando := to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24"h"MI');
  v_onde := concat_ws(', ', nullif(new.venue, ''), nullif(concat_ws('/', nullif(new.city, ''), nullif(new.uf, '')), ''));
  insert into public.notifications (user_id, kind, title, body, link, artist_id, ref)
  select f.user_id, 'show', a.name || ' marcou show: ' || new.title,
         v_quando || coalesce(' em ' || nullif(v_onde, ''), '') || '. Faça check-in no show e ganhe pontos.',
         '/' || a.slug, a.id, 'show:' || new.id
    from public.follows f join public.profiles p on p.id = f.user_id
   where f.artist_id = a.id and new.starts_at > now()
     and public.pref_on(p.prefs, 'n_shows')
     and not exists (select 1 from public.artist_members m where m.artist_id = a.id and m.user_id = f.user_id)
  on conflict (user_id, ref) do nothing;

  if new.starts_at - interval '1 day' > now() then
    insert into public.notifications (user_id, kind, title, body, link, artist_id, ref, deliver_at)
    select f.user_id, 'lembrete', 'Amanhã tem ' || a.name,
           new.title || ', ' || v_quando || coalesce(' em ' || nullif(v_onde, ''), '') || '.',
           '/' || a.slug, a.id, 'lembrete:' || new.id, new.starts_at - interval '1 day'
      from public.follows f join public.profiles p on p.id = f.user_id
     where f.artist_id = a.id
       and (new.uf is null or p.uf is null or p.uf = new.uf)
       and public.pref_on(p.prefs, 'n_shows')
       and not exists (select 1 from public.artist_members m where m.artist_id = a.id and m.user_id = f.user_id)
    on conflict (user_id, ref) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists events_notify on public.events;
create trigger events_notify after insert on public.events
  for each row execute function public.notify_event();

-- Show apagado some das notificações; remarcado move o lembrete
create or replace function public.unnotify_event() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'DELETE' then
    delete from public.notifications where ref in ('show:' || old.id, 'lembrete:' || old.id);
    return old;
  end if;
  if new.starts_at <= now() + interval '1 day' then
    delete from public.notifications where ref = 'lembrete:' || new.id and pushed_at is null;
  else
    update public.notifications set deliver_at = new.starts_at - interval '1 day' where ref = 'lembrete:' || new.id and pushed_at is null;
  end if;
  return new;
end $$;
drop trigger if exists events_unnotify on public.events;
create trigger events_unnotify after delete on public.events
  for each row execute function public.unnotify_event();
drop trigger if exists events_reschedule on public.events;
create trigger events_reschedule after update of starts_at on public.events
  for each row execute function public.unnotify_event();

-- Post no mural: público vai para seguidores, exclusivo vai para o fã-clube
create or replace function public.notify_post() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  a public.artists;
begin
  select * into a from public.artists where id = new.artist_id;
  insert into public.notifications (user_id, kind, title, body, link, image_path, artist_id, ref)
  select u.user_id, 'post',
         case when new.fanclub_only then a.name || ' postou só para o fã-clube' else a.name || ' postou no mural' end,
         left(new.body, 140), '/' || a.slug, null, a.id, 'post:' || new.id
    from (
      select f.user_id from public.follows f where f.artist_id = a.id and not new.fanclub_only
      union
      select m.user_id from public.fanclub_members m where m.artist_id = a.id and m.member_until > now()
    ) u
    join public.profiles p on p.id = u.user_id
   where public.pref_on(p.prefs, 'n_posts')
     and u.user_id is distinct from new.author_id
  on conflict (user_id, ref) do nothing;
  return new;
end $$;
drop trigger if exists artist_posts_notify on public.artist_posts;
create trigger artist_posts_notify after insert on public.artist_posts
  for each row execute function public.notify_post();

-- Insígnia nova
create or replace function public.notify_badge() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  b public.badges;
  v_user text;
begin
  select * into b from public.badges where code = new.code;
  select username into v_user from public.profiles where id = new.user_id;
  insert into public.notifications (user_id, kind, title, body, link, ref)
  values (new.user_id, 'insignia', 'Insígnia nova: ' || b.icon || ' ' || b.name, b.description, '/perfil/' || v_user, 'insignia:' || new.code)
  on conflict (user_id, ref) do nothing;
  return new;
end $$;
drop trigger if exists user_badges_notify on public.user_badges;
create trigger user_badges_notify after insert on public.user_badges
  for each row execute function public.notify_badge();

-- Subiu de nível
create or replace function public.notify_level() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_old text;
  v_new text;
begin
  v_old := (public.level_info(old.xp)) ->> 'name';
  v_new := (public.level_info(new.xp)) ->> 'name';
  if new.xp > old.xp and v_new is distinct from v_old then
    insert into public.notifications (user_id, kind, title, body, link, ref)
    values (new.id, 'nivel', 'Você agora é ' || v_new, 'Subiu de nível com ' || new.xp || ' pontos. Continue ouvindo para chegar mais longe.', '/perfil/' || new.username, 'nivel:' || v_new)
    on conflict (user_id, ref) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists profiles_level_notify on public.profiles;
create trigger profiles_level_notify after update of xp on public.profiles
  for each row execute function public.notify_level();

-- Marca como lidas (todas ou só as indicadas)
create or replace function public.mark_notifications_read(p_ids bigint[] default null) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  n integer;
begin
  if auth.uid() is null then raise exception 'entre na sua conta'; end if;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and deliver_at <= now()
     and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

-- Aviso geral do admin para todos os usuários (ou só de um estado)
create or replace function public.admin_broadcast(p_title text, p_body text, p_link text, p_uf text default null) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  n integer;
  v_ref text := 'aviso:' || replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'escreva um título'; end if;
  insert into public.notifications (user_id, kind, title, body, link, ref)
  select p.id, 'aviso', trim(p_title), nullif(trim(p_body), ''), nullif(trim(p_link), ''), v_ref
    from public.profiles p
   where (p_uf is null or p_uf = '' or p.uf = p_uf) and public.pref_on(p.prefs, 'n_avisos');
  get diagnostics n = row_count;
  return n;
end $$;

-- Saída para o worker: pega notificações a entregar e marca como enviadas
create or replace function public.claim_notifications(p_limit integer default 200)
returns table (id bigint, kind text, title text, body text, link text, image_path text, email text, want_push boolean, want_email boolean, subs jsonb)
language plpgsql security definer set search_path = public, extensions, auth as $$
#variable_conflict use_column
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'sem acesso'; end if;
  return query
  with c as (
    update public.notifications n set pushed_at = now()
     where n.id in (
       select x.id from public.notifications x
        where x.pushed_at is null and x.deliver_at <= now()
        order by x.deliver_at limit p_limit
        for update skip locked)
    returning n.*
  )
  select c.id, c.kind, c.title, c.body, c.link, c.image_path, u.email::text,
         public.pref_on(p.prefs, 'push'),
         public.pref_on(p.prefs, 'email', false) and c.kind in ('lancamento', 'show', 'lembrete', 'aviso'),
         coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
                     from public.push_subscriptions s where s.user_id = c.user_id), '[]'::jsonb)
    from c
    join public.profiles p on p.id = c.user_id
    join auth.users u on u.id = c.user_id;
end $$;

-- Limpeza: notificações com mais de 120 dias
create or replace function public.prune_notifications() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  n integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'sem acesso'; end if;
  delete from public.notifications where created_at < now() - interval '120 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.mark_notifications_read(bigint[]) from public, anon;
revoke execute on function public.admin_broadcast(text, text, text, text) from public, anon;
revoke execute on function public.claim_notifications(integer) from public, anon, authenticated;
revoke execute on function public.prune_notifications() from public, anon, authenticated;
revoke execute on function public.notify_release() from public, anon, authenticated;
revoke execute on function public.notify_event() from public, anon, authenticated;
revoke execute on function public.unnotify_event() from public, anon, authenticated;
revoke execute on function public.notify_post() from public, anon, authenticated;
revoke execute on function public.notify_badge() from public, anon, authenticated;
revoke execute on function public.notify_level() from public, anon, authenticated;
grant execute on function public.pref_on(jsonb, text, boolean) to anon, authenticated, service_role;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;
grant execute on function public.admin_broadcast(text, text, text, text) to authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
grant execute on function public.prune_notifications() to service_role;
