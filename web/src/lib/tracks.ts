import { coverUrl, hlsUrl } from './media';
import type { PlayerTrack } from './types';

export type TrackRow = {
  id: string;
  title: string;
  duration_sec?: number | null;
  hls_path: string | null;
  position?: number;
  release_slug: string;
  release_title: string;
  cover_path: string | null;
  artist_slug: string;
  artist_name: string;
  plays?: number;
};

export function toPlayerTrack(t: TrackRow): PlayerTrack {
  return {
    id: t.id,
    title: t.title,
    hls: hlsUrl(t.hls_path) || '',
    duration: t.duration_sec ? Number(t.duration_sec) : null,
    artistName: t.artist_name,
    artistSlug: t.artist_slug,
    releaseTitle: t.release_title,
    releaseSlug: t.release_slug,
    cover: coverUrl(t.cover_path),
  };
}
