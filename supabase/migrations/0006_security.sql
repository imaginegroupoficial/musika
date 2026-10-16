-- Musika fase 2: RLS e permissões

alter table public.settings enable row level security;
alter table public.payments enable row level security;
alter table public.fanclub_plans enable row level security;
alter table public.fanclub_members enable row level security;
alter table public.artist_posts enable row level security;
alter table public.artist_earnings enable row level security;
alter table public.boosts enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_events enable row level security;
alter table public.events enable row level security;
alter table public.checkins enable row level security;
alter table public.missions enable row level security;
alter table public.mission_progress enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.artist_invites enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_members enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;

-- perfil: is_admin e premium_until só mudam pelo servidor (o grant de update por coluna da 0003 continua valendo)

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (key <> 'admin_emails' or public.is_admin());

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists fanclub_plans_read on public.fanclub_plans;
create policy fanclub_plans_read on public.fanclub_plans for select using (true);
drop policy if exists fanclub_plans_write on public.fanclub_plans;
create policy fanclub_plans_write on public.fanclub_plans for all using (public.is_artist_member(artist_id)) with check (public.is_artist_member(artist_id));

drop policy if exists fanclub_members_read on public.fanclub_members;
create policy fanclub_members_read on public.fanclub_members for select using (user_id = auth.uid() or public.is_artist_member(artist_id) or public.is_admin());

drop policy if exists posts_read on public.artist_posts;
create policy posts_read on public.artist_posts for select
  using (not fanclub_only or public.is_fanclub_member(artist_id) or public.is_artist_member(artist_id));
drop policy if exists posts_write on public.artist_posts;
create policy posts_write on public.artist_posts for insert with check (public.is_artist_member(artist_id) and author_id = auth.uid());
drop policy if exists posts_delete on public.artist_posts;
create policy posts_delete on public.artist_posts for delete using (public.is_artist_member(artist_id));

drop policy if exists earnings_read on public.artist_earnings;
create policy earnings_read on public.artist_earnings for select using (public.is_artist_member(artist_id) or public.is_admin());

drop policy if exists boosts_read on public.boosts;
create policy boosts_read on public.boosts for select using (public.is_artist_member(artist_id) or public.is_admin());
drop policy if exists boosts_insert on public.boosts;
create policy boosts_insert on public.boosts for insert with check (
  public.is_artist_member(artist_id) and status = 'pending_payment' and created_by = auth.uid()
  and exists (select 1 from public.releases r where r.id = release_id and r.artist_id = boosts.artist_id)
  and amount_cents = days * ((public.setting('boost_day_cents')) ->> placement)::integer
);
drop policy if exists boosts_delete on public.boosts;
create policy boosts_delete on public.boosts for delete using (public.is_artist_member(artist_id) and status = 'pending_payment');

drop policy if exists campaigns_read on public.ad_campaigns;
create policy campaigns_read on public.ad_campaigns for select using (owner_id = auth.uid() or public.is_admin());
drop policy if exists campaigns_insert on public.ad_campaigns;
create policy campaigns_insert on public.ad_campaigns for insert with check (
  owner_id = auth.uid() and status = 'draft' and spent_cents = 0
  and cpm_cents = (public.setting(case when kind = 'audio' then 'cpm_audio_cents' else 'cpm_banner_cents' end))::text::integer
);
drop policy if exists campaigns_update on public.ad_campaigns;
create policy campaigns_update on public.ad_campaigns for update
  using (owner_id = auth.uid() and status in ('draft', 'rejected', 'pending_payment'))
  with check (owner_id = auth.uid() and status in ('draft', 'rejected', 'pending_payment'));
drop policy if exists campaigns_delete on public.ad_campaigns;
create policy campaigns_delete on public.ad_campaigns for delete using (owner_id = auth.uid() and status in ('draft', 'rejected', 'pending_payment'));
revoke update on public.ad_campaigns from anon, authenticated;
grant update (name, advertiser, media_path, duration_sec, headline, click_url, target_genres, target_ufs, budget_cents, starts_at, ends_at) on public.ad_campaigns to authenticated;

drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (true);
drop policy if exists events_write on public.events;
create policy events_write on public.events for all using (public.is_artist_member(artist_id)) with check (public.is_artist_member(artist_id));
-- o segredo do QR nunca sai do banco
revoke select on public.events from anon, authenticated;
grant select (id, artist_id, title, venue, city, uf, starts_at, ticket_url, created_at) on public.events to anon, authenticated;
revoke update on public.events from anon, authenticated;
grant update (title, venue, city, uf, starts_at, ticket_url) on public.events to authenticated;

drop policy if exists checkins_read on public.checkins;
create policy checkins_read on public.checkins for select using (
  user_id = auth.uid() or exists (select 1 from public.events e where e.id = event_id and public.is_artist_member(e.artist_id))
);

drop policy if exists missions_read on public.missions;
create policy missions_read on public.missions for select using (true);
drop policy if exists missions_write on public.missions;
create policy missions_write on public.missions for all using (public.is_artist_member(artist_id)) with check (public.is_artist_member(artist_id));

drop policy if exists mission_progress_read on public.mission_progress;
create policy mission_progress_read on public.mission_progress for select using (user_id = auth.uid());

drop policy if exists rewards_read on public.rewards;
create policy rewards_read on public.rewards for select using (active or public.is_artist_member(artist_id));
drop policy if exists rewards_write on public.rewards;
create policy rewards_write on public.rewards for all using (public.is_artist_member(artist_id)) with check (public.is_artist_member(artist_id));

drop policy if exists redemptions_read on public.redemptions;
create policy redemptions_read on public.redemptions for select using (user_id = auth.uid() or public.is_artist_member(artist_id));

drop policy if exists invites_read on public.artist_invites;
create policy invites_read on public.artist_invites for select using (public.is_artist_member(artist_id));

drop policy if exists playlists_read on public.playlists;
create policy playlists_read on public.playlists for select using (is_public or owner_id = auth.uid() or public.can_edit_playlist(id));
drop policy if exists playlists_insert on public.playlists;
create policy playlists_insert on public.playlists for insert with check (owner_id = auth.uid());
drop policy if exists playlists_update on public.playlists;
create policy playlists_update on public.playlists for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists playlists_delete on public.playlists;
create policy playlists_delete on public.playlists for delete using (owner_id = auth.uid());

drop policy if exists pm_read on public.playlist_members;
create policy pm_read on public.playlist_members for select using (public.can_view_playlist(playlist_id));

drop policy if exists pt_read on public.playlist_tracks;
create policy pt_read on public.playlist_tracks for select using (public.can_view_playlist(playlist_id));
drop policy if exists pt_insert on public.playlist_tracks;
create policy pt_insert on public.playlist_tracks for insert with check (public.can_edit_playlist(playlist_id) and added_by = auth.uid());
drop policy if exists pt_update on public.playlist_tracks;
create policy pt_update on public.playlist_tracks for update using (public.can_edit_playlist(playlist_id));
drop policy if exists pt_delete on public.playlist_tracks;
create policy pt_delete on public.playlist_tracks for delete using (public.can_edit_playlist(playlist_id));

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select using (not hidden or public.is_admin());
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert with check (user_id = auth.uid() and not hidden);
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete using (
  user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.releases r where r.id = release_id and public.is_artist_member(r.artist_id))
);

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (user_id = auth.uid() and status = 'open');
drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select using (public.is_admin());

-- letra da música: o artista edita
grant update (title, position, lyrics) on public.tracks to authenticated;

-- grants das tabelas novas
grant select on public.settings, public.fanclub_plans, public.artist_posts, public.missions, public.rewards,
  public.playlists, public.playlist_tracks, public.playlist_members, public.comments to anon, authenticated;
grant select on public.payments, public.fanclub_members, public.artist_earnings, public.boosts, public.ad_campaigns,
  public.checkins, public.mission_progress, public.redemptions, public.artist_invites, public.reports to authenticated;
grant insert, update, delete on public.fanclub_plans, public.missions, public.rewards, public.playlists, public.playlist_tracks to authenticated;
grant insert, delete on public.artist_posts, public.boosts, public.ad_campaigns, public.comments, public.events to authenticated;
grant insert on public.reports to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant usage on all sequences in schema public to authenticated;

-- funções: ninguém executa por padrão; libera uma a uma
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_artist_member(uuid) to anon, authenticated, service_role;
grant execute on function public.release_is_public(text, timestamptz) to anon, authenticated, service_role;
grant execute on function public.level_info(integer) to anon, authenticated, service_role;
grant execute on function public.setting(text) to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_premium(uuid) to anon, authenticated, service_role;
grant execute on function public.is_fanclub_member(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.can_edit_playlist(uuid) to anon, authenticated, service_role;
grant execute on function public.can_view_playlist(uuid) to anon, authenticated, service_role;
grant execute on function public.create_artist(text, text, text, text, text) to authenticated;
grant execute on function public.record_play(uuid, integer, text, text, text) to anon, authenticated;
grant execute on function public.top_releases(integer, integer, text) to anon, authenticated;
grant execute on function public.top_tracks(integer, integer) to anon, authenticated;
grant execute on function public.trending_releases(integer) to anon, authenticated;
grant execute on function public.top_fans(uuid, integer) to anon, authenticated;
grant execute on function public.global_ranking(integer, integer) to anon, authenticated;
grant execute on function public.search_catalog(text) to anon, authenticated;
grant execute on function public.artist_dashboard(uuid, integer) to authenticated;
grant execute on function public.event_checkin_code(uuid) to authenticated;
grant execute on function public.event_checkin(uuid, text) to authenticated;
grant execute on function public.event_checkin_by_code(text) to authenticated;
grant execute on function public.redeem_reward(uuid, text) to authenticated;
grant execute on function public.set_redemption_status(uuid, text) to authenticated;
grant execute on function public.create_invite(uuid, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.join_playlist(uuid) to authenticated;
grant execute on function public.serve_ad(text, text, text, text) to anon, authenticated;
grant execute on function public.ad_event(uuid, text, text) to anon, authenticated;
grant execute on function public.campaign_report(uuid) to authenticated;
grant execute on function public.submit_campaign(uuid) to authenticated;
grant execute on function public.set_campaign_paused(uuid, boolean) to authenticated;
grant execute on function public.active_boosts(text) to anon, authenticated;
grant execute on function public.boost_impression(uuid[]) to anon, authenticated;
grant execute on function public.boost_click(uuid) to anon, authenticated;
grant execute on function public.prepare_payment(text, uuid, jsonb) to authenticated;
grant execute on function public.apply_payment(uuid) to authenticated, service_role;
grant execute on function public.admin_review_campaign(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;
grant execute on function public.admin_resolve_report(uuid, boolean) to authenticated;
grant execute on function public.admin_mark_payout(uuid) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.my_wrapped(date, date) to authenticated;
grant execute on function public.artist_money(uuid) to authenticated;
grant execute on function public.end_expired() to service_role;
grant execute on function public.claim_transcode_job() to service_role;
grant execute on function public.finish_transcode_job(bigint, boolean, numeric, text, text) to service_role;
grant execute on function public.count_download(uuid) to service_role;
grant execute on function public.award_points(uuid, uuid, text, integer, text) to service_role;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- funções futuras não ficam abertas por padrão
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- storage: anúncios (áudio curto e banner) e imagens do mural
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ads', 'ads', true, 10485760, array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true;

drop policy if exists musika_ads_insert on storage.objects;
create policy musika_ads_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists musika_ads_read on storage.objects;
create policy musika_ads_read on storage.objects for select using (bucket_id = 'ads');
