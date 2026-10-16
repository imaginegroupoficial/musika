import { SITE_URL } from '@/lib/env';
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  // a leitura passa pela RLS: só baixa faixa pública de lançamento que liberou download
  const { data: track } = await supabase
    .from('tracks')
    .select('id, title, upload_path, releases!inner(download_allowed, status, publish_at, title), artists!inner(name)')
    .eq('id', params.id)
    .maybeSingle();
  const rel = (track as unknown as { releases?: { download_allowed: boolean; status: string; publish_at: string } })?.releases;
  if (!track || !rel || !rel.download_allowed || rel.status !== 'ready' || new Date(rel.publish_at) > new Date()) {
    return NextResponse.redirect(new URL('/', SITE_URL));
  }
  const admin = createAdminClient();
  const ext = (track.upload_path || '').split('.').pop() || 'mp3';
  const artist = (track as unknown as { artists: { name: string } }).artists.name;
  const filename = `${artist} - ${track.title}.${ext}`.replace(/[\\/:*?"<>|]/g, '');
  const { data, error } = await admin.storage.from('uploads').createSignedUrl(track.upload_path as string, 120, { download: filename });
  if (error || !data) return NextResponse.json({ error: 'Arquivo indisponível' }, { status: 404 });
  await admin.rpc('count_download', { p_track: track.id });
  // o link assinado sai com o endereço interno; troca pelo público
  const pub = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const internal = process.env.SUPABASE_INTERNAL_URL || pub;
  return NextResponse.redirect(data.signedUrl.replace(internal, pub));
}
