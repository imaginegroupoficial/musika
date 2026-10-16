import Link from 'next/link';
import { coverUrl, formatCount, kindLabel } from '@/lib/media';
import type { ReleaseCardData } from '@/lib/types';
import { CheckBadge } from './Icons';

export function Cover({ path, title, className = '' }: { path: string | null; title: string; className?: string }) {
  const url = coverUrl(path);
  if (url) return <img src={url} alt={`Capa de ${title}`} loading="lazy" className={`aspect-square w-full rounded-capa object-cover ${className}`} />;
  // sem capa: as iniciais do título sobre a cor de chita
  const initials = title.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className={`grid aspect-square w-full place-items-center rounded-capa bg-chita font-display text-4xl font-extrabold text-noite ${className}`} aria-label={`Capa de ${title}`}>
      {initials}
    </div>
  );
}

export default function ReleaseCard({ r, rank }: { r: ReleaseCardData & { boost_id?: string }; rank?: number }) {
  const href = r.boost_id ? `/${r.artist_slug}/${r.slug}?b=${r.boost_id}&utm_source=patrocinado` : `/${r.artist_slug}/${r.slug}`;
  return (
    <Link href={href} className="group block w-full">
      <div className="relative">
        <Cover path={r.cover_path} title={r.title} className="transition-transform group-hover:-translate-y-0.5" />
        {rank != null && (
          <span className="absolute bottom-2 left-2 grid h-10 min-w-10 place-items-center rounded-[10px] bg-noite px-2 font-display text-2xl font-extrabold leading-none text-sol">
            {rank}
          </span>
        )}
      </div>
      <p className="mt-3 line-clamp-2 font-semibold leading-snug">{r.title}</p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-nevoa">
        {r.artist_name}
        {r.verified && <CheckBadge className="h-3.5 w-3.5 shrink-0 text-sol" />}
      </p>
      {(r.plays != null && r.plays > 0) || r.kind ? (
        <p className="mt-0.5 text-xs text-nevoa/80">
          {r.kind ? kindLabel[r.kind] : ''}
          {r.plays ? `${r.kind ? ', ' : ''}${formatCount(r.plays)} plays` : ''}
        </p>
      ) : null}
    </Link>
  );
}

export function ReleaseRow({ title, href, items, ranked }: { title: string; href?: string; items: ReleaseCardData[]; ranked?: boolean }) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        {href && (
          <Link href={href} className="text-sm font-semibold text-nevoa hover:text-sol">
            Ver tudo
          </Link>
        )}
      </div>
      <div className="scroll-row -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:px-0 lg:grid-cols-6">
        {items.map((r, i) => (
          <div key={(r as { boost_id?: string }).boost_id || r.release_id || r.id} className="w-36 shrink-0 md:w-auto">
            <ReleaseCard r={r} rank={ranked ? i + 1 : undefined} />
          </div>
        ))}
      </div>
    </section>
  );
}
