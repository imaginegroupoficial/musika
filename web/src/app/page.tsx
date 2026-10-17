import Link from 'next/link';
import { getSessionProfile } from '@/lib/supabase/server';
import { latestReleases, likedIds, releaseTracks } from '@/lib/queries';
import { ReleaseRow, Cover } from '@/components/ReleaseCard';
import { coverUrl } from '@/lib/media';
import TrackList, { PlayAllButton } from '@/components/TrackList';
import { formatCount } from '@/lib/media';
import type { ReleaseCardData } from '@/lib/types';
import type { TrackRow } from '@/lib/tracks';
import AdBanner from '@/components/AdBanner';
import HouseCarousel from '@/components/HouseCarousel';
import { getSite } from '@/lib/site';
import { adMediaUrl } from '@/lib/media';
import ParedaoArt from '@/components/ParedaoArt';
import { GENRES } from '@/lib/labels';

export const revalidate = 0;

export default async function Home() {
  const { supabase, user } = await getSessionProfile();
  const { texts: t } = await getSite();
  const [trending, topWeek, latest, topTracks, artists, heroBoost, rowBoost, house] = await Promise.all([
    supabase.rpc('trending_releases', { p_limit: 12 }),
    supabase.rpc('top_releases', { p_days: 7, p_limit: 12, p_genre: null }),
    latestReleases(supabase, 12),
    supabase.rpc('top_tracks', { p_days: 7, p_limit: 10 }),
    supabase.from('artists').select('id, slug, name, genre, city, uf, verified, avatar_path').order('created_at', { ascending: false }).limit(12),
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
        {carousel.length ? <HouseCarousel banners={carousel} /> : <BrandHero t={t} tracks={[]} cta={{ href: '/studio', label: t.home_empty_cta }} />}
        <section className="mt-10 rounded-[24px] border border-palco bg-lona p-6 md:p-10">
          <h2 className="font-display text-3xl font-black">{t.home_empty_title}</h2>
          <p className="mt-3 max-w-[60ch] text-nevoa">{t.home_empty_text}</p>
          <Link href="/studio" className="mt-6 inline-flex h-12 items-center rounded-full bg-sol px-6 font-semibold text-noite">{t.home_empty_cta}</Link>
        </section>
        <GenreRow />
        <AdBanner context="home" />
      </>
    );
  }

  const heroId = (hero.release_id || hero.id) as string;
  const heroTracks = await releaseTracks(supabase, heroId, hero);
  const tracks = ((topTracks.data || []) as (TrackRow & { track_id?: string })[]).map((t) => ({ ...t, id: t.id || t.track_id! })).filter((t) => t.plays && t.plays > 0);
  const liked = await likedIds(supabase, user?.id, tracks.map((t) => t.id));

  return (
    <>
      {carousel.length ? <HouseCarousel banners={carousel} /> : <BrandHero t={t} tracks={heroTracks} />}
      {heroB && (
        <section className="relative mt-10 grid gap-6 overflow-hidden rounded-[24px] border border-palco bg-lona p-6 md:grid-cols-[minmax(0,220px)_1fr] md:items-center md:p-8">
          <Link href={`/${hero.artist_slug}/${hero.slug}?b=${heroB.boost_id}&utm_source=patrocinado`} className="block w-40 md:w-full"><Cover path={hero.cover_path} title={hero.title} /></Link>
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-sol">Patrocinado</span>
            <h2 className="mt-2 font-display text-[clamp(2rem,5vw,3.5rem)] font-black leading-none"><Link href={`/${hero.artist_slug}`} className="hover:text-sol">{hero.artist_name}</Link></h2>
            <p className="mt-2 text-lg text-nevoa">{hero.title}</p>
            <PlayAllButton tracks={heroTracks} source="patrocinado" label={t.home_hero_play} className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-sol px-6 font-semibold text-noite transition-transform active:scale-95 disabled:opacity-40" />
          </div>
        </section>
      )}
      <ReleaseRow title={t.home_row_trending} href="/top?janela=1" items={trendingItems.length ? trendingItems : latest} />
      <ReleaseRow title={t.home_row_sponsored} items={rowB} />
      <AdBanner context="home" />
      <ReleaseRow title={t.home_row_top} href="/top" items={(topWeek.data || []).filter((r: ReleaseCardData) => (r.plays || 0) > 0)} ranked />
      <ReleaseRow title={t.home_row_latest} href="/lancamentos" items={latest} />

      {tracks.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-2xl font-bold tracking-tight">{t.home_tracks_title}</h2>
          <TrackList tracks={tracks} liked={liked} loggedIn={!!user} showArtist source="top-faixas" />
        </section>
      )}

      <GenreRow />

      {(artists.data || []).length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="min-w-0 truncate font-display text-xl font-bold tracking-tight md:text-2xl"><Link href="/artistas" className="inline-flex items-center gap-2 hover:text-sol">{t.home_artists_title}<span className="text-sol" aria-hidden>›</span></Link></h2>
            <Link href="/artistas" className="shrink-0 whitespace-nowrap text-sm font-semibold text-sol hover:underline">Ver todos</Link>
          </div>
          <div className="scroll-row -mx-4 flex gap-5 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {(artists.data || []).map((a) => (
              <Link key={a.id} href={`/${a.slug}`} className="group w-28 shrink-0 text-center">
                {coverUrl(a.avatar_path) ? (
                  <img src={coverUrl(a.avatar_path)!} alt="" loading="lazy" className="aspect-square w-full rounded-full object-cover ring-2 ring-transparent transition group-hover:ring-sol" />
                ) : (
                  <span className="grid aspect-square w-full place-items-center rounded-full bg-palco font-display text-3xl font-black text-sol ring-2 ring-transparent transition group-hover:ring-sol">{a.name.slice(0, 1)}</span>
                )}
                <span className="mt-2 block truncate text-sm font-semibold">{a.name}</span>
                {a.city ? <span className="block truncate text-xs text-nevoa">{a.city}{a.uf ? `/${a.uf}` : ''}</span> : null}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

type T = Awaited<ReturnType<typeof getSite>>['texts'];

// O topo da página inicial: chamada da marca com o paredão aceso
function BrandHero({ t, tracks, cta }: { t: T; tracks: TrackRow[]; cta?: { href: string; label: string } }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[24px] border border-palco bg-noite">
      <ParedaoArt className="absolute inset-y-0 right-0 -z-10 h-full w-full opacity-60 md:w-[62%] md:opacity-100" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-noite via-noite/85 to-transparent md:via-noite/60" />
      <div className="max-w-xl px-6 py-14 md:px-12 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sol">{t.home_brand_kicker}</p>
        <h1 className="mt-3 font-display text-[clamp(2.4rem,5.5vw,4rem)] font-black leading-[1.02]">{t.home_brand_title}</h1>
        <p className="mt-4 max-w-[42ch] text-lg text-luar/85">{t.home_brand_text}</p>
        {cta ? (
          <Link href={cta.href} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-sol px-7 font-semibold text-noite">{cta.label}</Link>
        ) : (
          <PlayAllButton tracks={tracks} source="home" label={t.home_brand_cta} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-sol px-7 font-semibold text-noite shadow-lg shadow-sol/30 transition-transform active:scale-95 disabled:opacity-40" />
        )}
      </div>
    </section>
  );
}

// Estilos, como na identidade: atalho para o Explorar já filtrado
function GenreRow() {
  const list = ['Piseiro', 'Forró', 'Arrocha', 'Sertanejo', 'Funk', 'Pagode', 'Brega', 'Seresta'].filter((g) => GENRES.includes(g));
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">Estilos</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {list.map((g) => (
          <Link key={g} href={`/top?estilo=${encodeURIComponent(g)}`} className="group relative overflow-hidden rounded-2xl border border-palco bg-lona px-4 py-5 font-display text-lg font-black uppercase italic hover:border-sol">
            <span className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-sol/20 transition group-hover:bg-sol/40" aria-hidden />
            {g}
          </Link>
        ))}
      </div>
    </section>
  );
}
