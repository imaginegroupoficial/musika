import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request) {
  let body: { trackId?: string; seconds?: number; anonId?: string; ref?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.trackId || !UUID.test(body.trackId)) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase.rpc('record_play', {
    p_track: body.trackId,
    p_seconds: Math.max(0, Math.min(Math.round(Number(body.seconds) || 0), 4 * 3600)),
    p_anon: body.anonId && UUID.test(body.anonId) ? body.anonId : null,
    p_ref: body.ref ? String(body.ref).slice(0, 30).toLowerCase() : null,
    p_source: body.source ? String(body.source).slice(0, 40) : null,
  });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}
