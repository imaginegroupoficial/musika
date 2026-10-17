-- Paredão Play: gestão de usuários no admin e avisos com lançamento vinculado

alter table public.profiles add column if not exists blocked_at timestamptz;
alter table public.profiles add column if not exists blocked_reason text;
alter table public.profiles add column if not exists premium_note text;

-- registro do que o admin fez em cada conta
create table if not exists public.admin_log (
  id bigserial primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  user_id uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_log_user on public.admin_log (user_id, created_at desc);
alter table public.admin_log enable row level security;
drop policy if exists admin_log_read on public.admin_log;
create policy admin_log_read on public.admin_log for select using (public.is_admin());
grant select on public.admin_log to authenticated;
grant all on public.admin_log to service_role;
grant usage on sequence public.admin_log_id_seq to service_role;

-- lista de usuários com e-mail e números (só admin)
create or replace function public.admin_users(p_q text default null, p_filter text default 'todos', p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, username text, display_name text, email text, avatar_url text, city text, uf text, xp integer,
  premium_until timestamptz, premium_note text, is_admin boolean, blocked_at timestamptz, blocked_reason text,
  created_at timestamptz, last_sign_in_at timestamptz, artists integer, plays bigint, paid_cents bigint, total bigint
)
language plpgsql stable security definer set search_path = public, extensions, auth as $$
#variable_conflict use_column
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  return query
  with base as (
    select p.*, u.email::text as u_email, u.last_sign_in_at as u_last
      from public.profiles p
      join auth.users u on u.id = p.id
     where (v_q is null
            or p.username ilike '%' || v_q || '%'
            or p.display_name ilike '%' || v_q || '%'
            or u.email ilike '%' || v_q || '%')
       and case coalesce(p_filter, 'todos')
             when 'premium' then p.premium_until > now()
             when 'admins' then p.is_admin
             when 'bloqueados' then p.blocked_at is not null
             when 'artistas' then exists (select 1 from public.artist_members m where m.user_id = p.id)
             else true
           end
  )
  select b.id, b.username, b.display_name, b.u_email, b.avatar_url, b.city, b.uf, b.xp,
         b.premium_until, b.premium_note, b.is_admin, b.blocked_at, b.blocked_reason,
         b.created_at, b.u_last,
         (select count(*)::integer from public.artist_members m where m.user_id = b.id),
         (select count(*) from public.play_events e where e.user_id = b.id),
         (select coalesce(sum(pa.amount_cents), 0)::bigint from public.payments pa where pa.user_id = b.id and pa.status = 'paid'),
         count(*) over ()
    from base b
   order by b.created_at desc
   limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;

-- Premium dado pelo admin: soma dias a partir de hoje (ou do fim do Premium atual); 0 tira o Premium
create or replace function public.admin_set_premium(p_user uuid, p_days integer, p_note text default null)
returns timestamptz language plpgsql security definer set search_path = public, extensions as $$
declare
  v_until timestamptz;
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  if p_days < 0 or p_days > 3650 then raise exception 'dias inválidos'; end if;
  if p_days = 0 then
    update public.profiles set premium_until = null, premium_note = null where id = p_user;
  else
    update public.profiles
       set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => p_days),
           premium_note = coalesce(nullif(trim(p_note), ''), 'Dado pela administração')
     where id = p_user
    returning premium_until into v_until;
    insert into public.notifications (user_id, kind, title, body, link, ref)
    values (p_user, 'aviso', 'Você ganhou Premium!',
            'São ' || p_days || ' dias sem anúncios e com pontos em dobro, até ' || to_char(v_until at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || '.',
            '/premium', 'premium-admin:' || replace(gen_random_uuid()::text, '-', ''));
  end if;
  insert into public.admin_log (admin_id, user_id, action, detail)
  values (auth.uid(), p_user, case when p_days = 0 then 'premium_removido' else 'premium_dado' end, jsonb_build_object('dias', p_days, 'nota', p_note));
  return v_until;
end $$;

-- Tornar ou tirar administrador (mantém a lista de e-mails do install em dia)
create or replace function public.admin_set_admin(p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_email text;
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  if p_user = auth.uid() and not p_on then raise exception 'você não pode tirar o seu próprio acesso'; end if;
  select lower(email) into v_email from auth.users where id = p_user;
  update public.profiles set is_admin = p_on where id = p_user;
  update public.settings
     set value = coalesce((
           select jsonb_agg(distinct e)
             from jsonb_array_elements_text(coalesce(value, '[]'::jsonb) || case when p_on then jsonb_build_array(v_email) else '[]'::jsonb end) e
            where p_on or e <> v_email), '[]'::jsonb)
   where key = 'admin_emails';
  insert into public.admin_log (admin_id, user_id, action) values (auth.uid(), p_user, case when p_on then 'virou_admin' else 'saiu_admin' end);
end $$;

-- Bloqueio: marca no perfil (o login é travado pelo site via API de autenticação)
create or replace function public.admin_set_blocked(p_user uuid, p_block boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  if p_user = auth.uid() then raise exception 'você não pode bloquear a sua própria conta'; end if;
  update public.profiles
     set blocked_at = case when p_block then now() else null end,
         blocked_reason = case when p_block then nullif(trim(p_reason), '') else null end
   where id = p_user;
  insert into public.admin_log (admin_id, user_id, action, detail)
  values (auth.uid(), p_user, case when p_block then 'bloqueado' else 'desbloqueado' end, jsonb_build_object('motivo', p_reason));
end $$;

-- Aviso geral agora pode levar um lançamento (capa vira a imagem e o link abre o CD)
drop function if exists public.admin_broadcast(text, text, text, text);
create or replace function public.admin_broadcast(p_title text, p_body text, p_link text, p_uf text default null, p_release uuid default null, p_image text default null)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  n integer;
  v_ref text := 'aviso:' || replace(gen_random_uuid()::text, '-', '');
  r record;
  v_link text := nullif(trim(coalesce(p_link, '')), '');
  v_image text := nullif(trim(coalesce(p_image, '')), '');
  v_artist uuid;
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'escreva um título'; end if;
  if p_release is not null then
    select rl.slug, rl.cover_path, a.slug as artist_slug, a.id as artist_id into r
      from public.releases rl join public.artists a on a.id = rl.artist_id where rl.id = p_release;
    if r.slug is null then raise exception 'lançamento não encontrado'; end if;
    v_link := coalesce(v_link, '/' || r.artist_slug || '/' || r.slug);
    v_image := coalesce(v_image, r.cover_path);
    v_artist := r.artist_id;
  end if;
  insert into public.notifications (user_id, kind, title, body, link, image_path, artist_id, ref)
  select p.id, 'aviso', trim(p_title), nullif(trim(p_body), ''), v_link, v_image, v_artist, v_ref
    from public.profiles p
   where (p_uf is null or p_uf = '' or p.uf = p_uf)
     and p.blocked_at is null
     and public.pref_on(p.prefs, 'n_avisos');
  get diagnostics n = row_count;
  insert into public.admin_log (admin_id, action, detail)
  values (auth.uid(), 'aviso_geral', jsonb_build_object('titulo', p_title, 'pessoas', n, 'lancamento', p_release, 'uf', p_uf));
  return n;
end $$;

-- a entrega leva mais dados para montar push e e-mail completos
drop function if exists public.claim_notifications(integer);
create or replace function public.claim_notifications(p_limit integer default 200)
returns table (id bigint, kind text, title text, body text, link text, image_path text, email text, name text,
               want_push boolean, want_email boolean, subs jsonb, release jsonb)
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
  select c.id, c.kind, c.title, c.body, c.link, c.image_path, u.email::text, coalesce(p.display_name, p.username),
         public.pref_on(p.prefs, 'push') and p.blocked_at is null,
         public.pref_on(p.prefs, 'email', false) and p.blocked_at is null and c.kind in ('lancamento', 'show', 'lembrete', 'aviso'),
         coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
                     from public.push_subscriptions s where s.user_id = c.user_id), '[]'::jsonb),
         -- quando o aviso é de um lançamento, junta as faixas para o e-mail
         (select jsonb_build_object('title', rl.title, 'kind', rl.kind, 'artist', a.name,
                   'tracks', coalesce((select jsonb_agg(t.title order by t.position) from (select title, position from public.tracks where release_id = rl.id order by position limit 8) t), '[]'::jsonb))
            from public.releases rl join public.artists a on a.id = rl.artist_id
           where c.link = '/' || a.slug || '/' || rl.slug
           limit 1)
    from c
    join public.profiles p on p.id = c.user_id
    join auth.users u on u.id = c.user_id;
end $$;

revoke execute on function public.admin_users(text, text, integer, integer) from public, anon;
revoke execute on function public.admin_set_premium(uuid, integer, text) from public, anon;
revoke execute on function public.admin_set_admin(uuid, boolean) from public, anon;
revoke execute on function public.admin_set_blocked(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_broadcast(text, text, text, text, uuid, text) from public, anon;
revoke execute on function public.claim_notifications(integer) from public, anon, authenticated;
grant execute on function public.admin_users(text, text, integer, integer) to authenticated;
grant execute on function public.admin_set_premium(uuid, integer, text) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_set_blocked(uuid, boolean, text) to authenticated;
grant execute on function public.admin_broadcast(text, text, text, text, uuid, text) to authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
