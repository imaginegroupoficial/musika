export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon';
export const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8080';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
// nome fixo do cookie: o servidor fala com o Supabase pela rede interna e o navegador pelo domínio público
export const AUTH_COOKIE = 'sb-musika-auth';
export const serverSupabaseUrl = () => process.env.SUPABASE_INTERNAL_URL || SUPABASE_URL;
export const SITE_HOST = (() => { try { return new URL(SITE_URL).host; } catch { return 'localhost'; } })();
