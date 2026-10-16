import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const u = new URL(request.url);
  const c = u.searchParams.get('c');
  if (!c || !/^[0-9a-f-]{36}$/i.test(c)) return NextResponse.redirect(new URL('/', request.url));
  const supabase = createClient();
  const { data } = await supabase.rpc('ad_event', { p_campaign: c, p_kind: 'click', p_anon: u.searchParams.get('a')?.slice(0, 64) || null });
  return NextResponse.redirect(typeof data === 'string' && /^https?:\/\//.test(data) ? data : new URL('/', request.url));
}
