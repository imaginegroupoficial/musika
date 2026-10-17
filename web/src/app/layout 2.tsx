import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import '@fontsource-variable/archivo/wdth.css';
import './globals.css';
import Player from '@/components/Player';
import { Attribution, BottomNav, SideNav } from '@/components/AppChrome';
import { TextsProvider } from '@/components/TextsProvider';
import { getSessionProfile } from '@/lib/supabase/server';
import { getSite } from '@/lib/site';
import { readPrefs } from '@/lib/prefs';
import { avatarUrl, levelInfo } from '@/lib/media';
import NotificationBell from '@/components/NotificationBell';
import { UserIcon } from '@/components/Icons';
import { SITE_URL } from '@/lib/env';

export async function generateMetadata(): Promise<Metadata> {
  const { texts, brand } = await getSite();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: texts.meta_title, template: `%s | ${brand.name}` },
    description: texts.meta_description,
    manifest: '/manifest.webmanifest',
    icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
    openGraph: { siteName: brand.name, locale: 'pt_BR', type: 'website' },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await getSite();
  return { themeColor: theme.colors.bg, width: 'device-width', initialScale: 1, viewportFit: 'cover' };
}

function Avatar({ path, name, className = '' }: { path?: string | null; name: string; className?: string }) {
  const url = avatarUrl(path);
  return url ? (
    <img src={url} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />
  ) : (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-sol font-bold uppercase text-noite ${className}`}>{name.slice(0, 1)}</span>
  );
}

async function UserSlot() {
  const { profile } = await getSessionProfile();
  if (!profile) {
    return (
      <Link href="/entrar" className="block rounded-xl bg-sol px-4 py-3 text-center font-semibold text-noite">
        Entrar
      </Link>
    );
  }
  const lv = levelInfo(profile.xp);
  const pct = lv.next ? Math.round(((profile.xp - lv.floor) / (lv.next - lv.floor)) * 100) : 100;
  const premium = profile.premium_until && new Date(profile.premium_until) > new Date();
  return (
    <Link href={`/perfil/${profile.username}`} className="block rounded-xl border border-palco bg-lona p-3 hover:border-sol">
      <span className="flex items-center justify-between gap-2">
        <Avatar path={profile.avatar_url} name={profile.display_name || profile.username} className="h-8 w-8 text-sm" />
        <span className="min-w-0 flex-1 truncate font-semibold">{profile.display_name || profile.username}</span>
        {premium && <span className="rounded-full bg-sol px-2 py-0.5 text-[10px] font-bold text-noite">PREMIUM</span>}
      </span>
      <span className="mt-0.5 flex justify-between text-sm text-nevoa">
        <span>{lv.name}</span>
        <span className="tabular-nums">{profile.xp} pts</span>
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-palco">
        <span className="block h-full rounded-full bg-mandacaru" style={{ width: `${pct}%` }} />
      </span>
      {profile.streak > 1 && <span className="mt-2 block text-xs font-semibold text-chita">{profile.streak} dias seguidos ouvindo</span>}
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSessionProfile();
  const { theme, texts, brand, logoUrl, adEvery } = await getSite();
  const isPremium = !!profile?.premium_until && new Date(profile.premium_until) > new Date();
  const { supabase } = await getSessionProfile();
  const unread = profile ? (await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)).count || 0 : 0;
  const bell = profile ? <NotificationBell userId={profile.id} initial={unread} /> : null;
  return (
    <html lang="pt-BR" className={theme.dark ? 'tema-escuro' : 'tema-claro'}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: theme.css }} />
      </head>
      <body className="ceu min-h-screen">
        <TextsProvider texts={texts}>
          <Suspense>
            <Attribution />
          </Suspense>
          <div className="mx-auto flex max-w-[1440px]">
            <SideNav userSlot={<UserSlot />} bell={bell} isAdmin={!!profile?.is_admin} isPremium={isPremium} brandName={brand.name} logoUrl={logoUrl} />
            <div className="min-w-0 flex-1">
              <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-palco bg-noite/90 px-4 backdrop-blur md:hidden">
                <Link href="/" aria-label={brand.name}>
                  {logoUrl ? <img src={logoUrl} alt={brand.name} className="h-7 w-auto" /> : <span className="cartaz text-[26px] text-sol">{brand.name}</span>}
                </Link>
                <span className="flex items-center gap-1">
                  {bell}
                  {profile ? (
                    <Link href="/conta" aria-label="Minha conta" className="ml-1">
                      <Avatar path={profile.avatar_url} name={profile.display_name || profile.username} className="h-9 w-9 text-sm" />
                    </Link>
                  ) : (
                    <Link href="/entrar" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sol px-4 text-sm font-semibold text-noite">
                      <UserIcon className="h-4 w-4" /> Entrar
                    </Link>
                  )}
                </span>
              </header>
              <main className="px-4 pb-10 pt-5 md:px-10 md:pt-8">{children}</main>
              <footer className="mx-4 mb-44 border-t border-palco pt-6 text-sm text-nevoa md:mx-10 md:mb-28">
                <p>{texts.footer_text}</p>
                <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  <Link href="/premium" className="hover:text-luar">Premium</Link>
                  <Link href="/anunciar" className="hover:text-luar">Anuncie</Link>
                  <Link href="/studio" className="hover:text-luar">Para artistas</Link>
                  <Link href="/show" className="hover:text-luar">Check-in no show</Link>
                </nav>
              </footer>
            </div>
          </div>
          <Player isPremium={isPremium} adEvery={adEvery} audio={readPrefs(profile?.prefs).audio} />
          <BottomNav />
        </TextsProvider>
      </body>
    </html>
  );
}
