-- Musika: funções de negócio

create or replace function public.is_artist_member(p_artist uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.artist_members where artist_id = p_artist and user_id = auth.uid());
$$;

create or replace function public.release_is_public(p_status text, p_publish_at timestamptz) returns boolean
language sql immutable as $$
  select p_status = 'ready' and p_publish_at <= now();
$$;

create or replace function public.level_info(p_xp integer) returns jsonb
language sql immutable as $$
  select case
    when p_xp >= 1500 then jsonb_build_object('level', 5, 'name', 'Lenda', 'floor', 1500, 'next', null)
    when p_xp >= 600 then jsonb_build_object('level', 4, 'name', 'Paredão', 'floor', 600, 'next', 1500)
    when p_xp >= 200 then jsonb_build_object('level', 3, 'name', 'Fã de Carteirinha', 'floor', 200, 'next', 600)
    when p_xp >= 50 then jsonb_build_object('level', 2, 'name', 'Fã', 'floor', 50, 'next', 200)
    else jsonb_build_object('level', 1, 'name', 'Ouvinte', 'floor', 0, 'next', 50)
  end;
$$;

-- Criar artista e virar dono
create or replace function public.create_artist(p_name text, p_slug text, p_genre text, p_city text, p_uf text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  reserved text[] := array['api','studio','top','busca','ranking','entrar','sair','biblioteca','perfil','auth','admin','sobre','ajuda','_next','static'];
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  if p_slug = any(reserved) then raise exception 'endereço reservado'; end if;
  insert into public.artists (slug, name, genre, city, uf, owner_id)
  values (lower(p_slug), p_name, p_genre, p_city, p_uf, auth.uid())
  returning id into v_id;
  insert into public.artist_members (artist_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

-- Enfileirar conversão quando a faixa entra
create or replace function public.enqueue_transcode() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.upload_path is not null and new.status = 'pending' then
    insert into public.transcode_jobs (track_id) values (new.id);
    update public.releases set status = 'processing' where id = new.release_id and status in ('draft', 'ready', 'error');
  end if;
  return new;
end $$;

drop trigger if exists tracks_enqueue on public.tracks;
create trigger tracks_enqueue after insert on public.tracks
  for each row execute function public.enqueue_transcode();

-- Worker: pegar o próximo trabalho (só service_role)
create or replace function public.claim_transcode_job() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  j public.transcode_jobs;
  t public.tracks;
begin
  -- trabalho travado há mais de 30 min volta para a fila
  update public.transcode_jobs set status = 'queued'
   where status = 'running' and started_at < now() - interval '30 minutes' and attempts < 3;

  update public.transcode_jobs set status = 'running', attempts = attempts + 1, started_at = now()
   where id = (select id from public.transcode_jobs where status = 'queued' order by id for update skip locked limit 1)
  returning * into j;
  if j.id is null then return null; end if;

  select * into t from public.tracks where id = j.track_id;
  update public.tracks set status = 'processing' where id = t.id;
  return jsonb_build_object('job_id', j.id, 'track_id', t.id, 'upload_path', t.upload_path, 'attempts', j.attempts);
end $$;

create or replace function public.finish_transcode_job(p_job bigint, p_ok boolean, p_duration numeric, p_hls text, p_error text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  j public.transcode_jobs;
  v_release uuid;
begin
  select * into j from public.transcode_jobs where id = p_job;
  select release_id into v_release from public.tracks where id = j.track_id;
  if p_ok then
    update public.transcode_jobs set status = 'done', finished_at = now(), error = null where id = p_job;
    update public.tracks set status = 'ready', duration_sec = p_duration, hls_path = p_hls, error = null where id = j.track_id;
  elsif j.attempts < 3 then
    update public.transcode_jobs set status = 'queued', error = p_error where id = p_job;
    update public.tracks set status = 'pending', error = p_error where id = j.track_id;
    return;
  else
    update public.transcode_jobs set status = 'failed', finished_at = now(), error = p_error where id = p_job;
    update public.tracks set status = 'error', error = p_error where id = j.track_id;
  end if;

  -- lançamento fica pronto quando nenhuma faixa está pendente
  if not exists (select 1 from public.tracks where release_id = v_release and status in ('pending', 'processing')) then
    update public.releases
       set status = case when exists (select 1 from public.tracks where release_id = v_release and status = 'ready') then 'ready' else 'error' end
     where id = v_release;
  end if;
end $$;

-- Pontos: grava no livro-razão e aplica no XP (idempotente por ref)
create or replace function public.award_points(p_user uuid, p_artist uuid, p_action text, p_points integer, p_ref text)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id bigint;
begin
  if p_points <= 0 then return 0; end if;
  insert into public.points_ledger (user_id, artist_id, action, points, ref)
  values (p_user, p_artist, p_action, p_points, p_ref)
  on conflict do nothing
  returning id into v_id;
  if v_id is null then return 0; end if;
  update public.profiles set xp = xp + p_points where id = p_user;
  if p_artist is not null then
    insert into public.fan_scores (user_id, artist_id, xp) values (p_user, p_artist, p_points)
    on conflict (user_id, artist_id) do update set xp = public.fan_scores.xp + excluded.xp, updated_at = now();
  end if;
  return p_points;
end $$;

-- Registrar uma escuta. Chamado pelo site quando a faixa termina, é pulada ou a página fecha.
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
begin
  select * into t from public.tracks where id = p_track and status = 'ready';
  if t.id is null then return jsonb_build_object('ok', false); end if;
  select * into r from public.releases where id = t.release_id;
  if not public.release_is_public(r.status, r.publish_at) then return jsonb_build_object('ok', false); end if;

  v_seconds := greatest(0, least(coalesce(p_seconds, 0), coalesce(t.duration_sec, 600)::integer + 5));
  v_completed := t.duration_sec is not null and v_seconds >= t.duration_sec * 0.7;
  v_counted := v_seconds >= 30 or v_completed;

  -- trava: mesma pessoa repetindo a mesma faixa rápido demais não conta de novo
  if v_uid is not null then
    select exists (
      select 1 from public.play_events
       where user_id = v_uid and track_id = t.id and counted
         and created_at > now() - make_interval(secs => greatest(30, coalesce(t.duration_sec, 60) * 0.5))
    ) into v_recent;
  elsif p_anon is not null then
    select exists (
      select 1 from public.play_events
       where anon_id = p_anon and track_id = t.id and counted
         and created_at > now() - make_interval(secs => greatest(30, coalesce(t.duration_sec, 60) * 0.5))
    ) into v_recent;
  else
    v_recent := false;
  end if;
  if v_recent then v_counted := false; end if;

  if p_ref is not null then
    select id into v_ref_user from public.profiles where username = lower(p_ref);
  end if;

  insert into public.play_events (track_id, release_id, artist_id, user_id, anon_id, seconds, completed, counted, source, ref_user)
  values (t.id, t.release_id, t.artist_id, v_uid, case when v_uid is null then p_anon end, v_seconds, v_completed, v_counted, left(p_source, 40), v_ref_user);

  if v_counted then
    insert into public.track_stats_daily (track_id, release_id, artist_id, day, plays, completes)
    values (t.id, t.release_id, t.artist_id, v_today, 1, case when v_completed then 1 else 0 end)
    on conflict (track_id, day) do update
      set plays = public.track_stats_daily.plays + 1,
          completes = public.track_stats_daily.completes + excluded.completes;
  end if;

  if v_uid is null or not v_completed or not v_counted then
    return jsonb_build_object('ok', true, 'counted', v_counted, 'points', 0);
  end if;

  -- 1 ponto por faixa completa, até 50 por artista por dia
  select coalesce(sum(points), 0) into v_listen_today from public.points_ledger
   where user_id = v_uid and artist_id = t.artist_id and action = 'listen'
     and created_at >= (v_today::timestamp at time zone 'America/Bahia');
  if v_listen_today < 50 then
    v_points := v_points + public.award_points(v_uid, t.artist_id, 'listen', 1, null);
  end if;

  -- bônus de lançamento: 48 h
  if now() - r.publish_at < interval '48 hours' then
    v_points := v_points + public.award_points(v_uid, t.artist_id, 'early', 10, r.id::text);
  end if;

  -- sequência diária
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

  -- quem compartilhou o link ganha 5 por ouvinte novo
  if v_ref_user is not null and v_ref_user <> v_uid then
    perform public.award_points(v_ref_user, t.artist_id, 'share', 5, v_uid::text || ':' || r.id::text);
    select count(*) into v_count from public.points_ledger where user_id = v_ref_user and action = 'share';
    if v_count >= 10 then
      insert into public.user_badges (user_id, code) values (v_ref_user, 'divulgador') on conflict do nothing;
    end if;
  end if;

  -- insígnias
  select count(distinct user_id) into v_count from public.play_events
   where release_id = r.id and completed and user_id is not null;
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

-- Downloads
create or replace function public.count_download(p_track uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare t public.tracks;
begin
  select * into t from public.tracks where id = p_track;
  if t.id is null then return; end if;
  insert into public.track_stats_daily (track_id, release_id, artist_id, day, downloads)
  values (t.id, t.release_id, t.artist_id, (now() at time zone 'America/Bahia')::date, 1)
  on conflict (track_id, day) do update set downloads = public.track_stats_daily.downloads + 1;
end $$;

-- Tops por janela (p_days null = sempre)
create or replace function public.top_releases(p_days integer default 7, p_limit integer default 20, p_genre text default null)
returns table (release_id uuid, title text, slug text, kind text, cover_path text, artist_slug text, artist_name text, verified boolean, plays bigint)
language sql stable security definer set search_path = public, extensions as $$
  select r.id, r.title, r.slug, r.kind, r.cover_path, a.slug, a.name, a.verified, coalesce(sum(s.plays), 0)::bigint as plays
    from public.releases r
    join public.artists a on a.id = r.artist_id
    left join public.track_stats_daily s on s.release_id = r.id
         and (p_days is null or s.day > (now() at time zone 'America/Bahia')::date - p_days)
   where public.release_is_public(r.status, r.publish_at)
     and (p_genre is null or coalesce(r.genre, a.genre) ilike p_genre)
   group by r.id, a.id
   order by plays desc, r.publish_at desc
   limit p_limit;
$$;

create or replace function public.top_tracks(p_days integer default 7, p_limit integer default 20)
returns table (track_id uuid, title text, duration_sec numeric, hls_path text, release_slug text, release_title text, cover_path text, artist_slug text, artist_name text, plays bigint)
language sql stable security definer set search_path = public, extensions as $$
  select t.id, t.title, t.duration_sec, t.hls_path, r.slug, r.title, r.cover_path, a.slug, a.name, coalesce(sum(s.plays), 0)::bigint
    from public.tracks t
    join public.releases r on r.id = t.release_id
    join public.artists a on a.id = t.artist_id
    left join public.track_stats_daily s on s.track_id = t.id
         and (p_days is null or s.day > (now() at time zone 'America/Bahia')::date - p_days)
   where t.status = 'ready' and public.release_is_public(r.status, r.publish_at)
   group by t.id, r.id, a.id
   order by 10 desc
   limit p_limit;
$$;

-- Estourados: lançamentos dos últimos 30 dias que mais aceleraram
create or replace function public.trending_releases(p_limit integer default 12)
returns table (release_id uuid, title text, slug text, kind text, cover_path text, artist_slug text, artist_name text, verified boolean, plays_recent bigint, score numeric)
language sql stable security definer set search_path = public, extensions as $$
  with d as (select (now() at time zone 'America/Bahia')::date as today)
  select r.id, r.title, r.slug, r.kind, r.cover_path, a.slug, a.name, a.verified,
         coalesce(sum(s.plays) filter (where s.day > d.today - 2), 0)::bigint as recent,
         round(coalesce(sum(s.plays) filter (where s.day > d.today - 2), 0)::numeric
               / (coalesce(sum(s.plays) filter (where s.day <= d.today - 2 and s.day > d.today - 7), 0)::numeric / 2.5 + 10), 3) as score
    from public.releases r
    cross join d
    join public.artists a on a.id = r.artist_id
    left join public.track_stats_daily s on s.release_id = r.id and s.day > d.today - 7
   where public.release_is_public(r.status, r.publish_at) and r.publish_at > now() - interval '30 days'
   group by r.id, a.id
   order by score desc, r.publish_at desc
   limit p_limit;
$$;

create or replace function public.top_fans(p_artist uuid, p_limit integer default 10)
returns table (user_id uuid, username text, display_name text, avatar_url text, xp integer)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.username, p.display_name, p.avatar_url, f.xp
    from public.fan_scores f join public.profiles p on p.id = f.user_id
   where f.artist_id = p_artist and f.xp > 0
   order by f.xp desc limit p_limit;
$$;

create or replace function public.global_ranking(p_days integer default null, p_limit integer default 50)
returns table (user_id uuid, username text, display_name text, avatar_url text, xp bigint, total_xp integer)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.username, p.display_name, p.avatar_url,
         case when p_days is null then p.xp::bigint
              else coalesce((select sum(l.points) from public.points_ledger l where l.user_id = p.id and l.created_at > now() - make_interval(days => p_days)), 0) end as xp,
         p.xp
    from public.profiles p
   where p.xp > 0
   order by 5 desc limit p_limit;
$$;

-- Busca com tolerância a erro de digitação
create or replace function public.search_catalog(q text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'artists', coalesce((select jsonb_agg(x) from (
        select a.id, a.slug, a.name, a.avatar_path, a.verified, a.genre
          from public.artists a
         where a.name ilike '%' || q || '%' or word_similarity(q, a.name) > 0.4
         order by word_similarity(q, a.name) desc limit 8) x), '[]'::jsonb),
    'releases', coalesce((select jsonb_agg(x) from (
        select r.id, r.slug, r.title, r.cover_path, r.kind, a.slug as artist_slug, a.name as artist_name
          from public.releases r join public.artists a on a.id = r.artist_id
         where public.release_is_public(r.status, r.publish_at)
           and (r.title ilike '%' || q || '%' or word_similarity(q, r.title) > 0.4 or word_similarity(q, a.name) > 0.45)
         order by greatest(word_similarity(q, r.title), word_similarity(q, a.name)) desc, r.publish_at desc limit 12) x), '[]'::jsonb),
    'tracks', coalesce((select jsonb_agg(x) from (
        select t.id, t.title, t.duration_sec, t.hls_path, r.slug as release_slug, r.title as release_title, r.cover_path,
               a.slug as artist_slug, a.name as artist_name
          from public.tracks t join public.releases r on r.id = t.release_id join public.artists a on a.id = t.artist_id
         where t.status = 'ready' and public.release_is_public(r.status, r.publish_at)
           and (t.title ilike '%' || q || '%' or word_similarity(q, t.title) > 0.45)
         order by word_similarity(q, t.title) desc limit 12) x), '[]'::jsonb)
  );
$$;

-- Painel do artista
create or replace function public.artist_dashboard(p_artist uuid, p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_from date := (now() at time zone 'America/Bahia')::date - p_days + 1;
  res jsonb;
begin
  if not public.is_artist_member(p_artist) then raise exception 'sem acesso'; end if;
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'plays', coalesce((select sum(plays) from public.track_stats_daily where artist_id = p_artist and day >= v_from), 0),
      'completes', coalesce((select sum(completes) from public.track_stats_daily where artist_id = p_artist and day >= v_from), 0),
      'downloads', coalesce((select sum(downloads) from public.track_stats_daily where artist_id = p_artist and day >= v_from), 0),
      'listeners', (select count(distinct coalesce(user_id::text, anon_id)) from public.play_events where artist_id = p_artist and counted and created_at >= v_from),
      'followers', (select count(*) from public.follows where artist_id = p_artist),
      'plays_all_time', coalesce((select sum(plays) from public.track_stats_daily where artist_id = p_artist), 0)
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', g.day, 'plays', coalesce(s.plays, 0)) order by g.day)
                         from generate_series(v_from, (now() at time zone 'America/Bahia')::date, interval '1 day') as g(day)
                         left join (select day, sum(plays) as plays from public.track_stats_daily where artist_id = p_artist and day >= v_from group by day) s
                           on s.day = g.day::date), '[]'::jsonb),
    'hours', coalesce((select jsonb_agg(jsonb_build_object('hour', h, 'plays', c) order by h) from (
                 select extract(hour from created_at at time zone 'America/Bahia')::int as h, count(*) as c
                   from public.play_events where artist_id = p_artist and counted and created_at >= v_from group by 1) x), '[]'::jsonb),
    'top_tracks', coalesce((select jsonb_agg(x) from (
                 select t.id, t.title, r.title as release_title, sum(s.plays) as plays, sum(s.completes) as completes,
                        round(100.0 * sum(s.completes) / nullif(sum(s.plays), 0)) as completion_pct
                   from public.track_stats_daily s join public.tracks t on t.id = s.track_id join public.releases r on r.id = t.release_id
                  where s.artist_id = p_artist and s.day >= v_from
                  group by t.id, r.title order by plays desc limit 10) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(x) from (
                 select coalesce(nullif(source, ''), 'direto') as source, count(*) as plays
                   from public.play_events where artist_id = p_artist and counted and created_at >= v_from
                  group by 1 order by 2 desc limit 8) x), '[]'::jsonb),
    'top_fans', coalesce((select jsonb_agg(x) from public.top_fans(p_artist, 10) x), '[]'::jsonb)
  ) into res;
  return res;
end $$;
