'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { FireIcon, HomeIcon, LibraryIcon, MicIcon, SearchIcon, TrophyIcon } from './Icons';

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

export function SideNav({ userSlot }: { userSlot: React.ReactNode }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-lona px-4 pb-24 pt-6 md:flex">
      <Link href="/" className="mb-8 px-3 font-display text-[28px] font-extrabold leading-none tracking-tight text-sol">
        musika
      </Link>
      <nav className="flex flex-col gap-1">
        {items.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium ${active(path, href) ? 'bg-lona text-luar' : 'text-nevoa hover:text-luar'}`}
          >
            <Icon className="h-5 w-5" /> {label}
          </Link>
        ))}
      </nav>
      <Link
        href="/studio"
        className={`mt-6 flex items-center gap-3 rounded-xl border border-palco px-3 py-2.5 font-medium ${path.startsWith('/studio') ? 'bg-palco text-luar' : 'text-nevoa hover:text-luar'}`}
      >
        <MicIcon className="h-5 w-5" /> Sou artista
      </Link>
      <div className="mt-auto">{userSlot}</div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch justify-around border-t border-palco bg-noite md:hidden">
      {items.map(({ href, label, Icon }) => (
        <Link key={href} href={href} className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${active(path, href) ? 'text-sol' : 'text-nevoa'}`}>
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
