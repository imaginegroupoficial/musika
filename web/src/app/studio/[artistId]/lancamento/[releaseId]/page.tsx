import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DeleteRow, ReleaseEditor } from '@/components/studio/Forms';
import AutoRefresh from '@/components/studio/AutoRefresh';

export const revalidate = 0;

export default async function EditRelease({ params }: { params: { artistId: string; releaseId: string } }) {
  const supabase = createClient();
  const { data: release } = await supabase.from('releases').select('id, slug, title, publish_at, download_allowed, status, artists(slug)').eq('id', params.releaseId).eq('artist_id', params.artistId).maybeSingle();
  if (!release) notFound();
  const { data: tracks } = await supabase.from('tracks').select('id, title, position, lyrics, status, error').eq('release_id', release.id).order('position');
  const slug = (release as unknown as { artists: { slug: string } }).artists.slug;
  return (
    <>
      <AutoRefresh active={release.status === 'processing'} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{release.title}</h1>
        <div className="flex gap-2">
          <Link href={`/${slug}/${release.slug}`} className="h-10 rounded-full border border-luar/40 px-4 pt-2 text-sm font-semibold">Ver página</Link>
          <DeleteRow table="releases" id={release.id} label="Excluir lançamento" confirm="Excluir o lançamento e todas as faixas? Não dá para desfazer." />
        </div>
      </div>
      <ReleaseEditor release={release} tracks={tracks || []} />
    </>
  );
}
