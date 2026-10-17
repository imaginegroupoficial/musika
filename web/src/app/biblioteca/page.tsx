import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import TrackList from '@/components/TrackList';
import { ReleaseRow } from '@/components/ReleaseCard';
import { mapRelease, releaseSelect } from '@/lib/queries';
import type { TrackRow } from '@/lib/tracks';

export const metadata = { title: 'Biblioteca' };
export const revalidate = 0;

type LikeRow = {
  track_id: string;
  tracks: {
    id: string; title: string; duration_sec: number | null; hls_path: string | null; status: string;
    releases: { slug: string; title: string; cover_path: string | null };
    artists: { slug: string; name: string };
  } | null;
};

export default async function Biblioteca() {
  const { supabase, user } = await getSessionProfile();
  if (!user) redirect('/entrar?voltar=/biblioteca');

  const [likes, follows] = await Promise.all([
    supabase
      .from('likes')
      .select('track_id, tracks(id, title, duration_sec, hls_path, status, releases(slug, title, cover_path), artists(slug, name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('follows').select('artists(id, slug, name, genre)').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);

  const tracks: TrackRow[] = ((likes.data as unknown as LikeRow[]) || [])
    .filter((l) => l.tracks)
    .map((l, i) => ({
      id: l.tracks!.id,
      title: l.tracks!.title,
      duration_sec: l.tracks!.duration_sec,
      hls_path: l.tracks!.status === 'ready' ? l.tracks!.hls_path : null,
      position: i + 1,
      release_slug: l.tracks!.releases.slug,
      release_title: l.tracks!.releases.title,
      cover_path: l.tracks!.releases.cover_path,
      artist_slug: l.tracks!.artists.slug,
      artist_name: l.tracks!.artists.name,
    }));
  const followedIds = ((follows.data as unknown as { artists: { id: string } }[]) || []).map((f) => f.artists?.id).filter(Boolean);
  const { data: fresh } = followedIds.length
    ? await supabase.from('releases').select(releaseSelect).in('artist_id', followedIds).eq('status', 'ready').lte('publish_at', new Date().toISOString()).gte('publish_at', new Date(Date.now() - 30 * 864e5).toISOString()).order('publish_at', { ascending: false }).limit(12)
    : { data: [] };
  const novidades = ((fresh as never[]) || []).map(mapRelease);
  const artists = ((follows.data as unknown as { artists: { id: string; slug: string; name: string; genre: string | null } }[]) || []).map((f) => f.artists).filter(Boolean);

  return (
    <>
      <h1 className="titulo">Sua biblioteca</h1>
      <nav className="mt-5 flex flex-wrap gap-2 md:hidden">
        {[['/conta', 'Minha conta'], ['/playlists', 'Playlists'], ['/retrospectiva', 'Retrospectiva'], ['/premium', 'Premium'], ['/anunciar', 'Anunciar'], ['/studio', 'Sou artista']].map(([h, l]) => (
          <Link key={h} href={h} className="rounded-full bg-lona px-4 py-2 text-sm font-semibold">{l}</Link>
        ))}
      </nav>
      <ReleaseRow title="Novidades de quem você segue" items={novidades} />

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl font-bold">Artistas que você segue</h2>
        {artists.length ? (
          <div className="flex flex-wrap gap-2">
            {artists.map((a) => (
              <Link key={a.id} href={`/${a.slug}`} className="rounded-full bg-lona px-4 py-2 font-medium hover:bg-palco">{a.name}</Link>
            ))}
          </div>
        ) : (
          <p className="text-nevoa">Siga um artista para receber os lançamentos dele aqui.</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-2xl font-bold">Músicas curtidas</h2>
        {tracks.length ? (
          <TrackList tracks={tracks} liked={tracks.map((t) => t.id)} loggedIn showArtist source="curtidas" />
        ) : (
          <p className="text-nevoa">Toque no coração de uma faixa para guardar aqui.</p>
        )}
      </section>

      <p className="mt-14"><Link href="/conta" className="text-sm font-semibold text-nevoa hover:text-luar">Minha conta: e-mail, senha e perfil</Link></p>
      <form action="/sair" method="post" className="mt-4">
        <button className="text-sm font-semibold text-nevoa hover:text-luar">Sair da conta</button>
      </form>
    </>
  );
}
