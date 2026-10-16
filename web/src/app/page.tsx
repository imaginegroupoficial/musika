import Link from 'next/link';
import { getSessionProfile } from '@/lib/supabase/server';
import { latestReleases, likedIds, releaseTracks } from '@/lib/queries';
import { ReleaseRow, Cover } from '@/components/ReleaseCard';
import TrackList, { PlayAllButton } from '@/components/TrackList';
import { formatCount } from '@/lib/media';
import type { ReleaseCardData } from '@/lib/types';
import type { TrackRow } from '@/lib/tracks';
import AdBanner from '@/components/AdBanner';
import HouseCarousel from '@/components/HouseCarousel';
import { getSite } from '@/lib/site';
import { adMediaUrl } from '@/lib/media';

export const revalidate = 0;

export default async function Home() {
  const { supabase, user } = await getSessionProfile();
  const { texts: t } = await getSite();
  const [trending, topWeek, latest, topTracks, artists, heroBoost, rowBoost, house] = await Promise.all([
    supabase.rpc('trending_releases', { p_limit: 12 }),
    supabase.rpc('top_releases', { p_days: 7, p_limit: 12, p_genre: null }),
    latestReleases(supabase, 12),
    supabase.rpc('top_tracks', { p_days: 7, p_limit: 10 }),
    supabase.from('artists').select('id, slug, name, genre, city, uf, verified').order('created_at', { ascending: false }).limit(8),
    supabase.rpc('active_boosts', { p_placement: 'home_hero' }),
    supabase.rpc('active_boosts', { p_placement: 'home_row' }),
    supabase.from('house_banners').select('id, title, subtitle, cta, image_path, link_url').eq('placement', 'carrossel').eq('active', true).order('position'),
  ]);
  const carousel = (house.data || []).map((b) => ({ ...b, image_url: adMediaUrl(b.image_path) }));
  type Boosted = ReleaseCardData & { boost_id: string };
  const heroB = ((heroBoost.data || []) as Boosted[])[0];
  const rowB = (rowBoost.data || []) as Boosted[];
  const shownBoosts = [heroB?.boost_id, ...rowB.map((b) => b.boost_id)].filter(Boolean);
  if (shownBoosts.length) await supabase.rpc('boost_impression', { p_ids: shownBoosts });

  const trendingItems = (trending.data || []) as ReleaseCardData[];
  const hero = heroB || trendingItems[0] || (latest[0] as ReleaseCardData | undefined);

  if (!hero) {
    return (
      <>
        <HouseCarousel banners={carousel} />
        <section className="rounded-[28px] bg-sol px-6 py-12 text-noite md:px-12 md:py-16">
          <h1 className="cartaz max-w-[14ch] text-[clamp(2.75rem,8vw,6.5rem)]">{t.home_empty_title}</h1>
          <p className="mt-6 max-w-[56ch] text-lg font-medium opacity-90">{t.home_empty_text}</p>
          <Link href="/studio" className="mt-8 inline-flex h-12 items-center rounded-full bg-noite px-6 font-semibold text-sol">{t.home_empty_cta}</Link>
        </section>
        <AdBanner context="home" />
      </>
    );
  }

  const heroId = (hero.release_id || hero.id) as string;
  const heroTracks = await releaseTracks(supabase, heroId, hero);
  const tracks = ((topTracks.data || []) as TrackRow[]).filter((t) => t.plays && t.plays > 0);
  const liked = await likedIds(supabase, user?.id, tracks.map((t) => t.id));

  return (
    <>
      <HouseCarousel banners={carousel} />
      <section className="relative grid gap-6 overflow-hidden rounded-[28px] bg-sol p-6 text-noite md:grid-cols-[1fr_minmax(0,300px)] md:items-end md:gap-10 md:p-10">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-noite/15 px-3 py-1 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-chita" aria-hidden />
            {heroB ? 'Patrocinado' : t.home_hero_label}
          </span>
          <h1 className="cartaz mt-5 text-[clamp(2.75rem,7.5vw,6.75rem)]">
            <Link href={`/${hero.artist_slug}`} className="hover:underline hover:decoration-4 hover:underline-offset-8">{hero.artist_name}</Link>
          </h1>
          <p className="mt-4 text-xl font-medium">
            <Link href={`/${hero.artist_slug}/${hero.slug}`} className="hover:underline">{hero.title}</Link>
            {hero.plays_recent ? <span className="ml-2 text-base opacity-80">{formatCount(hero.plays_recent as number)} plays em 48 h</span> : null}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <PlayAllButton tracks={heroTracks} source="home" label={t.home_hero_play} className="inline-flex h-12 items-center gap-2 rounded-full bg-noite px-6 font-semibold text-sol transition-transform active:scale-95 disabled:opacity-40" />
            <Link href={`/${hero.artist_slug}/${hero.slug}`} className="inline-flex h-12 items-center rounded-full border-2 border-noite/40 px-6 font-semibold hover:border-noite">
              Ver faixas
            </Link>
          </div>
        </div>
        <Link href={heroB ? `/${hero.artist_slug}/${hero.slug}?b=${heroB.boost_id}&utm_source=patrocinado` : `/${hero.artist_slug}/${hero.slug}`} className="block w-48 rotate-[-3deg] justify-self-end md:w-full md:max-w-[300px]">
          <Cover path={hero.cover_path} title={hero.title} className="ring-4 ring-noite/20" />
        </Link>
      </section>

      <ReleaseRow title={t.home_row_trending} items={heroB ? trendingItems : trendingItems.slice(1)} />
      <ReleaseRow title={t.home_row_sponsored} items={rowB} />
      <AdBanner context="home" />
      <ReleaseRow title={t.home_row_top} href="/top" items={(topWeek.data || []).filter((r: ReleaseCardData) => (r.plays || 0) > 0)} ranked />
      <ReleaseRow title={t.home_row_latest} items={latest} />

      {tracks.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-2xl font-bold tracking-tight">{t.home_tracks_title}</h2>
          <TrackList tracks={tracks} liked={liked} loggedIn={!!user} showArtist source="top-faixas" />
        </section>
      )}

      {(artists.data || []).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">{t.home_artists_title}</h2>
          <div className="flex flex-wrap gap-2">
            {(artists.data || []).map((a) => (
              <Link key={a.id} href={`/${a.slug}`} className="rounded-full border border-palco bg-lona px-4 py-2 font-medium hover:border-sol">
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
