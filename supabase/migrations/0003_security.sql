-- Musika: RLS, permissões e storage

alter table public.profiles enable row level security;
alter table public.artists enable row level security;
alter table public.artist_members enable row level security;
alter table public.releases enable row level security;
alter table public.tracks enable row level security;
alter table public.transcode_jobs enable row level security;
alter table public.play_events enable row level security;
alter table public.track_stats_daily enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.points_ledger enable row level security;
alter table public.fan_scores enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public._musika_migrations enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- xp, streak e last_active só mudam pelas funções do servidor
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, avatar_url, city, uf) on public.profiles to authenticated;

drop policy if exists artists_read on public.artists;
create policy artists_read on public.artists for select using (true);
drop policy if exists artists_update on public.artists;
create policy artists_update on public.artists for update using (public.is_artist_member(id)) with check (public.is_artist_member(id));
revoke update on public.artists from anon, authenticated;
grant update (name, genre, city, uf, bio, avatar_path, booking_whatsapp, instagram) on public.artists to authenticated;

drop policy if exists members_read on public.artist_members;
create policy members_read on public.artist_members for select using (user_id = auth.uid() or public.is_artist_member(artist_id));

drop policy if exists releases_read on public.releases;
create policy releases_read on public.releases for select
  using (public.release_is_public(status, publish_at) or public.is_artist_member(artist_id));
drop policy if exists releases_insert on public.releases;
create policy releases_insert on public.releases for insert with check (public.is_artist_member(artist_id) and status = 'draft');
drop policy if exists releases_update on public.releases;
create policy releases_update on public.releases for update using (public.is_artist_member(artist_id)) with check (public.is_artist_member(artist_id));
drop policy if exists releases_delete on public.releases;
create policy releases_delete on public.releases for delete using (public.is_artist_member(artist_id));
revoke update on public.releases from anon, authenticated;
grant update (title, kind, genre, cover_path, publish_at, download_allowed) on public.releases to authenticated;

drop policy if exists tracks_read on public.tracks;
create policy tracks_read on public.tracks for select using (
  public.is_artist_member(artist_id)
  or (status = 'ready' and exists (select 1 from public.releases r where r.id = release_id and public.release_is_public(r.status, r.publish_at)))
);
drop policy if exists tracks_insert on public.tracks;
create policy tracks_insert on public.tracks for insert with check (
  public.is_artist_member(artist_id) and status = 'pending' and hls_path is null
  and exists (select 1 from public.releases r where r.id = release_id and r.artist_id = tracks.artist_id)
);
drop policy if exists tracks_update on public.tracks;
create policy tracks_update on public.tracks for update using (public.is_artist_member(artist_id));
drop policy if exists tracks_delete on public.tracks;
create policy tracks_delete on public.tracks for delete using (public.is_artist_member(artist_id));
revoke update on public.tracks from anon, authenticated;
grant update (title, position) on public.tracks to authenticated;

drop policy if exists stats_read on public.track_stats_daily;
create policy stats_read on public.track_stats_daily for select using (true);

drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select using (true);
drop policy if exists follows_write on public.follows;
create policy follows_write on public.follows for insert with check (user_id = auth.uid());
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete using (user_id = auth.uid());

drop policy if exists likes_read on public.likes;
create policy likes_read on public.likes for select using (user_id = auth.uid());
drop policy if exists likes_write on public.likes;
create policy likes_write on public.likes for insert with check (user_id = auth.uid());
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete using (user_id = auth.uid());

drop policy if exists ledger_read on public.points_ledger;
create policy ledger_read on public.points_ledger for select using (user_id = auth.uid());

drop policy if exists fan_scores_read on public.fan_scores;
create policy fan_scores_read on public.fan_scores for select using (true);

drop policy if exists badges_read on public.badges;
create policy badges_read on public.badges for select using (true);
drop policy if exists user_badges_read on public.user_badges;
create policy user_badges_read on public.user_badges for select using (true);

-- transcode_jobs, play_events e _musika_migrations: sem política = só service_role

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant insert, delete on public.releases, public.tracks, public.follows, public.likes to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant usage on all sequences in schema public to authenticated;

-- funções
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_artist_member(uuid) to anon, authenticated, service_role;
grant execute on function public.release_is_public(text, timestamptz) to anon, authenticated, service_role;
grant execute on function public.level_info(integer) to anon, authenticated, service_role;
grant execute on function public.create_artist(text, text, text, text, text) to authenticated;
grant execute on function public.record_play(uuid, integer, text, text, text) to anon, authenticated;
grant execute on function public.top_releases(integer, integer, text) to anon, authenticated;
grant execute on function public.top_tracks(integer, integer) to anon, authenticated;
grant execute on function public.trending_releases(integer) to anon, authenticated;
grant execute on function public.top_fans(uuid, integer) to anon, authenticated;
grant execute on function public.global_ranking(integer, integer) to anon, authenticated;
grant execute on function public.search_catalog(text) to anon, authenticated;
grant execute on function public.artist_dashboard(uuid, integer) to authenticated;
grant execute on function public.claim_transcode_job() to service_role;
grant execute on function public.finish_transcode_job(bigint, boolean, numeric, text, text) to service_role;
grant execute on function public.count_download(uuid) to service_role;
grant execute on function public.award_points(uuid, uuid, text, integer, text) to service_role;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- Storage: uploads privados (originais) e capas públicas
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', false, 524288000)
on conflict (id) do update set public = false, file_size_limit = 524288000;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists musika_uploads_insert on storage.objects;
create policy musika_uploads_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and public.is_artist_member(((storage.foldername(name))[1])::uuid));
drop policy if exists musika_uploads_read on storage.objects;
create policy musika_uploads_read on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and public.is_artist_member(((storage.foldername(name))[1])::uuid));
drop policy if exists musika_uploads_delete on storage.objects;
create policy musika_uploads_delete on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and public.is_artist_member(((storage.foldername(name))[1])::uuid));

drop policy if exists musika_covers_insert on storage.objects;
create policy musika_covers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and public.is_artist_member(((storage.foldername(name))[1])::uuid));
drop policy if exists musika_covers_update on storage.objects;
create policy musika_covers_update on storage.objects for update to authenticated
  using (bucket_id = 'covers' and public.is_artist_member(((storage.foldername(name))[1])::uuid));
drop policy if exists musika_covers_read on storage.objects;
create policy musika_covers_read on storage.objects for select using (bucket_id = 'covers');
