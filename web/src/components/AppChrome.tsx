'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useT } from './TextsProvider';
import Logo from './Logo';
import { CloseIcon, CompassIcon, DiscIcon, HomeIcon, LibraryIcon, MenuIcon, MicIcon, QueueIcon, SearchIcon, TrophyIcon, UserIcon, UsersIcon } from './Icons';

export type ChromeUser = {
  username: string;
  name: string;
  avatar: string | null;
  level: string;
  xp: number;
  pct: number;
  streak: number;
  premium: boolean;
  admin: boolean;
} | null;

const main = [
  { href: '/', label: 'Início', Icon: HomeIcon },
  { href: '/top', label: 'Explorar', Icon: CompassIcon },
  { href: '/artistas', label: 'Artistas', Icon: UsersIcon },
  { href: '/playlists', label: 'Playlists', Icon: QueueIcon },
  { href: '/lancamentos', label: 'Lançamentos', Icon: DiscIcon },
];

function active(path: string, href: string) {
  return href === '/' ? path === '/' : path.startsWith(href);
}

function Avatar({ user, className = 'h-9 w-9' }: { user: NonNullable<ChromeUser>; className?: string }) {
  return user.avatar ? (
    <img src={user.avatar} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />
  ) : (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-sol text-sm font-bold uppercase text-noite ${className}`}>{user.name.slice(0, 1)}</span>
  );
}

function accountLinks(user: ChromeUser) {
  return [
    user && { href: `/perfil/${user.username}`, label: 'Meu perfil' },
    { href: '/biblioteca', label: 'Biblioteca' },
    { href: '/ranking', label: 'Ranking de fãs' },
    user && { href: '/notificacoes', label: 'Avisos' },
    { href: '/retrospectiva', label: 'Sua retrospectiva' },
    !user?.premium && { href: '/premium', label: 'Assinar Premium' },
    { href: '/anunciar', label: 'Anunciar' },
    { href: '/show', label: 'Check-in no show' },
    user && { href: '/conta', label: 'Minha conta e configurações' },
    user?.admin && { href: '/admin', label: 'Administração' },
  ].filter(Boolean) as { href: string; label: string }[];
}

function UserCard({ user }: { user: NonNullable<ChromeUser> }) {
  return (
    <Link href={`/perfil/${user.username}`} className="block rounded-xl bg-noite/60 p-3">
      <span className="flex items-center gap-3">
        <Avatar user={user} className="h-10 w-10" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{user.name}</span>
            {user.premium && <span className="rounded-full bg-sol px-2 py-0.5 text-[10px] font-bold text-noite">PREMIUM</span>}
          </span>
          <span className="flex justify-between text-sm text-nevoa"><span>{user.level}</span><span className="tabular-nums">{user.xp} pts</span></span>
        </span>
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-palco"><span className="block h-full rounded-full bg-sol" style={{ width: `${user.pct}%` }} /></span>
      {user.streak > 1 && <span className="mt-2 block text-xs font-semibold text-sol">{user.streak} dias seguidos ouvindo</span>}
    </Link>
  );
}

function SearchBox({ className = '' }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const path = usePathname();
  const [q, setQ] = useState(path === '/busca' ? params.get('q') || '' : '');
  return (
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); router.push(q.trim() ? `/busca?q=${encodeURIComponent(q.trim())}` : '/busca'); }}
      className={`relative ${className}`}
    >
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-nevoa" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar músicas, artistas..." aria-label="Buscar" className="h-10 w-full rounded-full border border-palco bg-lona pl-10 pr-4 text-sm outline-none placeholder:text-nevoa focus:border-sol" />
    </form>
  );
}

// Topo no computador: logo, menu, busca, avisos e conta
export function TopNav({ user, bell, brandName, logoUrl }: { user: ChromeUser; bell?: React.ReactNode; brandName: string; logoUrl?: string | null }) {
  const path = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  return (
    <header className="sticky top-0 z-40 hidden border-b border-palco bg-noite/90 backdrop-blur-md md:block">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-8 px-10">
        <Link href="/" className="shrink-0"><Logo name={brandName} logoUrl={logoUrl} /></Link>
        <nav className="flex h-full items-stretch gap-1">
          {main.map(({ href, label }) => (
            <Link key={href} href={href} aria-current={active(path, href) ? 'page' : undefined} className={`relative flex items-center px-3 text-sm font-semibold transition-colors ${active(path, href) ? 'text-luar' : 'text-nevoa hover:text-luar'}`}>
              {label}
              {active(path, href) && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-sol" />}
            </Link>
          ))}
        </nav>
        <SearchBox className="ml-auto w-full max-w-[320px]" />
        <Link href="/studio" className={`hidden shrink-0 items-center gap-2 rounded-full border-2 border-sol px-4 py-1.5 text-sm font-semibold lg:inline-flex ${path.startsWith('/studio') ? 'bg-sol text-noite' : 'text-sol hover:bg-sol hover:text-noite'}`}>
          <MicIcon className="h-4 w-4" /> {t('nav_artist_cta')}
        </Link>
        {bell}
        {user ? (
          <div ref={ref} className="relative">
            <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu da conta" className="block rounded-full ring-2 ring-transparent hover:ring-sol">
              <Avatar user={user} />
            </button>
            {open && (
              <div className="absolute right-0 top-12 w-72 rounded-2xl border border-palco bg-lona p-2 shadow-2xl shadow-black/50">
                <UserCard user={user} />
                <nav className="mt-2 flex flex-col">
                  {accountLinks(user).map((l) => <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-nevoa hover:bg-palco hover:text-luar">{l.label}</Link>)}
                </nav>
                <form action="/sair" method="post" className="mt-1 border-t border-palco pt-1">
                  <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-nevoa hover:bg-palco hover:text-luar">Sair</button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <Link href="/entrar" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-sol px-5 text-sm font-semibold text-noite"><UserIcon className="h-4 w-4" /> Entrar</Link>
        )}
      </div>
    </header>
  );
}

// Topo no celular: logo, busca, avisos e menu lateral
export function MobileHeader({ user, bell, brandName, logoUrl }: { user: ChromeUser; bell?: React.ReactNode; brandName: string; logoUrl?: string | null }) {
  const path = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-palco bg-noite/90 px-4 backdrop-blur-md md:hidden">
        <Link href="/"><Logo name={brandName} logoUrl={logoUrl} size="sm" /></Link>
        <span className="flex items-center">
          <Link href="/busca" aria-label="Buscar" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-palco"><SearchIcon className="h-[22px] w-[22px]" /></Link>
          {bell}
          <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-palco"><MenuIcon className="h-6 w-6" /></button>
        </span>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/70" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col overflow-y-auto bg-lona p-4">
            <div className="flex items-center justify-between">
              <Logo name={brandName} logoUrl={logoUrl} size="sm" />
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-palco"><CloseIcon className="h-6 w-6" /></button>
            </div>
            <div className="mt-4">
              {user ? <UserCard user={user} /> : <Link href="/entrar" className="block rounded-xl bg-sol px-4 py-3 text-center font-semibold text-noite">Entrar ou criar conta</Link>}
            </div>
            <nav className="mt-4 flex flex-col">
              {main.map(({ href, label, Icon }) => (
                <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-semibold ${active(path, href) ? 'text-sol' : ''}`}><Icon className="h-5 w-5" /> {label}</Link>
              ))}
            </nav>
            <Link href="/studio" className="mt-3 flex items-center justify-center gap-2 rounded-full border-2 border-sol px-4 py-2.5 font-semibold text-sol"><MicIcon className="h-5 w-5" /> {t('nav_artist_cta')}</Link>
            <nav className="mt-4 flex flex-col border-t border-palco pt-3">
              {accountLinks(user).map((l) => <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-nevoa">{l.label}</Link>)}
            </nav>
            {user && (
              <form action="/sair" method="post" className="mt-2 border-t border-palco pt-2">
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-nevoa">Sair</button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Barra de baixo no celular
export function BottomNav({ username }: { username?: string | null }) {
  const path = usePathname();
  const items = [
    { href: '/', label: 'Início', Icon: HomeIcon },
    { href: '/top', label: 'Explorar', Icon: CompassIcon },
    { href: '/biblioteca', label: 'Biblioteca', Icon: LibraryIcon },
    { href: '/ranking', label: 'Ranking', Icon: TrophyIcon },
    { href: username ? '/conta' : '/entrar', label: 'Perfil', Icon: UserIcon, match: ['/conta', '/perfil', '/entrar'] },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch justify-around border-t border-palco bg-noite md:hidden">
      {items.map(({ href, label, Icon, match }) => {
        const on = match ? match.some((m) => path.startsWith(m)) : active(path, href);
        return (
          <Link key={label} href={href} className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? 'text-sol' : 'text-nevoa'}`}>
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
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
