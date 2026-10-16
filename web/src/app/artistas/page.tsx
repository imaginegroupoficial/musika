import Link from 'next/link';
import { getSessionProfile } from '@/lib/supabase/server';
import { coverUrl } from '@/lib/media';
import { GENRES, UFS } from '@/lib/labels';
import { CheckBadge } from '@/components/Icons';

export const metadata = { title: 'Artistas' };
export const revalidate = 0;

export default async function Artistas({ searchParams }: { searchParams: { estilo?: string; uf?: string } }) {
  const { supabase } = await getSessionProfile();
  const estilo = GENRES.find((g) => g === searchParams.estilo) || null;
  const uf = UFS.find((u) => u === searchParams.uf) || null;
  let q = supabase.from('artists').select('id, slug, name, genre, city, uf, verified, avatar_path').order('verified', { ascending: false }).order('name').limit(240);
  if (estilo) q = q.eq('genre', estilo);
  if (uf) q = q.eq('uf', uf);
  const { data } = await q;
  const link = (o: Record<string, string | null>) => '/artistas?' + new URLSearchParams(Object.entries({ estilo, uf, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  const chip = (href: string, on: boolean, label: string) => (
    <Link key={label} href={href} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${on ? 'border-sol bg-sol text-noite' : 'border-palco text-nevoa hover:border-sol hover:text-luar'}`}>{label}</Link>
  );
  return (
    <>
      <h1 className="cartaz text-[clamp(2.5rem,6vw,4.5rem)]">Artistas</h1>
      <div className="scroll-row -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {chip(link({ estilo: null }), !estilo, 'Todos')}
        {GENRES.filter((g) => g !== 'Outro').map((g) => chip(link({ estilo: g }), estilo === g, g))}
      </div>
      <form action="/artistas" className="mt-4 flex items-center gap-2">
        {estilo && <input type="hidden" name="estilo" value={estilo} />}
        <label className="text-sm text-nevoa" htmlFor="uf">Estado</label>
        <select id="uf" name="uf" defaultValue={uf || ''} className="field h-10 w-28">
          <option value="">Todos</option>
          {UFS.map((u) => <option key={u}>{u}</option>)}
        </select>
        <button className="h-10 rounded-full border border-palco px-4 text-sm font-semibold hover:border-sol">Filtrar</button>
      </form>
      {(data || []).length ? (
        <ul className="mt-8 grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {(data || []).map((a) => (
            <li key={a.id}>
              <Link href={`/${a.slug}`} className="group block text-center">
                {coverUrl(a.avatar_path) ? (
                  <img src={coverUrl(a.avatar_path)!} alt="" loading="lazy" className="aspect-square w-full rounded-full object-cover ring-2 ring-transparent transition group-hover:ring-sol" />
                ) : (
                  <span className="grid aspect-square w-full place-items-center rounded-full bg-palco font-display text-3xl font-black text-sol ring-2 ring-transparent transition group-hover:ring-sol">{a.name.slice(0, 1)}</span>
                )}
                <span className="mt-2 flex items-center justify-center gap-1 text-sm font-semibold"><span className="truncate">{a.name}</span>{a.verified && <CheckBadge className="h-3.5 w-3.5 shrink-0 text-sol" />}</span>
                <span className="block truncate text-xs text-nevoa">{[a.genre, a.city && `${a.city}${a.uf ? `/${a.uf}` : ''}`].filter(Boolean).join(' · ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-nevoa">Nenhum artista com esse filtro ainda.</p>
      )}
    </>
  );
}
