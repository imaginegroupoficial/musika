import Link from 'next/link';
import { getSessionProfile } from '@/lib/supabase/server';
import ReleaseCard from '@/components/ReleaseCard';
import TrackList from '@/components/TrackList';
import { CheckBadge, SearchIcon } from '@/components/Icons';
import type { ReleaseCardData } from '@/lib/types';
import type { TrackRow } from '@/lib/tracks';

export const metadata = { title: 'Buscar' };

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q || '').trim().slice(0, 80);
  const { supabase, user } = await getSessionProfile();
  const res = q.length >= 2 ? (await supabase.rpc('search_catalog', { q })).data : null;
  const artists = (res?.artists || []) as { id: string; slug: string; name: string; genre: string | null; verified: boolean }[];
  const releases = (res?.releases || []) as ReleaseCardData[];
  const tracks = (res?.tracks || []) as TrackRow[];
  const { data: boosted } = q.length >= 2 ? await supabase.rpc('active_boosts', { p_placement: 'search' }) : { data: [] };
  const sponsored = ((boosted || []) as (ReleaseCardData & { boost_id: string })[]).slice(0, 2);
  if (sponsored.length) await supabase.rpc('boost_impression', { p_ids: sponsored.map((b) => b.boost_id) });

  return (
    <>
      <form action="/busca" className="relative max-w-2xl">
        <SearchIcon className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-nevoa" />
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Artista, CD ou música"
          aria-label="Buscar"
          className="h-16 w-full rounded-full bg-lona pl-14 pr-6 font-display text-xl outline-none placeholder:text-nevoa/70 focus:ring-2 focus:ring-sol"
        />
      </form>

      {!q && <p className="mt-8 text-nevoa">Pode escrever do jeito que falar: a busca entende erro de digitação.</p>}
      {q && res && !artists.length && !releases.length && !tracks.length && (
        <p className="mt-8 text-nevoa">Nada encontrado para “{q}”. Tente só o nome do artista.</p>
      )}

      {sponsored.length > 0 && (
        <section className="mt-8">
          <p className="mb-3 text-xs text-nevoa">Patrocinado</p>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">
            {sponsored.map((r) => <ReleaseCard key={r.boost_id} r={r} />)}
          </div>
        </section>
      )}
      {artists.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-2xl font-bold">Artistas</h2>
          <div className="flex flex-wrap gap-2">
            {artists.map((a) => (
              <Link key={a.id} href={`/${a.slug}`} className="flex items-center gap-1.5 rounded-full bg-lona px-4 py-2 font-medium hover:bg-palco">
                {a.name}
                {a.verified && <CheckBadge className="h-3.5 w-3.5 text-sol" />}
              </Link>
            ))}
          </div>
        </section>
      )}
      {releases.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-2xl font-bold">CDs e singles</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {releases.map((r) => <ReleaseCard key={r.id} r={r} />)}
          </div>
        </section>
      )}
      {tracks.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-2xl font-bold">Músicas</h2>
          <TrackList tracks={tracks.map((t, i) => ({ ...t, position: i + 1 }))} loggedIn={!!user} showArtist source="busca" />
        </section>
      )}
    </>
  );
}
