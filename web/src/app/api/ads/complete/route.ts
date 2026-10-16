import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body?.c || !/^[0-9a-f-]{36}$/i.test(body.c)) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = createClient();
  await supabase.rpc('ad_event', { p_campaign: body.c, p_kind: 'complete', p_anon: typeof body.a === 'string' ? body.a.slice(0, 64) : null });
  return NextResponse.json({ ok: true });
}
