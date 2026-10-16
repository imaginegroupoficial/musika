import Link from 'next/link';
import { getSessionProfile } from '@/lib/supabase/server';
import ReleaseCard from '@/components/ReleaseCard';
import TrackList from '@/components/TrackList';
import { likedIds } from '@/lib/queries';
import type { ReleaseCardData } from '@/lib/types';
import type { TrackRow } from '@/lib/tracks';
import { GENRES } from '@/lib/labels';
import { latestReleases } from '@/lib/queries';

export const metadata = { title: 'Explorar' };
export const revalidate = 0;

const windows = [
  { key: '1', label: 'Hoje', days: 1 },
  { key: '7', label: 'Semana', days: 7 },
  { key: '31', label: 'Mês', days: 31 },
  { key: 'sempre', label: 'Sempre', days: null },
] as const;

export default async function TopPage({ searchParams }: { searchParams: { janela?: string; tipo?: string; estilo?: string } }) {
  const w = windows.find((x) => x.key === searchParams.janela) || windows[1];
  const estilo = GENRES.find((g) => g === searchParams.estilo) || null;
  const tipo = searchParams.tipo === 'faixas' && !estilo ? 'faixas' : 'cds';
  const qs = (o: Record<string, string | null>) => '/top?' + new URLSearchParams(Object.entries({ tipo, janela: w.key, estilo, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  const { supabase, user } = await getSessionProfile();

  const tab = (href: string, on: boolean, label: string) => (
    <Link href={href} className={`rounded-full px-4 py-2 text-sm font-semibold ${on ? 'bg-sol text-noite' : 'bg-lona text-nevoa hover:text-luar'}`}>{label}</Link>
  );

  let body: React.ReactNode;
  if (tipo === 'cds') {
    const { data } = await supabase.rpc('top_releases', { p_days: w.days, p_limit: 48, p_genre: estilo });
    let items = ((data || []) as ReleaseCardData[]).filter((r) => (r.plays || 0) > 0);
    // estilo sem plays no período: mostra os lançamentos mais recentes dele
    if (!items.length && estilo) items = (await latestReleases(supabase, 60)).filter((r) => r.genre === estilo);
    body = items.length ? (
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((r, i) => <ReleaseCard key={r.release_id || r.id} r={r} rank={(r.plays || 0) > 0 ? i + 1 : undefined} />)}
      </div>
    ) : <p className="text-nevoa">Ainda sem plays nesse período.</p>;
  } else {
    const { data } = await supabase.rpc('top_tracks', { p_days: w.days, p_limit: 50 });
    // a função devolve track_id: o resto do site usa id
    const items = ((data || []) as (TrackRow & { track_id?: string })[]).map((t) => ({ ...t, id: t.id || t.track_id! })).filter((t) => (t.plays || 0) > 0);
    const liked = await likedIds(supabase, user?.id, items.map((t) => t.id));
    body = <TrackList tracks={items.map((t, i) => ({ ...t, position: i + 1 }))} liked={liked} loggedIn={!!user} showArtist source="top" />;
  }

  return (
    <>
      <h1 className="cartaz text-[clamp(2.5rem,6vw,4.5rem)]">Explorar</h1>
      <nav aria-label="Estilos" className="scroll-row -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Link href={qs({ estilo: null })} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${!estilo ? 'border-sol bg-sol text-noite' : 'border-palco text-nevoa hover:border-sol hover:text-luar'}`}>Todos os estilos</Link>
        {GENRES.filter((g) => g !== 'Outro').map((g) => (
          <Link key={g} href={qs({ estilo: g, tipo: 'cds' })} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${estilo === g ? 'border-sol bg-sol text-noite' : 'border-palco text-nevoa hover:border-sol hover:text-luar'}`}>{g}</Link>
        ))}
      </nav>
      <h2 className="mt-8 font-display text-2xl font-bold">{estilo ? `Mais ouvidos no ${estilo}` : 'Mais ouvidos'}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {tab(qs({ tipo: 'cds' }), tipo === 'cds', 'CDs')}
        {!estilo && tab(qs({ tipo: 'faixas' }), tipo === 'faixas', 'Faixas')}
        <span className="mx-2 w-px bg-palco" />
        {windows.map((x) => tab(qs({ janela: x.key }), x.key === w.key, x.label))}
      </div>
      <div className="mt-8">{body}</div>
    </>
  );
}
