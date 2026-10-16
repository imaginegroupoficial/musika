import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import '@fontsource-variable/montserrat/wght.css';
import '@fontsource-variable/montserrat/wght-italic.css';
import './globals.css';
import Player from '@/components/Player';
import { Attribution, BottomNav, MobileHeader, TopNav, type ChromeUser } from '@/components/AppChrome';
import { TextsProvider } from '@/components/TextsProvider';
import NotificationBell from '@/components/NotificationBell';
import Logo from '@/components/Logo';
import { getSessionProfile } from '@/lib/supabase/server';
import { getSite } from '@/lib/site';
import { readPrefs } from '@/lib/prefs';
import { avatarUrl, levelInfo } from '@/lib/media';
import { SITE_URL } from '@/lib/env';

export async function generateMetadata(): Promise<Metadata> {
  const { texts, brand } = await getSite();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: texts.meta_title, template: `%s | ${brand.name}` },
    description: texts.meta_description,
    manifest: '/manifest.webmanifest',
    icons: { icon: '/brand/favicon-64.png', apple: '/apple-touch-icon.png' },
    appleWebApp: { capable: true, title: brand.name, statusBarStyle: 'black-translucent' },
    openGraph: { siteName: brand.name, locale: 'pt_BR', type: 'website' },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await getSite();
  return { themeColor: theme.colors.bg, width: 'device-width', initialScale: 1, viewportFit: 'cover' };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await getSessionProfile();
  const { theme, texts, brand, logoUrl, adEvery } = await getSite();
  const isPremium = !!profile?.premium_until && new Date(profile.premium_until) > new Date();
  let user: ChromeUser = null;
  let bell: React.ReactNode = null;
  if (profile) {
    const lv = levelInfo(profile.xp);
    user = {
      username: profile.username,
      name: profile.display_name || profile.username,
      avatar: avatarUrl(profile.avatar_url),
      level: lv.name,
      xp: profile.xp,
      pct: lv.next ? Math.round(((profile.xp - lv.floor) / (lv.next - lv.floor)) * 100) : 100,
      streak: profile.streak,
      premium: isPremium,
      admin: !!profile.is_admin,
    };
    const unread = (await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)).count || 0;
    bell = <NotificationBell userId={profile.id} initial={unread} />;
  }
  return (
    <html lang="pt-BR" className={theme.dark ? 'tema-escuro' : 'tema-claro'}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: theme.css }} />
      </head>
      <body className="min-h-screen">
        <TextsProvider texts={texts}>
          <Suspense>
            <Attribution />
          </Suspense>
          <Suspense>
            <TopNav user={user} bell={bell} brandName={brand.name} logoUrl={logoUrl} />
            <MobileHeader user={user} bell={bell} brandName={brand.name} logoUrl={logoUrl} />
          </Suspense>
          <div className="mx-auto max-w-[1440px]">
            <main className="px-4 pb-10 pt-5 md:px-10 md:pt-8">{children}</main>
            <footer className="mx-4 mb-44 border-t border-palco pt-8 text-sm text-nevoa md:mx-10 md:mb-28">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <span className="flex items-center gap-5">
                  <Logo name={brand.name} logoUrl={logoUrl} size="xl" stacked />
                  <span className="hidden h-10 w-px bg-palco sm:block" />
                  <span className="hidden text-xs font-semibold uppercase tracking-[0.35em] sm:block">{texts.brand_tagline}</span>
                </span>
                <nav className="flex flex-wrap gap-x-5 gap-y-2">
                  <Link href="/premium" className="hover:text-luar">Premium</Link>
                  <Link href="/anunciar" className="hover:text-luar">Anuncie</Link>
                  <Link href="/studio" className="hover:text-luar">Para artistas</Link>
                  <Link href="/show" className="hover:text-luar">Check-in no show</Link>
                </nav>
              </div>
              <p className="mt-6">{texts.footer_text}</p>
            </footer>
          </div>
          <Player isPremium={isPremium} adEvery={adEvery} audio={readPrefs(profile?.prefs).audio} />
          <BottomNav username={profile?.username} />
        </TextsProvider>
      </body>
    </html>
  );
}
