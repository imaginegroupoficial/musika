import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import CreatePlaylist from './create';

export const metadata = { title: 'Playlists' };
export const revalidate = 0;

export default async function Playlists() {
  const { supabase, user } = await getSessionProfile();
  if (!user) redirect('/entrar?voltar=/playlists');
  const [own, member] = await Promise.all([
    supabase.from('playlists').select('id, title, is_public, collaborative, playlist_tracks(count)').eq('owner_id', user.id).order('updated_at', { ascending: false }),
    supabase.from('playlist_members').select('playlists(id, title, collaborative, playlist_tracks(count))').eq('user_id', user.id),
  ]);
  type P = { id: string; title: string; is_public?: boolean; collaborative: boolean; playlist_tracks: { count: number }[] };
  const shared = ((member.data as unknown as { playlists: P }[]) || []).map((m) => m.playlists).filter(Boolean);
  const row = (p: P, tag?: string) => (
    <li key={p.id}>
      <Link href={`/playlist/${p.id}`} className="flex items-center justify-between gap-4 py-3 hover:text-sol">
        <span className="font-display text-xl font-bold">{p.title}</span>
        <span className="text-sm text-nevoa">{p.playlist_tracks?.[0]?.count ?? 0} faixas{tag ? `, ${tag}` : p.collaborative ? ', colaborativa' : p.is_public ? '' : ', privada'}</span>
      </Link>
    </li>
  );
  return (
    <>
      <h1 className="titulo">Playlists</h1>
      <div className="mt-6 max-w-2xl"><CreatePlaylist /></div>
      <ul className="mt-8 max-w-2xl divide-y divide-lona">{((own.data as unknown as P[]) || []).map((p) => row(p))}</ul>
      {shared.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-2xl font-bold">Que você ajuda a montar</h2>
          <ul className="mt-2 max-w-2xl divide-y divide-lona">{shared.map((p) => row(p, 'colaborativa'))}</ul>
        </>
      )}
      {!own.data?.length && !shared.length && <p className="mt-6 text-nevoa">Crie uma playlist e use o botão + nas faixas para montar a sua seleção.</p>}
    </>
  );
}
