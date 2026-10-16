'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useT } from './TextsProvider';
import { FireIcon, HomeIcon, LibraryIcon, MicIcon, QueueIcon, SearchIcon, TrophyIcon } from './Icons';

const items = [
  { href: '/', label: 'Início', Icon: HomeIcon },
  { href: '/top', label: 'Top', Icon: FireIcon },
  { href: '/busca', label: 'Buscar', Icon: SearchIcon },
  { href: '/ranking', label: 'Ranking', Icon: TrophyIcon },
  { href: '/biblioteca', label: 'Biblioteca', Icon: LibraryIcon },
];

function active(path: string, href: string) {
  return href === '/' ? path === '/' : path.startsWith(href);
}

const extra = [
  { href: '/playlists', label: 'Playlists', Icon: QueueIcon },
];

export function SideNav({ userSlot, bell, isAdmin, isPremium, brandName = 'Musika', logoUrl }: { userSlot: React.ReactNode; bell?: React.ReactNode; isAdmin?: boolean; isPremium?: boolean; brandName?: string; logoUrl?: string | null }) {
  const path = usePathname();
  const t = useT();
  const link = (href: string, label: string, Icon: (p: { className?: string }) => JSX.Element) => (
    <Link
      key={href}
      href={href}
      aria-current={active(path, href) ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium ${active(path, href) ? 'bg-luar text-noite' : 'text-nevoa hover:bg-palco hover:text-luar'}`}
    >
      <Icon className="h-5 w-5" /> {label}
    </Link>
  );
  const sub = (href: string, label: string) => (
    <Link key={href} href={href} className={`block rounded-lg px-3 py-1.5 text-sm ${path.startsWith(href) ? 'font-semibold text-luar' : 'text-nevoa hover:text-luar'}`}>{label}</Link>
  );
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-palco px-4 pb-24 pt-6 md:flex">
      <div className="mb-8 flex items-center justify-between gap-2 pl-3">
        <Link href="/" className="block min-w-0" aria-label={brandName}>
          {logoUrl ? <img src={logoUrl} alt={brandName} className="h-9 w-auto" /> : <span className="cartaz block text-[34px] text-sol">{brandName}</span>}
        </Link>
        {bell}
      </div>
      <nav className="flex flex-col gap-1">
        {items.map(({ href, label, Icon }) => link(href, label, Icon))}
        {extra.map(({ href, label, Icon }) => link(href, label, Icon))}
      </nav>
      <Link
        href="/studio"
        className={`mt-6 flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 font-semibold ${path.startsWith('/studio') ? 'border-sol bg-sol text-noite' : 'border-sol text-sol hover:bg-sol hover:text-noite'}`}
      >
        <MicIcon className="h-5 w-5" /> {t('nav_artist_cta')}
      </Link>
      <div className="mt-4 space-y-0.5">
        {!isPremium && sub('/premium', 'Musika Premium')}
        {sub('/anunciar', 'Anunciar')}
        {sub('/retrospectiva', 'Sua retrospectiva')}
        {sub('/notificacoes', 'Avisos')}
        {sub('/conta', 'Minha conta e configurações')}
        {isAdmin && sub('/admin', 'Administração')}
      </div>
      <div className="mt-auto">{userSlot}</div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch justify-around border-t border-palco bg-lona md:hidden">
      {items.map(({ href, label, Icon }) => (
        <Link key={href} href={href} className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active(path, href) ? 'text-sol' : 'text-nevoa'}`}>
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

// guarda quem indicou (?ref=usuario) e a origem (?utm_source=) para creditar pontos e mostrar no painel do artista
export function Attribution() {
  const params = useSearchParams();
  useEffect(() => {
    try {
      const ref = params.get('ref');
      const src = params.get('utm_source') || (ref ? 'compartilhado' : null);
      if (ref) sessionStorage.setItem('mk_ref', ref);
      if (src) sessionStorage.setItem('mk_src', src);
    } catch {}
  }, [params]);
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
