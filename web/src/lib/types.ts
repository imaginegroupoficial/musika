export type PlayerTrack = {
  id: string;
  title: string;
  hls: string;
  duration?: number | null;
  artistName: string;
  artistSlug: string;
  releaseTitle: string;
  releaseSlug: string;
  cover: string | null;
};

export type ReleaseCardData = {
  release_id?: string;
  id?: string;
  title: string;
  slug: string;
  kind?: string;
  cover_path: string | null;
  artist_slug: string;
  artist_name: string;
  verified?: boolean;
  plays?: number;
  plays_recent?: number;
};
