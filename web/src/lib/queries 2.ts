import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReleaseCardData } from './types';
import type { TrackRow } from './tracks';

type RelJoin = {
  id: string;
  title: string;
  slug: string;
  kind: string;
  cover_path: string | null;
  publish_at: string;
  artists: { slug: string; name: string; verified: boolean } | null;
};

export const releaseSelect = 'id, title, slug, kind, cover_path, publish_at, artists!inner(slug, name, verified)';

export function mapRelease(r: RelJoin): ReleaseCardData {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    kind: r.kind,
    cover_path: r.cover_path,
    artist_slug: r.artists?.slug ?? '',
    artist_name: r.artists?.name ?? '',
    verified: r.artists?.verified ?? false,
  };
}

export async function latestReleases(supabase: SupabaseClient, limit = 12) {
  const { data } = await supabase
    .from('releases')
    .select(releaseSelect)
    .eq('status', 'ready')
    .lte('publish_at', new Date().toISOString())
    .order('publish_at', { ascending: false })
    .limit(limit);
  return ((data as unknown as RelJoin[]) || []).map(mapRelease);
}

export async function releaseTracks(supabase: SupabaseClient, releaseId: string, rel: { slug: string; title: string; cover_path: string | null; artist_slug: string; artist_name: string }) {
  const { data } = await supabase
    .from('tracks')
    .select('id, title, duration_sec, hls_path, position, status')
    .eq('release_id', releaseId)
    .order('position');
  return (data || []).map(
    (t): TrackRow => ({
      id: t.id,
      title: t.title,
      duration_sec: t.duration_sec,
      hls_path: t.status === 'ready' ? t.hls_path : null,
      position: t.position,
      release_slug: rel.slug,
      release_title: rel.title,
      cover_path: rel.cover_path,
      artist_slug: rel.artist_slug,
      artist_name: rel.artist_name,
    }),
  );
}

export async function likedIds(supabase: SupabaseClient, userId: string | undefined, trackIds: string[]) {
  if (!userId || !trackIds.length) return [];
  const { data } = await supabase.from('likes').select('track_id').eq('user_id', userId).in('track_id', trackIds);
  return (data || []).map((l) => l.track_id as string);
}
