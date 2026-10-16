'use client';
import Link from 'next/link';
import { usePlayer } from '@/store/player';
import { formatCount, formatDuration } from '@/lib/media';
import { toPlayerTrack, type TrackRow } from '@/lib/tracks';
import { DownloadIcon, PauseIcon, PlayIcon } from './Icons';
import LikeButton from './LikeButton';
import AddToPlaylist from './AddToPlaylist';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Props = {
  tracks: TrackRow[];
  liked?: string[];
  loggedIn?: boolean;
  showArtist?: boolean;
  downloads?: boolean;
  source?: string;
  removeFromPlaylist?: string;
};

export default function TrackList({ tracks, liked = [], loggedIn = false, showArtist = false, downloads = false, source, removeFromPlaylist }: Props) {
  const { queue, index, playing, playQueue, toggle } = usePlayer();
  const router = useRouter();
  const remove = async (trackId: string) => {
    await createClient().from('playlist_tracks').delete().eq('playlist_id', removeFromPlaylist!).eq('track_id', trackId);
    router.refresh();
  };
  const currentId = queue[index]?.id;
  const playable = tracks.filter((t) => t.hls_path);

  const play = (t: TrackRow) => {
    if (currentId === t.id) return toggle();
    const list = playable.map(toPlayerTrack);
    playQueue(list, Math.max(0, list.findIndex((x) => x.id === t.id)), source ?? null);
  };

  if (!tracks.length) return <p className="rounded-capa bg-lona p-6 text-nevoa">Nenhuma faixa disponível ainda.</p>;

  return (
    <ol className="divide-y divide-lona">
      {tracks.map((t, i) => {
        const isCurrent = currentId === t.id;
        return (
          <li key={t.id} className={`group flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-lona/70 ${isCurrent ? 'bg-lona' : ''}`}>
            <button
              onClick={() => play(t)}
              disabled={!t.hls_path}
              aria-label={isCurrent && playing ? `Pausar ${t.title}` : `Tocar ${t.title}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-nevoa hover:bg-sol hover:text-noite disabled:opacity-40"
            >
              {isCurrent && playing ? (
                <PauseIcon className="h-4 w-4" />
              ) : (
                <>
                  <span className="text-sm tabular-nums group-hover:hidden">{t.position ?? i + 1}</span>
                  <PlayIcon className="hidden h-4 w-4 group-hover:block" />
                </>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`truncate font-medium ${isCurrent ? 'text-sol' : ''}`}>{t.title}</p>
              {showArtist && (
                <p className="truncate text-sm text-nevoa">
                  <Link href={`/${t.artist_slug}`} className="hover:text-luar">{t.artist_name}</Link>
                  {', '}
                  <Link href={`/${t.artist_slug}/${t.release_slug}`} className="hover:text-luar">{t.release_title}</Link>
                </p>
              )}
            </div>
            {t.plays != null && t.plays > 0 && <span className="hidden text-sm tabular-nums text-nevoa sm:block">{formatCount(t.plays)}</span>}
            <LikeButton trackId={t.id} initial={liked.includes(t.id)} loggedIn={loggedIn} />
            {loggedIn && <AddToPlaylist trackId={t.id} />}
            {removeFromPlaylist && (
              <button onClick={() => remove(t.id)} aria-label={`Tirar ${t.title} da playlist`} className="ctl">×</button>
            )}
            {downloads && (
              <a href={`/api/download/${t.id}`} aria-label={`Baixar ${t.title}`} className="ctl">
                <DownloadIcon className="h-[18px] w-[18px]" />
              </a>
            )}
            <span className="w-12 text-right text-sm tabular-nums text-nevoa">{formatDuration(t.duration_sec)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function PlayAllButton({ tracks, source, label = 'Tocar', className }: { tracks: TrackRow[]; source?: string; label?: string; className?: string }) {
  const { playQueue, queue, index, playing, toggle } = usePlayer();
  const list = tracks.filter((t) => t.hls_path);
  const isThis = list.length > 0 && list.some((t) => t.id === queue[index]?.id);
  return (
    <button
      disabled={!list.length}
      onClick={() => (isThis ? toggle() : playQueue(list.map(toPlayerTrack), 0, source ?? null))}
      className={className || 'inline-flex h-12 items-center gap-2 rounded-full bg-sol px-6 font-semibold text-noite transition-transform active:scale-95 disabled:opacity-40'}
    >
      {isThis && playing ? <PauseIcon /> : <PlayIcon />}
      {isThis && playing ? 'Pausar' : label}
    </button>
  );
}
