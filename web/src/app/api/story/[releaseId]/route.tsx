import { SITE_HOST } from '@/lib/env';
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

let fonts: { name: string; data: Buffer; weight: 500 | 900; style: 'normal' | 'italic' }[] | null = null;
async function loadFonts() {
  if (fonts) return fonts;
  try {
    const dir = join(process.cwd(), 'public', 'fonts');
    fonts = [
      { name: 'Montserrat', data: await readFile(join(dir, 'montserrat-latin-500-normal.woff')), weight: 500, style: 'normal' },
      { name: 'Montserrat', data: await readFile(join(dir, 'montserrat-latin-900-normal.woff')), weight: 900, style: 'normal' },
      { name: 'Montserrat', data: await readFile(join(dir, 'montserrat-latin-900-italic.woff')), weight: 900, style: 'italic' },
    ];
  } catch {
    fonts = [];
  }
  return fonts;
}

let logo: string | null = null;
let logoRatio = 3.4;
async function loadLogo() {
  if (logo) return;
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'brand', 'logo-horizontal.png'));
    const meta = await sharp(buf).metadata();
    if (meta.width && meta.height) logoRatio = meta.width / meta.height;
    logo = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    logo = null;
  }
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
    await loadLogo();
    const headline = track || r.title;
    const sub = track ? r.title : r.kind === 'single' ? 'Single' : r.kind === 'ao_vivo' ? 'Ao vivo' : 'CD completo';

    const RED = '#FF2D55';
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0B0B0F', backgroundImage: 'radial-gradient(circle at 85% 8%, rgba(255,45,85,0.55), rgba(11,11,15,0) 45%), radial-gradient(circle at 0% 100%, rgba(255,45,85,0.35), rgba(11,11,15,0) 40%)', color: '#F5F5F5', padding: 90, fontFamily: 'Montserrat', fontWeight: 500 }}>
          <div style={{ display: 'flex', alignSelf: 'flex-start', background: RED, color: '#FFFFFF', fontSize: 38, fontWeight: 900, padding: '14px 30px', borderRadius: 999, marginTop: 40, letterSpacing: 1 }}>
            {track ? 'TÔ OUVINDO' : 'OUÇA AGORA'}
          </div>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} width={900} height={900} style={{ borderRadius: 36, marginTop: 56, objectFit: 'cover', boxShadow: '0 30px 80px rgba(255,45,85,0.35)' }} alt="" />
          ) : (
            <div style={{ width: 900, height: 900, marginTop: 56, borderRadius: 36, background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 260, fontWeight: 900, color: '#FFFFFF' }}>
              {(artist || 'P').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ marginTop: 64, fontSize: fit(headline, 100, 15), fontWeight: 900, lineHeight: 1, letterSpacing: -2, textTransform: 'uppercase', display: 'flex' }}>{headline}</div>
          <div style={{ marginTop: 20, fontSize: fit(artist, 54, 26), color: '#C9C9D2', display: 'flex' }}>{artist}{sub ? ` · ${sub}` : ''}</div>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} height={120} width={Math.round(120 * logoRatio)} alt="" />
            ) : (
              <div style={{ display: 'flex', fontStyle: 'italic', fontWeight: 900, fontSize: 54, color: RED }}>PAREDÃO PLAY</div>
            )}
            <div style={{ marginLeft: 'auto', fontSize: 28, color: '#9C9CA8', display: 'flex' }}>{SITE_HOST}</div>
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
