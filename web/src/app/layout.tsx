import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import './globals.css';
import Player from '@/components/Player';
import { Attribution, BottomNav, SideNav } from '@/components/AppChrome';
import { getSessionProfile } from '@/lib/supabase/server';
import { levelInfo } from '@/lib/media';
import { SITE_URL } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Musika: ouça, apoie e suba de nível com seus artistas', template: '%s | Musika' },
  description: 'Os CDs novos do forró, piseiro, arrocha e sertanejo. Ouça grátis, baixe, ganhe pontos e apareça no ranking de fãs do seu artista.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: { siteName: 'Musika', locale: 'pt_BR', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#1A1240', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

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
  return (
    <Link href={`/perfil/${profile.username}`} className="block rounded-xl bg-lona p-3 hover:bg-palco">
      <span className="block truncate font-semibold">{profile.display_name || profile.username}</span>
      <span className="mt-0.5 flex justify-between text-sm text-nevoa">
        <span>{lv.name}</span>
        <span className="tabular-nums">{profile.xp} pts</span>
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-noite">
        <span className="block h-full rounded-full bg-mandacaru" style={{ width: `${pct}%` }} />
      </span>
      {profile.premium_until && new Date(profile.premium_until) > new Date() && <span className="mt-2 block text-xs font-semibold text-sol">Premium</span>}
      {profile.streak > 1 && <span className="mt-2 block text-xs text-sol">{profile.streak} dias seguidos ouvindo</span>}
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await getSessionProfile();
  const { data: adSetting } = await supabase.from('settings').select('value').eq('key', 'ad_every_n_tracks').maybeSingle();
  const isPremium = !!profile?.premium_until && new Date(profile.premium_until) > new Date();
  const adEvery = Number(adSetting?.value ?? 3);
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="ceu min-h-screen">
        <Suspense>
          <Attribution />
        </Suspense>
        <div className="mx-auto flex max-w-[1400px]">
          <SideNav userSlot={<UserSlot />} isAdmin={!!profile?.is_admin} isPremium={isPremium} />
          <main className="min-w-0 flex-1 px-4 pb-44 pt-5 md:px-8 md:pb-32 md:pt-8">{children}</main>
        </div>
        <Player isPremium={isPremium} adEvery={adEvery} />
        <BottomNav />
      </body>
    </html>
  );
}
