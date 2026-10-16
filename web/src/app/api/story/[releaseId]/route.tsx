import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';
import { serverSupabaseUrl } from '@/lib/env';

export const runtime = 'nodejs';

// Card 1080x1920 para o fã postar no story
export async function GET(_req: Request, { params }: { params: { releaseId: string } }) {
  const supabase = createClient();
  const { data: r } = await supabase.from('releases').select('title, cover_path, artists(name)').eq('id', params.releaseId).maybeSingle();
  if (!r) return new Response('não encontrado', { status: 404 });
  const artist = (r as unknown as { artists: { name: string } }).artists.name;
  let cover: string | null = null;
  if (r.cover_path) {
    const res = await fetch(`${serverSupabaseUrl()}/storage/v1/object/public/covers/${r.cover_path}`).catch(() => null);
    if (res?.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      cover = `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
    }
  }
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#1A1240', color: '#F3EEFF', padding: 90, justifyContent: 'center' }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} width={900} height={900} style={{ borderRadius: 48, objectFit: 'cover' }} alt="" />
        ) : (
          <div style={{ width: 900, height: 900, borderRadius: 48, background: '#E8336D', display: 'flex' }} />
        )}
        <div style={{ marginTop: 70, fontSize: 92, fontWeight: 800, lineHeight: 1, display: 'flex' }}>{artist}</div>
        <div style={{ marginTop: 24, fontSize: 56, color: '#B9AEE0', display: 'flex' }}>{r.title}</div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          {[60, 110, 150, 90].map((h, i) => (
            <div key={i} style={{ width: 34, height: h, borderRadius: 10, background: ['#FFC531', '#E8336D', '#FFC531', '#2BB673'][i] }} />
          ))}
          <div style={{ marginLeft: 26, fontSize: 64, fontWeight: 800, color: '#FFC531', display: 'flex' }}>musika.tech</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
