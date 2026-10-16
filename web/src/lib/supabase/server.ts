import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, SUPABASE_ANON_KEY, serverSupabaseUrl } from '../env';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(serverSupabaseUrl(), SUPABASE_ANON_KEY, {
    cookieOptions: { name: AUTH_COOKIE },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // chamado de um Server Component: o middleware renova a sessão
        }
      },
    },
  });
}

// Só no servidor. Ignora RLS: usar apenas depois de checar permissão.
export function createAdminClient() {
  return createPlainClient(serverSupabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
    auth: { persistSession: false },
  });
}

export async function getSessionProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return { supabase, user, profile };
}
