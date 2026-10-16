import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/env';

// Links dos e-mails (confirmação, senha nova, troca de e-mail) chegam aqui com o token
export async function GET(request: Request) {
  const u = new URL(request.url);
  const token_hash = u.searchParams.get('token_hash');
  const type = u.searchParams.get('type') as EmailOtpType | null;
  const nextRaw = u.searchParams.get('next') || '/';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/';
  const base = SITE_URL.startsWith('http') ? SITE_URL : u.origin;

  if (token_hash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const dest = new URL(next, base);
      if (type === 'signup') dest.searchParams.set('bemvindo', '1');
      if (type === 'email_change') dest.searchParams.set('email', 'ok');
      return NextResponse.redirect(dest);
    }
  }
  return NextResponse.redirect(new URL('/entrar?erro=link', base));
}
