import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import TrackList, { PlayAllButton } from '@/components/TrackList';
import ShareButton from '@/components/ShareButton';
import RpcButton from '@/components/RpcButton';
import { DeleteRow } from '@/components/studio/Forms';
import { likedIds } from '@/lib/queries';
import type { TrackRow } from '@/lib/tracks';

export const revalidate = 0;

export default async function PlaylistPage({ params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSessionProfile();
  const { data: p } = await supabase.from('playlists').select('*, profiles!playlists_owner_id_fkey(username, display_name)').eq('id', params.id).maybeSingle();
  if (!p) notFound();
  const { data: items } = await supabase
    .from('playlist_tracks')
    .select('track_id, tracks(id, title, duration_sec, hls_path, status, releases(slug, title, cover_path, status, publish_at), artists(slug, name, genre))')
    .eq('playlist_id', p.id)
    .order('position');
  type It = { tracks: { id: string; title: string; duration_sec: number | null; hls_path: string | null; status: string; releases: { slug: string; title: string; cover_path: string | null } | null; artists: { slug: string; name: string; genre: string | null } } | null };
  const tracks: TrackRow[] = ((items as unknown as It[]) || [])
    .filter((i) => i.tracks?.releases)
    .map((i, n) => ({
      id: i.tracks!.id, title: i.tracks!.title, duration_sec: i.tracks!.duration_sec, hls_path: i.tracks!.status === 'ready' ? i.tracks!.hls_path : null, position: n + 1,
      release_slug: i.tracks!.releases!.slug, release_title: i.tracks!.releases!.title, cover_path: i.tracks!.releases!.cover_path,
      artist_slug: i.tracks!.artists.slug, artist_name: i.tracks!.artists.name, genre: i.tracks!.artists.genre,
    }));
  const isOwner = user?.id === p.owner_id;
  const { data: member } = user ? await supabase.from('playlist_members').select('user_id').eq('playlist_id', p.id).eq('user_id', user.id).maybeSingle() : { data: null };
  const canEdit = isOwner || (p.collaborative && !!member);
  const owner = (p as unknown as { profiles: { username: string; display_name: string | null } }).profiles;
  const liked = await likedIds(supabase, user?.id, tracks.map((t) => t.id));

  return (
    <>
      <p className="text-sm font-semibold text-nevoa">Playlist{p.collaborative ? ' colaborativa' : ''}{p.is_public ? '' : ' privada'}</p>
      <h1 className="mt-1 font-display text-[clamp(2.5rem,7vw,5rem)] font-extrabold leading-[0.9] tracking-tight">{p.title}</h1>
      <p className="mt-3 text-nevoa">por <Link href={`/perfil/${owner.username}`} className="font-semibold text-luar hover:underline">{owner.display_name || owner.username}</Link>, {tracks.length} faixas</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <PlayAllButton tracks={tracks} source={`playlist:${p.id}`} />
        {p.is_public && <ShareButton path={`/playlist/${p.id}`} title={p.title} username={profile?.username} />}
        {p.collaborative && user && !canEdit && <RpcButton fn="join_playlist" args={{ p_playlist: p.id }} label="Ajudar a montar" done="Agora você pode adicionar faixas" className="h-12 rounded-full border border-luar/40 px-5 font-semibold" />}
        {isOwner && <DeleteRow table="playlists" id={p.id} label="Excluir playlist" confirm="Excluir esta playlist?" />}
      </div>
      <section className="mt-8">
        {tracks.length ? (
          <TrackList tracks={tracks} liked={liked} loggedIn={!!user} showArtist source={`playlist:${p.id}`} removeFromPlaylist={canEdit ? p.id : undefined} />
        ) : (
          <p className="text-nevoa">Playlist vazia. Use o botão + ao lado de qualquer faixa para adicionar aqui.</p>
        )}
      </section>
    </>
  );
}
