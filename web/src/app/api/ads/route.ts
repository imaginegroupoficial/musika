import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adMediaUrl } from '@/lib/media';

export async function GET(request: Request) {
  const u = new URL(request.url);
  const kind = u.searchParams.get('kind') === 'banner' ? 'banner' : 'audio';
  const supabase = createClient();
  const { data } = await supabase.rpc('serve_ad', {
    p_kind: kind,
    p_anon: u.searchParams.get('anon')?.slice(0, 64) || null,
    p_genre: u.searchParams.get('genre')?.slice(0, 40) || null,
    p_context: u.searchParams.get('ctx')?.slice(0, 60) || null,
  });
  if (!data) return NextResponse.json(null, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ ...data, media_url: adMediaUrl(data.media_path) }, { headers: { 'Cache-Control': 'no-store' } });
}
