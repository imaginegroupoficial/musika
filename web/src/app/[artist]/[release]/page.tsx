import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import { likedIds, releaseTracks } from '@/lib/queries';
import { Cover } from '@/components/ReleaseCard';
import TrackList, { PlayAllButton } from '@/components/TrackList';
import ShareButton from '@/components/ShareButton';
import { CheckBadge } from '@/components/Icons';
import Comments from '@/components/Comments';
import AdBanner from '@/components/AdBanner';
import ReportButton from '@/components/ReportButton';
import { getSite } from '@/lib/site';
import { coverUrl, formatCount, formatDuration, kindLabel } from '@/lib/media';

type Props = { params: { artist: string; release: string }; searchParams?: { b?: string } };

async function load(params: Props['params']) {
  const { supabase, user, profile } = await getSessionProfile();
  const { data: artist } = await supabase.from('artists').select('id, slug, name, verified, genre').eq('slug', params.artist).maybeSingle();
  if (!artist) return null;
  const { data: release } = await supabase.from('releases').select('*').eq('artist_id', artist.id).eq('slug', params.release).maybeSingle();
  if (!release) return null;
  return { supabase, user, profile, artist, release };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load(params);
  if (!d) return { title: 'Lançamento não encontrado' };
  const img = coverUrl(d.release.cover_path);
  return {
    title: `${d.release.title}, ${d.artist.name}`,
    description: `Ouça e baixe grátis ${d.release.title} de ${d.artist.name} no Musika.`,
    openGraph: { images: img ? [img] : [], type: 'music.album' },
  };
}

export default async function ReleasePage({ params, searchParams }: Props) {
  const d = await load(params);
  if (!d) notFound();
  if (searchParams?.b && /^[0-9a-f-]{36}$/i.test(searchParams.b)) await d.supabase.rpc('boost_click', { p_id: searchParams.b });
  const { supabase, user, profile, artist, release } = d;
  const isPublic = release.status === 'ready' && new Date(release.publish_at) <= new Date();

  const tracks = await releaseTracks(supabase, release.id, {
    slug: release.slug,
    title: release.title,
    cover_path: release.cover_path,
    artist_slug: artist.slug,
    artist_name: artist.name,
  });
  tracks.forEach((t) => { t.genre = release.genre || artist.genre; });
  const { data: team } = user ? await supabase.from('artist_members').select('role').eq('artist_id', artist.id).eq('user_id', user.id).maybeSingle() : { data: null };
  const { data: stats } = await supabase.from('track_stats_daily').select('track_id, plays').eq('release_id', release.id);
  const playsBy = new Map<string, number>();
  (stats || []).forEach((s) => playsBy.set(s.track_id, (playsBy.get(s.track_id) || 0) + s.plays));
  const withPlays = tracks.map((t) => ({ ...t, plays: playsBy.get(t.id) || 0 }));
  const total = [...playsBy.values()].reduce((a, b) => a + b, 0);
  const totalSec = tracks.reduce((a, t) => a + Number(t.duration_sec || 0), 0);
  const liked = await likedIds(supabase, user?.id, tracks.map((t) => t.id));
  const hoursSincePublish = (Date.now() - new Date(release.publish_at).getTime()) / 36e5;

  return (
    <>
      {!isPublic && (
        <p className="mb-6 rounded-capa border border-sol/40 bg-sol/10 px-4 py-3 text-sm">
          Só você e sua equipe veem esta página.{' '}
          {release.status === 'processing' ? 'As faixas ainda estão sendo convertidas.' : release.status === 'ready' ? `Publicação agendada para ${new Date(release.publish_at).toLocaleString('pt-BR')}.` : release.status === 'error' ? 'Houve erro na conversão de todas as faixas.' : ''}
        </p>
      )}
      <header className="grid items-end gap-6 md:grid-cols-[280px_1fr] md:gap-10">
        <div className="max-w-[280px]"><Cover path={release.cover_path} title={release.title} /></div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-nevoa">{kindLabel[release.kind] || 'CD'}</p>
          <h1 className="mt-1 font-display text-[clamp(2.25rem,6vw,4.75rem)] font-extrabold leading-[0.92] tracking-tight">{release.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 text-nevoa">
            <Link href={`/${artist.slug}`} className="flex items-center gap-1 font-semibold text-luar hover:underline">
              {artist.name}
              {artist.verified && <CheckBadge className="h-4 w-4 text-sol" />}
            </Link>
            <span>
              {tracks.length} faixas, {formatDuration(totalSec)}
              {total ? `, ${formatCount(total)} plays` : ''}
            </span>
          </p>
          {isPublic && hoursSincePublish < 48 && (
            <p className="mt-3 inline-block rounded-full bg-mandacaru/15 px-3 py-1 text-sm font-semibold text-mandacaru">
              {(await getSite()).texts.cd_early_bonus}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <PlayAllButton tracks={withPlays} source={`cd:${release.slug}`} />
            {isPublic && <ShareButton path={`/${artist.slug}/${release.slug}`} title={`${release.title}, ${artist.name}`} username={profile?.username} storyHref={`/api/story/${release.id}`} />}
          </div>
        </div>
      </header>

      <section className="mt-10">
        <TrackList tracks={withPlays} liked={liked} loggedIn={!!user} downloads={release.download_allowed && isPublic} source={`cd:${release.slug}`} />
      </section>
      <AdBanner context={`cd:${release.slug}`} genre={release.genre || artist.genre} />
      {isPublic && <Comments releaseId={release.id} userId={user?.id ?? null} canModerate={!!team || !!profile?.is_admin} trackTitles={Object.fromEntries(tracks.map((t) => [t.id, t.title]))} />}
      {isPublic && user && <div className="mt-8"><ReportButton kind="release" id={release.id} label="Denunciar este lançamento" /></div>}
    </>
  );
}
