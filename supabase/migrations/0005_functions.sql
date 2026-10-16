-- Musika fase 2: funções

create or replace function public.setting(p_key text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select value from public.settings where key = p_key;
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_premium(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select premium_until > now() from public.profiles where id = p_user), false);
$$;

create or replace function public.is_fanclub_member(p_artist uuid, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.fanclub_members where artist_id = p_artist and user_id = p_user and member_until > now());
$$;

create or replace function public.can_edit_playlist(p_playlist uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.playlists p
     where p.id = p_playlist
       and (p.owner_id = auth.uid()
            or (p.collaborative and exists (select 1 from public.playlist_members m where m.playlist_id = p.id and m.user_id = auth.uid())))
  );
$$;

create or replace function public.can_view_playlist(p_playlist uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.playlists p where p.id = p_playlist and (p.is_public or p.owner_id = auth.uid()))
      or public.can_edit_playlist(p_playlist);
$$;

-- novo usuário: perfil + admin automático pelos e-mails configurados
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  base text;
  candidate text;
  admins jsonb;
begin
  base := lower(regexp_replace(split_part(coalesce(new.email, 'fa'), '@', 1), '[^a-z0-9_.]', '', 'g'));
  if length(base) < 3 then base := base || '_fa'; end if;
  base := left(base, 22);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := base || floor(random() * 9000 + 1000)::int;
  end loop;
  select value into admins from public.settings where key = 'admin_emails';
  insert into public.profiles (id, username, display_name, is_admin)
  values (new.id, candidate, coalesce(new.raw_user_meta_data->>'display_name', base),
          coalesce(admins ? lower(new.email), false));
  return new;
end $$;

-- código de check-in: muda a cada 30 s
create or replace function public.checkin_code_for(p_secret text, p_window bigint) returns text
language sql immutable set search_path = public, extensions as $$
  select upper(substr(encode(hmac(p_window::text, p_secret, 'sha256'), 'hex'), 1, 6));
$$;

create or replace function public.event_checkin_code(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare e public.events; w bigint := floor(extract(epoch from now()) / 30);
begin
  select * into e from public.events where id = p_event;
  if e.id is null or not public.is_artist_member(e.artist_id) then raise exception 'sem acesso'; end if;
  return jsonb_build_object('code', public.checkin_code_for(e.checkin_secret, w), 'expires_in', 30 - (extract(epoch from now())::bigint % 30));
end $$;

-- progresso de missão (interno)
create or replace function public.bump_missions(p_user uuid, p_artist uuid, p_kind text, p_target uuid, p_amount integer default 1)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare m public.missions; v_prog integer; v_points integer := 0;
begin
  for m in select * from public.missions
            where artist_id = p_artist and kind = p_kind and active and starts_at <= now() and (ends_at is null or ends_at > now())
              and (target_id is null or target_id = p_target)
  loop
    insert into public.mission_progress (mission_id, user_id, progress) values (m.id, p_user, p_amount)
    on conflict (mission_id, user_id) do update set progress = public.mission_progress.progress + p_amount
      where public.mission_progress.completed_at is null
    returning progress into v_prog;
    if v_prog is not null and v_prog >= m.goal then
      update public.mission_progress set completed_at = now() where mission_id = m.id and user_id = p_user and completed_at is null;
      if found then
        v_points := v_points + public.award_points(p_user, p_artist, 'mission', m.points, m.id::text);
        insert into public.user_badges (user_id, code) values (p_user, 'missao') on conflict do nothing;
      end if;
    end if;
  end loop;
  return v_points;
end $$;

-- record_play com missões
create or replace function public.record_play(p_track uuid, p_seconds integer, p_anon text default null, p_ref text default null, p_source text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  t public.tracks;
  r public.releases;
  v_seconds integer;
  v_completed boolean;
  v_counted boolean;
  v_recent boolean;
  v_points integer := 0;
  v_today date := (now() at time zone 'America/Bahia')::date;
  v_listen_today integer;
  v_prof public.profiles;
  v_new_streak integer;
  v_ref_user uuid;
  v_badges text[] := '{}';
  v_count integer;
  v_mult integer := 1;
begin
  select * into t from public.tracks where id = p_track and status = 'ready';
  if t.id is null then return jsonb_build_object('ok', false); end if;
  select * into r from public.releases where id = t.release_id;
  if not public.release_is_public(r.status, r.publish_at) then return jsonb_build_object('ok', false); end if;

  v_seconds := greatest(0, least(coalesce(p_seconds, 0), coalesce(t.duration_sec, 600)::integer + 5));
  v_completed := t.duration_sec is not null and v_seconds >= t.duration_sec * 0.7;
  v_counted := v_seconds >= 30 or v_completed;

  if v_uid is not null then
    select exists (select 1 from public.play_events where user_id = v_uid and track_id = t.id and counted
                     and created_at > now() - make_interval(secs => greatest(30, coalesce(t.duration_sec, 60) * 0.5))) into v_recent;
  elsif p_anon is not null then
    select exists (select 1 from public.play_events where anon_id = p_anon and track_id = t.id and counted
                     and created_at > now() - make_interval(secs => greatest(30, coalesce(t.duration_sec, 60) * 0.5))) into v_recent;
  else
    v_recent := false;
  end if;
  if v_recent then v_counted := false; end if;

  if p_ref is not null then select id into v_ref_user from public.profiles where username = lower(p_ref); end if;

  insert into public.play_events (track_id, release_id, artist_id, user_id, anon_id, seconds, completed, counted, source, ref_user)
  values (t.id, t.release_id, t.artist_id, v_uid, case when v_uid is null then p_anon end, v_seconds, v_completed, v_counted, left(p_source, 40), v_ref_user);

  if v_counted then
    insert into public.track_stats_daily (track_id, release_id, artist_id, day, plays, completes)
    values (t.id, t.release_id, t.artist_id, v_today, 1, case when v_completed then 1 else 0 end)
    on conflict (track_id, day) do update
      set plays = public.track_stats_daily.plays + 1, completes = public.track_stats_daily.completes + excluded.completes;
  end if;

  if v_uid is null or not v_completed or not v_counted then
    return jsonb_build_object('ok', true, 'counted', v_counted, 'points', 0);
  end if;

  -- Premium ganha pontos em dobro por faixa
  if public.is_premium(v_uid) then v_mult := 2; end if;

  select coalesce(sum(points), 0) into v_listen_today from public.points_ledger
   where user_id = v_uid and artist_id = t.artist_id and action = 'listen'
     and created_at >= (v_today::timestamp at time zone 'America/Bahia');
  if v_listen_today < 50 * v_mult then
    v_points := v_points + public.award_points(v_uid, t.artist_id, 'listen', v_mult, null);
  end if;

  if now() - r.publish_at < interval '48 hours' then
    v_points := v_points + public.award_points(v_uid, t.artist_id, 'early', 10, r.id::text);
  end if;

  select * into v_prof from public.profiles where id = v_uid for update;
  if v_prof.last_active is distinct from v_today then
    v_new_streak := case when v_prof.last_active = v_today - 1 then v_prof.streak + 1 else 1 end;
    update public.profiles set streak = v_new_streak, last_active = v_today where id = v_uid;
    v_points := v_points + public.award_points(v_uid, null, 'streak', least(v_new_streak * 2, 10), v_today::text);
    if v_new_streak >= 7 then
      insert into public.user_badges (user_id, code) values (v_uid, 'fiel') on conflict do nothing;
      if found then v_badges := array_append(v_badges, 'fiel'); end if;
    end if;
  end if;

  if v_ref_user is not null and v_ref_user <> v_uid then
    if public.award_points(v_ref_user, t.artist_id, 'share', 5, v_uid::text || ':' || r.id::text) > 0 then
      perform public.bump_missions(v_ref_user, t.artist_id, 'share', null, 1);
    end if;
    select count(*) into v_count from public.points_ledger where user_id = v_ref_user and action = 'share';
    if v_count >= 10 then
      insert into public.user_badges (user_id, code) values (v_ref_user, 'divulgador') on conflict do nothing;
    end if;
  end if;

  -- missões do artista
  v_points := v_points + public.bump_missions(v_uid, t.artist_id, 'listen_release', r.id, 1);
  v_points := v_points + public.bump_missions(v_uid, t.artist_id, 'listen_tracks', null, 1);

  select count(distinct user_id) into v_count from public.play_events where release_id = r.id and completed and user_id is not null;
  if v_count <= 100 then
    insert into public.user_badges (user_id, code) values (v_uid, 'pioneiro') on conflict do nothing;
    if found then v_badges := array_append(v_badges, 'pioneiro'); end if;
  end if;
  select count(*) into v_count from public.play_events where user_id = v_uid and completed and counted;
  if v_count >= 100 then
    insert into public.user_badges (user_id, code) values (v_uid, 'maratona') on conflict do nothing;
    if found then v_badges := array_append(v_badges, 'maratona'); end if;
  end if;

  return jsonb_build_object('ok', true, 'counted', true, 'points', v_points, 'badges', to_jsonb(v_badges));
end $$;

-- Check-in no show
create or replace function public.event_checkin(p_event uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e public.events; w bigint := floor(extract(epoch from now()) / 30); v_points integer := 0;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  select * into e from public.events where id = p_event;
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'evento'); end if;
  if now() < e.starts_at - interval '6 hours' or now() > e.starts_at + interval '12 hours' then
    return jsonb_build_object('ok', false, 'error', 'fora_do_horario');
  end if;
  if upper(trim(p_code)) not in (public.checkin_code_for(e.checkin_secret, w), public.checkin_code_for(e.checkin_secret, w - 1)) then
    return jsonb_build_object('ok', false, 'error', 'codigo');
  end if;
  insert into public.checkins (event_id, user_id) values (e.id, auth.uid()) on conflict do nothing;
  if not found then return jsonb_build_object('ok', true, 'points', 0, 'already', true); end if;
  v_points := public.award_points(auth.uid(), e.artist_id, 'checkin', 50, e.id::text);
  v_points := v_points + public.bump_missions(auth.uid(), e.artist_id, 'checkin', e.id, 1);
  insert into public.user_badges (user_id, code) values (auth.uid(), 'presente') on conflict do nothing;
  return jsonb_build_object('ok', true, 'points', v_points);
end $$;

-- Resgatar recompensa com os pontos daquele artista
create or replace function public.redeem_reward(p_reward uuid, p_contact text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare rw public.rewards; fs public.fan_scores;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  if length(coalesce(trim(p_contact), '')) < 8 then return jsonb_build_object('ok', false, 'error', 'contato'); end if;
  select * into rw from public.rewards where id = p_reward and active for update;
  if rw.id is null then return jsonb_build_object('ok', false, 'error', 'indisponivel'); end if;
  if rw.stock <= 0 then return jsonb_build_object('ok', false, 'error', 'esgotado'); end if;
  select * into fs from public.fan_scores where user_id = auth.uid() and artist_id = rw.artist_id for update;
  if fs.user_id is null or fs.xp - fs.spent < rw.cost_points then return jsonb_build_object('ok', false, 'error', 'pontos'); end if;
  update public.fan_scores set spent = spent + rw.cost_points where user_id = auth.uid() and artist_id = rw.artist_id;
  update public.rewards set stock = stock - 1 where id = rw.id;
  insert into public.redemptions (reward_id, artist_id, user_id, contact, cost_points) values (rw.id, rw.artist_id, auth.uid(), left(trim(p_contact), 200), rw.cost_points);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_redemption_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare rd public.redemptions;
begin
  select * into rd from public.redemptions where id = p_id for update;
  if rd.id is null or not public.is_artist_member(rd.artist_id) then raise exception 'sem acesso'; end if;
  if p_status not in ('delivered', 'canceled') or rd.status <> 'pending' then raise exception 'status inválido'; end if;
  update public.redemptions set status = p_status where id = p_id;
  if p_status = 'canceled' then
    update public.fan_scores set spent = greatest(0, spent - rd.cost_points) where user_id = rd.user_id and artist_id = rd.artist_id;
    update public.rewards set stock = stock + 1 where id = rd.reward_id;
  end if;
end $$;

-- Equipe: convite por link
create or replace function public.create_invite(p_artist uuid, p_role text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if not exists (select 1 from public.artist_members where artist_id = p_artist and user_id = auth.uid() and role in ('owner', 'manager')) then
    raise exception 'só dono ou empresário convida';
  end if;
  insert into public.artist_invites (artist_id, role, created_by) values (p_artist, p_role, auth.uid()) returning token into v_token;
  return v_token;
end $$;

create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare inv public.artist_invites;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  select * into inv from public.artist_invites where token = p_token for update;
  if inv.token is null or inv.used_at is not null or inv.expires_at < now() then raise exception 'convite inválido ou expirado'; end if;
  insert into public.artist_members (artist_id, user_id, role) values (inv.artist_id, auth.uid(), inv.role) on conflict do nothing;
  update public.artist_invites set used_by = auth.uid(), used_at = now() where token = p_token;
  return inv.artist_id;
end $$;

create or replace function public.remove_member(p_artist uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.artist_members where artist_id = p_artist and user_id = auth.uid() and role = 'owner') then
    raise exception 'só o dono remove';
  end if;
  delete from public.artist_members where artist_id = p_artist and user_id = p_user and role <> 'owner';
end $$;

-- Playlists colaborativas: entrar pelo link
create or replace function public.join_playlist(p_playlist uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  if not exists (select 1 from public.playlists where id = p_playlist and collaborative) then raise exception 'playlist não é colaborativa'; end if;
  insert into public.playlist_members (playlist_id, user_id) values (p_playlist, auth.uid()) on conflict do nothing;
end $$;

-- ===== Anúncios =====
-- Escolhe um anúncio para quem não é Premium, registra a impressão e desconta do orçamento (CPM)
create or replace function public.serve_ad(p_kind text, p_anon text default null, p_genre text default null, p_context text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  c public.ad_campaigns;
  v_uf text;
begin
  if p_kind not in ('audio', 'banner') then return null; end if;
  if auth.uid() is not null and public.is_premium() then return null; end if;
  select uf into v_uf from public.profiles where id = auth.uid();

  select * into c from public.ad_campaigns
   where kind = p_kind and status = 'active'
     and starts_at <= now() and (ends_at is null or ends_at > now())
     and spent_cents + cpm_cents / 1000.0 <= budget_cents
     and (cardinality(target_genres) = 0 or p_genre is null or p_genre ilike any (target_genres))
     and (cardinality(target_ufs) = 0 or v_uf is null or v_uf = any (target_ufs))
   order by random() * (cpm_cents + 1) desc
   limit 1;
  if c.id is null then return null; end if;

  insert into public.ad_events (campaign_id, kind, user_id, anon_id, context) values (c.id, 'impression', auth.uid(), case when auth.uid() is null then left(p_anon, 64) end, left(p_context, 60));
  update public.ad_campaigns
     set spent_cents = spent_cents + cpm_cents / 1000.0,
         status = case when spent_cents + 2 * cpm_cents / 1000.0 > budget_cents then 'ended' else status end
   where id = c.id;

  return jsonb_build_object('id', c.id, 'kind', c.kind, 'media_path', c.media_path, 'duration_sec', c.duration_sec,
                            'headline', c.headline, 'advertiser', c.advertiser, 'click_url', c.click_url);
end $$;

create or replace function public.ad_event(p_campaign uuid, p_kind text, p_anon text default null) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text;
begin
  if p_kind not in ('click', 'complete') then return null; end if;
  select click_url into v_url from public.ad_campaigns where id = p_campaign;
  if not found then return null; end if;
  -- no máximo um clique/conclusão por pessoa por campanha a cada 10 min
  if not exists (select 1 from public.ad_events where campaign_id = p_campaign and kind = p_kind
                   and coalesce(user_id::text, anon_id) = coalesce(auth.uid()::text, p_anon) and created_at > now() - interval '10 minutes') then
    insert into public.ad_events (campaign_id, kind, user_id, anon_id) values (p_campaign, p_kind, auth.uid(), case when auth.uid() is null then left(p_anon, 64) end);
  end if;
  return v_url;
end $$;

create or replace function public.campaign_report(p_campaign uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c public.ad_campaigns;
begin
  select * into c from public.ad_campaigns where id = p_campaign;
  if c.id is null or (c.owner_id <> auth.uid() and not public.is_admin()) then raise exception 'sem acesso'; end if;
  return jsonb_build_object(
    'impressions', (select count(*) from public.ad_events where campaign_id = c.id and kind = 'impression'),
    'clicks', (select count(*) from public.ad_events where campaign_id = c.id and kind = 'click'),
    'completes', (select count(*) from public.ad_events where campaign_id = c.id and kind = 'complete'),
    'reach', (select count(distinct coalesce(user_id::text, anon_id)) from public.ad_events where campaign_id = c.id and kind = 'impression'),
    'spent_cents', c.spent_cents,
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'impressions', n) order by d) from (
        select (created_at at time zone 'America/Bahia')::date as d, count(*) as n from public.ad_events
         where campaign_id = c.id and kind = 'impression' group by 1) x), '[]'::jsonb)
  );
end $$;

create or replace function public.submit_campaign(p_campaign uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare c public.ad_campaigns; v_min integer := (public.setting('min_campaign_cents'))::text::integer;
begin
  select * into c from public.ad_campaigns where id = p_campaign for update;
  if c.id is null or c.owner_id <> auth.uid() then raise exception 'sem acesso'; end if;
  if c.status not in ('draft', 'rejected') then raise exception 'campanha já enviada'; end if;
  if c.media_path is null then raise exception 'envie o áudio ou o banner'; end if;
  if c.budget_cents < v_min then raise exception 'orçamento mínimo de R$ %', v_min / 100; end if;
  update public.ad_campaigns set status = 'pending_payment' where id = c.id;
end $$;

create or replace function public.set_campaign_paused(p_campaign uuid, p_paused boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.ad_campaigns set status = case when p_paused then 'paused' else 'active' end
   where id = p_campaign and (owner_id = auth.uid() or public.is_admin()) and status in ('active', 'paused');
end $$;

-- ===== Impulsionamento =====
create or replace function public.active_boosts(p_placement text) returns table (boost_id uuid, release_id uuid, title text, slug text, kind text, cover_path text, artist_slug text, artist_name text, verified boolean)
language sql stable security definer set search_path = public, extensions as $$
  select b.id, r.id, r.title, r.slug, r.kind, r.cover_path, a.slug, a.name, a.verified
    from public.boosts b join public.releases r on r.id = b.release_id join public.artists a on a.id = b.artist_id
   where b.placement = p_placement and b.status = 'active' and b.starts_at <= now() and b.ends_at > now()
     and public.release_is_public(r.status, r.publish_at)
   order by random() limit 6;
$$;

create or replace function public.boost_impression(p_ids uuid[]) returns void
language sql security definer set search_path = public, extensions as $$
  update public.boosts set impressions = impressions + 1 where id = any (p_ids);
$$;

create or replace function public.boost_click(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  update public.boosts set clicks = clicks + 1 where id = p_id;
$$;

create or replace function public.end_expired() returns void
language sql security definer set search_path = public, extensions as $$
  update public.boosts set status = 'ended' where status = 'active' and ends_at <= now();
  update public.ad_campaigns set status = 'ended' where status in ('active', 'paused') and ends_at is not null and ends_at <= now();
  update public.payments set status = 'expired' where status = 'pending' and expires_at < now() - interval '10 minutes';
$$;

-- ===== Pagamentos =====
-- Cria o registro do pagamento e devolve o valor calculado no servidor (nunca confiar no preço vindo do navegador)
create or replace function public.prepare_payment(p_purpose text, p_ref uuid, p_extra jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_amount integer;
  v_desc text;
  v_id uuid;
  v_days integer;
  b public.boosts;
  c public.ad_campaigns;
  fp public.fanclub_plans;
  a public.artists;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  if p_purpose = 'premium' then
    v_amount := (public.setting('premium_price_cents'))::text::integer;
    v_desc := 'Musika Premium por ' || (public.setting('premium_days'))::text || ' dias';
    p_ref := null;
  elsif p_purpose = 'fanclub' then
    select * into fp from public.fanclub_plans where artist_id = p_ref and active;
    if fp.artist_id is null then raise exception 'fã-clube indisponível'; end if;
    select * into a from public.artists where id = p_ref;
    v_amount := fp.price_cents;
    v_desc := 'Fã-clube ' || a.name || ' por 30 dias';
  elsif p_purpose = 'boost' then
    select * into b from public.boosts where id = p_ref;
    if b.id is null or not public.is_artist_member(b.artist_id) or b.status <> 'pending_payment' then raise exception 'impulsionamento inválido'; end if;
    v_amount := b.amount_cents;
    v_desc := 'Impulsionamento por ' || b.days || ' dias';
  elsif p_purpose = 'ad_campaign' then
    select * into c from public.ad_campaigns where id = p_ref;
    if c.id is null or c.owner_id <> auth.uid() or c.status <> 'pending_payment' then raise exception 'campanha inválida'; end if;
    v_amount := c.budget_cents;
    v_desc := 'Campanha ' || c.name;
  else
    raise exception 'tipo de pagamento inválido';
  end if;

  insert into public.payments (user_id, purpose, ref_id, description, amount_cents, expires_at)
  values (auth.uid(), p_purpose, p_ref, v_desc, v_amount, now() + interval '1 hour')
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'amount_cents', v_amount, 'description', v_desc);
end $$;

-- Aplica o efeito de um pagamento confirmado (idempotente). Só service_role ou admin.
create or replace function public.apply_payment(p_payment uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  p public.payments;
  v_days integer := (public.setting('premium_days'))::text::integer;
  v_fee integer;
  b public.boosts;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then raise exception 'sem acesso'; end if;
  select * into p from public.payments where id = p_payment for update;
  if p.id is null then raise exception 'pagamento não existe'; end if;
  if p.applied_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;
  update public.payments set status = 'paid', paid_at = coalesce(paid_at, now()), applied_at = now() where id = p.id;

  if p.purpose = 'premium' then
    update public.profiles set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => v_days) where id = p.user_id;
  elsif p.purpose = 'fanclub' then
    insert into public.fanclub_members (user_id, artist_id, member_until) values (p.user_id, p.ref_id, now() + interval '30 days')
    on conflict (user_id, artist_id) do update set member_until = greatest(public.fanclub_members.member_until, now()) + interval '30 days';
    v_fee := round(p.amount_cents * (public.setting('fanclub_fee_pct'))::text::numeric / 100);
    insert into public.artist_earnings (artist_id, payment_id, gross_cents, fee_cents, net_cents)
    values (p.ref_id, p.id, p.amount_cents, v_fee, p.amount_cents - v_fee) on conflict do nothing;
    insert into public.user_badges (user_id, code) values (p.user_id, 'socio') on conflict do nothing;
  elsif p.purpose = 'boost' then
    update public.boosts set status = 'active', starts_at = now(), ends_at = now() + make_interval(days => days) where id = p.ref_id and status = 'pending_payment';
  elsif p.purpose = 'ad_campaign' then
    update public.ad_campaigns set status = 'pending_review' where id = p.ref_id and status = 'pending_payment';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ===== Admin =====
create or replace function public.admin_review_campaign(p_campaign uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  update public.ad_campaigns set status = case when p_approve then 'active' else 'rejected' end, review_note = p_note
   where id = p_campaign and status = 'pending_review';
end $$;

create or replace function public.admin_set_verified(p_artist uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  update public.artists set verified = p_verified where id = p_artist;
end $$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  update public.settings set value = p_value, updated_at = now() where key = p_key;
end $$;

create or replace function public.admin_resolve_report(p_report uuid, p_hide boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare rp public.reports;
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  select * into rp from public.reports where id = p_report;
  if p_hide then
    if rp.target_kind = 'comment' then update public.comments set hidden = true where id = rp.target_id; end if;
    if rp.target_kind = 'release' then update public.releases set status = 'error' where id = rp.target_id; end if;
    if rp.target_kind = 'campaign' then update public.ad_campaigns set status = 'paused' where id = rp.target_id; end if;
  end if;
  update public.reports set status = case when p_hide then 'resolved' else 'dismissed' end where id = p_report;
end $$;

create or replace function public.admin_mark_payout(p_artist uuid) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare v_total integer;
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  select coalesce(sum(net_cents), 0) into v_total from public.artist_earnings where artist_id = p_artist and paid_out_at is null;
  update public.artist_earnings set paid_out_at = now() where artist_id = p_artist and paid_out_at is null;
  return v_total;
end $$;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'artists', (select count(*) from public.artists),
    'releases', (select count(*) from public.releases where status = 'ready'),
    'plays_today', coalesce((select sum(plays) from public.track_stats_daily where day = (now() at time zone 'America/Bahia')::date), 0),
    'plays_30d', coalesce((select sum(plays) from public.track_stats_daily where day > (now() at time zone 'America/Bahia')::date - 30), 0),
    'premium_active', (select count(*) from public.profiles where premium_until > now()),
    'revenue_30d_cents', coalesce((select sum(amount_cents) from public.payments where status = 'paid' and paid_at > now() - interval '30 days'), 0),
    'revenue_by_purpose', coalesce((select jsonb_object_agg(purpose, total) from (select purpose, sum(amount_cents) as total from public.payments where status = 'paid' and paid_at > now() - interval '30 days' group by purpose) x), '{}'::jsonb),
    'pending_review', (select count(*) from public.ad_campaigns where status = 'pending_review'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'payouts_due_cents', coalesce((select sum(net_cents) from public.artist_earnings where paid_out_at is null), 0),
    'ad_impressions_30d', (select count(*) from public.ad_events where kind = 'impression' and created_at > now() - interval '30 days')
  );
end $$;

-- ===== Retrospectiva do fã =====
create or replace function public.my_wrapped(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return null; end if;
  return jsonb_build_object(
    'minutes', coalesce((select round(sum(seconds) / 60.0) from public.play_events where user_id = v_uid and created_at::date between p_from and p_to), 0),
    'plays', (select count(*) from public.play_events where user_id = v_uid and counted and created_at::date between p_from and p_to),
    'artists', coalesce((select jsonb_agg(x) from (
        select a.slug, a.name, a.avatar_path, count(*) as plays from public.play_events e join public.artists a on a.id = e.artist_id
         where e.user_id = v_uid and e.counted and e.created_at::date between p_from and p_to
         group by a.id order by plays desc limit 5) x), '[]'::jsonb),
    'tracks', coalesce((select jsonb_agg(x) from (
        select t.title, a.name as artist_name, r.cover_path, count(*) as plays from public.play_events e
          join public.tracks t on t.id = e.track_id join public.releases r on r.id = e.release_id join public.artists a on a.id = e.artist_id
         where e.user_id = v_uid and e.counted and e.created_at::date between p_from and p_to
         group by t.id, a.name, r.cover_path order by plays desc limit 5) x), '[]'::jsonb),
    'genre', (select coalesce(r.genre, a.genre) from public.play_events e join public.releases r on r.id = e.release_id join public.artists a on a.id = e.artist_id
               where e.user_id = v_uid and e.counted and e.created_at::date between p_from and p_to
               group by 1 order by count(*) desc limit 1),
    'checkins', (select count(*) from public.checkins where user_id = v_uid and created_at::date between p_from and p_to)
  );
end $$;

-- Fã-clube: o fã vê se é sócio e o artista vê a receita
create or replace function public.artist_money(p_artist uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.is_artist_member(p_artist) then raise exception 'sem acesso'; end if;
  return jsonb_build_object(
    'members', (select count(*) from public.fanclub_members where artist_id = p_artist and member_until > now()),
    'pending_cents', coalesce((select sum(net_cents) from public.artist_earnings where artist_id = p_artist and paid_out_at is null), 0),
    'paid_cents', coalesce((select sum(net_cents) from public.artist_earnings where artist_id = p_artist and paid_out_at is not null), 0)
  );
end $$;

-- Check-in só com o código (sem câmera): procura o show acontecendo agora que bate com o código
create or replace function public.event_checkin_by_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e public.events; w bigint := floor(extract(epoch from now()) / 30); res jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  for e in select * from public.events where now() between starts_at - interval '6 hours' and starts_at + interval '12 hours' loop
    if upper(trim(p_code)) in (public.checkin_code_for(e.checkin_secret, w), public.checkin_code_for(e.checkin_secret, w - 1)) then
      res := public.event_checkin(e.id, p_code);
      return res || jsonb_build_object('event_id', e.id);
    end if;
  end loop;
  return jsonb_build_object('ok', false, 'error', 'codigo');
end $$;
