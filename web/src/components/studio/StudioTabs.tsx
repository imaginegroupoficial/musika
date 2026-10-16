'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  ['', 'Painel'],
  ['/agenda', 'Agenda'],
  ['/missoes', 'Missões'],
  ['/recompensas', 'Recompensas'],
  ['/fa-clube', 'Fã-clube'],
  ['/impulsionar', 'Impulsionar'],
  ['/equipe', 'Equipe'],
];

export default function StudioTabs({ artistId }: { artistId: string }) {
  const path = usePathname();
  const base = `/studio/${artistId}`;
  return (
    <nav className="scroll-row -mx-4 mb-8 flex gap-1 overflow-x-auto border-b border-lona px-4 md:mx-0 md:px-0" aria-label="Seções do Studio">
      {tabs.map(([href, label]) => {
        const full = base + href;
        const on = href === '' ? path === base || path.startsWith(`${base}/lancamento`) : path.startsWith(full);
        return (
          <Link key={href} href={full} className={`shrink-0 border-b-2 px-3 pb-3 pt-1 font-semibold ${on ? 'border-sol text-luar' : 'border-transparent text-nevoa hover:text-luar'}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
