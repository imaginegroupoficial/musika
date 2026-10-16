import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@/lib/supabase/server';
import { serverSupabaseUrl } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// O gerador do card só lê PNG e JPEG: a capa (que pode ser WebP, PNG gigante etc.) vira JPEG 900x900 antes.
async function coverDataUrl(path: string | null) {
  if (!path) return null;
  try {
    const res = await fetch(`${serverSupabaseUrl()}/storage/v1/object/public/covers/${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const jpg = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize(900, 900, { fit: 'cover' }).jpeg({ quality: 86 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch (err) {
    console.error('story: capa', path, (err as Error).message);
    return null;
  }
}

let fonts: { name: string; data: Buffer; weight: 500 | 900; style: 'normal' }[] | null = null;
async function loadFonts() {
  if (fonts) return fonts;
  try {
    const dir = join(process.cwd(), 'public', 'fonts');
    fonts = [
      { name: 'Archivo', data: await readFile(join(dir, 'archivo-latin-500-normal.woff')), weight: 500, style: 'normal' },
      { name: 'Archivo', data: await readFile(join(dir, 'archivo-latin-900-normal.woff')), weight: 900, style: 'normal' },
    ];
  } catch {
    fonts = [];
  }
  return fonts;
}

const fit = (s: string, big: number, max: number) => (s.length > max ? Math.round(big * (max / s.length)) : big);

// Card 1080x1920 para o fã postar no story. ?faixa=<id> destaca uma música do lançamento.
export async function GET(req: Request, { params }: { params: { releaseId: string } }) {
  try {
    const supabase = createClient();
    if (!/^[0-9a-f-]{36}$/i.test(params.releaseId)) return new Response('não encontrado', { status: 404 });
    // aceita o id do lançamento ou o id de uma faixa (o player usa o da faixa)
    let releaseId = params.releaseId;
    let track: string | null = null;
    const { data: asTrack } = await supabase.from('tracks').select('title, release_id').eq('id', params.releaseId).maybeSingle();
    if (asTrack) { releaseId = asTrack.release_id; track = asTrack.title; }
    const trackId = new URL(req.url).searchParams.get('faixa');
    if (!track && trackId && /^[0-9a-f-]{36}$/i.test(trackId)) {
      const { data: t } = await supabase.from('tracks').select('title').eq('id', trackId).eq('release_id', releaseId).maybeSingle();
      track = t?.title || null;
    }
    const { data: r } = await supabase.from('releases').select('title, kind, cover_path, artists(name)').eq('id', releaseId).maybeSingle();
    if (!r) return new Response('não encontrado', { status: 404 });
    const artist = (r as unknown as { artists: { name: string } | null }).artists?.name || '';
    const cover = await coverDataUrl(r.cover_path);
    const headline = track || r.title;
    const sub = track ? r.title : r.kind === 'single' ? 'Single' : r.kind === 'ao_vivo' ? 'Ao vivo' : 'CD completo';

    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#3B2BFF', color: '#FFFFFF', padding: 90, fontFamily: 'Archivo', fontWeight: 500 }}>
          <div style={{ display: 'flex', alignSelf: 'flex-start', background: '#FF4A8B', color: '#15112B', fontSize: 40, fontWeight: 900, padding: '14px 30px', borderRadius: 999, marginTop: 40 }}>
            {track ? 'TÔ OUVINDO' : 'OUÇA AGORA'}
          </div>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} width={900} height={900} style={{ borderRadius: 48, marginTop: 60, objectFit: 'cover' }} alt="" />
          ) : (
            <div style={{ width: 900, height: 900, marginTop: 60, borderRadius: 48, background: '#FF4A8B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 260, fontWeight: 900, color: '#15112B' }}>
              {(artist || 'M').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ marginTop: 64, fontSize: fit(headline, 104, 15), fontWeight: 900, lineHeight: 0.98, letterSpacing: -2, textTransform: 'uppercase', display: 'flex' }}>{headline}</div>
          <div style={{ marginTop: 22, fontSize: fit(artist, 58, 26), color: '#E4E1FF', display: 'flex' }}>{artist}{sub ? ` · ${sub}` : ''}</div>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 14 }}>
            {[60, 110, 150, 90].map((h, i) => (
              <div key={i} style={{ width: 34, height: h, borderRadius: 10, background: ['#FFFFFF', '#FF4A8B', '#FFFFFF', '#15112B'][i] }} />
            ))}
            <div style={{ marginLeft: 26, fontSize: 64, fontWeight: 900, color: '#FFFFFF', display: 'flex' }}>musika.tech</div>
          </div>
        </div>
      ),
      { width: 1080, height: 1920, fonts: await loadFonts(), headers: { 'Cache-Control': 'public, max-age=600' } },
    );
  } catch (err) {
    console.error('story:', (err as Error).message);
    return new Response('Não foi possível gerar o card agora.', { status: 500 });
  }
}
