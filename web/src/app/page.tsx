import Link from 'next/link';
import { getSessionProfile } from '@/lib/supabase/server';
import { latestReleases, likedIds, releaseTracks } from '@/lib/queries';
import { ReleaseRow, Cover } from '@/components/ReleaseCard';
import TrackList, { PlayAllButton } from '@/components/TrackList';
import { formatCount } from '@/lib/media';
import type { ReleaseCardData } from '@/lib/types';
import type { TrackRow } from '@/lib/tracks';

export const revalidate = 0;

export default async function Home() {
  const { supabase, user } = await getSessionProfile();
  const [trending, topWeek, latest, topTracks, artists] = await Promise.all([
    supabase.rpc('trending_releases', { p_limit: 12 }),
    supabase.rpc('top_releases', { p_days: 7, p_limit: 12, p_genre: null }),
    latestReleases(supabase, 12),
    supabase.rpc('top_tracks', { p_days: 7, p_limit: 10 }),
    supabase.from('artists').select('id, slug, name, genre, city, uf, verified').order('created_at', { ascending: false }).limit(8),
  ]);

  const trendingItems = (trending.data || []) as ReleaseCardData[];
  const hero = trendingItems[0] || (latest[0] as ReleaseCardData | undefined);

  if (!hero) {
    return (
      <section className="mx-auto max-w-2xl py-16">
        <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">O paredão ainda está montando.</h1>
        <p className="mt-6 max-w-[56ch] text-lg text-nevoa">
          Nenhum CD publicado por enquanto. Se você é artista, suba seu repertório agora: o primeiro lançamento aparece aqui no topo da página.
        </p>
        <Link href="/studio" className="mt-8 inline-flex h-12 items-center rounded-full bg-sol px-6 font-semibold text-noite">
          Publicar meu CD
        </Link>
      </section>
    );
  }

  const heroId = (hero.release_id || hero.id) as string;
  const heroTracks = await releaseTracks(supabase, heroId, hero);
  const tracks = ((topTracks.data || []) as TrackRow[]).filter((t) => t.plays && t.plays > 0);
  const liked = await likedIds(supabase, user?.id, tracks.map((t) => t.id));

  return (
    <>
      <section className="grid items-end gap-6 md:grid-cols-[minmax(0,320px)_1fr] md:gap-10">
        <Link href={`/${hero.artist_slug}/${hero.slug}`} className="block w-56 md:w-auto md:max-w-[320px]">
          <Cover path={hero.cover_path} title={hero.title} />
        </Link>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-chita">Estourando agora</p>
          <h1 className="mt-2 font-display text-[clamp(2.75rem,8vw,6.5rem)] font-extrabold leading-[0.9] tracking-tight">
            <Link href={`/${hero.artist_slug}`} className="hover:text-sol">{hero.artist_name}</Link>
          </h1>
          <p className="mt-3 text-xl text-nevoa">
            <Link href={`/${hero.artist_slug}/${hero.slug}`} className="hover:text-luar">{hero.title}</Link>
            {hero.plays_recent ? <span className="ml-2 text-base">{formatCount(hero.plays_recent as number)} plays em 48 h</span> : null}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <PlayAllButton tracks={heroTracks} source="home" label="Tocar o CD" />
            <Link href={`/${hero.artist_slug}/${hero.slug}`} className="inline-flex h-12 items-center rounded-full border border-luar/40 px-6 font-semibold hover:border-luar">
              Ver faixas
            </Link>
          </div>
        </div>
      </section>

      <ReleaseRow title="Estourados" items={trendingItems.slice(1)} />
      <ReleaseRow title="Mais ouvidos da semana" href="/top" items={(topWeek.data || []).filter((r: ReleaseCardData) => (r.plays || 0) > 0)} ranked />
      <ReleaseRow title="Acabou de sair" items={latest} />

      {tracks.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-2xl font-bold tracking-tight">Faixas mais tocadas</h2>
          <TrackList tracks={tracks} liked={liked} loggedIn={!!user} showArtist source="top-faixas" />
        </section>
      )}

      {(artists.data || []).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">Artistas novos no Musika</h2>
          <div className="flex flex-wrap gap-2">
            {(artists.data || []).map((a) => (
              <Link key={a.id} href={`/${a.slug}`} className="rounded-full bg-lona px-4 py-2 font-medium hover:bg-palco">
                {a.name}
                {a.city ? <span className="ml-2 text-sm text-nevoa">{a.city}{a.uf ? `/${a.uf}` : ''}</span> : null}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
