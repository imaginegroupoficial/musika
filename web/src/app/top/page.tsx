import Link from 'next/link';
import { getSessionProfile } from '@/lib/supabase/server';
import ReleaseCard from '@/components/ReleaseCard';
import TrackList from '@/components/TrackList';
import { likedIds } from '@/lib/queries';
import type { ReleaseCardData } from '@/lib/types';
import type { TrackRow } from '@/lib/tracks';

export const metadata = { title: 'Mais ouvidos' };
export const revalidate = 0;

const windows = [
  { key: '1', label: 'Hoje', days: 1 },
  { key: '7', label: 'Semana', days: 7 },
  { key: '31', label: 'Mês', days: 31 },
  { key: 'sempre', label: 'Sempre', days: null },
] as const;

export default async function TopPage({ searchParams }: { searchParams: { janela?: string; tipo?: string } }) {
  const w = windows.find((x) => x.key === searchParams.janela) || windows[1];
  const tipo = searchParams.tipo === 'faixas' ? 'faixas' : 'cds';
  const { supabase, user } = await getSessionProfile();

  const tab = (href: string, on: boolean, label: string) => (
    <Link href={href} className={`rounded-full px-4 py-2 text-sm font-semibold ${on ? 'bg-sol text-noite' : 'bg-lona text-nevoa hover:text-luar'}`}>{label}</Link>
  );

  let body: React.ReactNode;
  if (tipo === 'cds') {
    const { data } = await supabase.rpc('top_releases', { p_days: w.days, p_limit: 48, p_genre: null });
    const items = ((data || []) as ReleaseCardData[]).filter((r) => (r.plays || 0) > 0);
    body = items.length ? (
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((r, i) => <ReleaseCard key={r.release_id} r={r} rank={i + 1} />)}
      </div>
    ) : <p className="text-nevoa">Ainda sem plays nesse período.</p>;
  } else {
    const { data } = await supabase.rpc('top_tracks', { p_days: w.days, p_limit: 50 });
    const items = ((data || []) as TrackRow[]).filter((t) => (t.plays || 0) > 0);
    const liked = await likedIds(supabase, user?.id, items.map((t) => t.id));
    body = <TrackList tracks={items.map((t, i) => ({ ...t, position: i + 1 }))} liked={liked} loggedIn={!!user} showArtist source="top" />;
  }

  return (
    <>
      <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-6xl">Mais ouvidos</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        {tab(`/top?tipo=cds&janela=${w.key}`, tipo === 'cds', 'CDs')}
        {tab(`/top?tipo=faixas&janela=${w.key}`, tipo === 'faixas', 'Faixas')}
        <span className="mx-2 w-px bg-palco" />
        {windows.map((x) => tab(`/top?tipo=${tipo}&janela=${x.key}`, x.key === w.key, x.label))}
      </div>
      <div className="mt-8">{body}</div>
    </>
  );
}
