import { getSessionProfile } from '@/lib/supabase/server';
import { latestReleases } from '@/lib/queries';
import ReleaseCard from '@/components/ReleaseCard';
import AdBanner from '@/components/AdBanner';

export const metadata = { title: 'Lançamentos' };
export const revalidate = 0;

function bucket(iso?: string) {
  if (!iso) return 'Antes';
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return 'Hoje';
  if (d < 7) return 'Esta semana';
  if (d < 31) return 'Este mês';
  return 'Antes';
}

export default async function Lancamentos() {
  const { supabase } = await getSessionProfile();
  const items = await latestReleases(supabase, 96);
  const groups = ['Hoje', 'Esta semana', 'Este mês', 'Antes'].map((g) => [g, items.filter((r) => bucket(r.publish_at) === g)] as const).filter(([, l]) => l.length);
  return (
    <>
      <h1 className="titulo">Lançamentos</h1>
      <p className="mt-3 max-w-[60ch] text-nevoa">Tudo que saiu no Paredão Play, do mais novo para o mais antigo. Ouça nas primeiras 48 horas e ganhe pontos extras.</p>
      {!items.length && <p className="mt-8 text-nevoa">Nenhum lançamento ainda.</p>}
      {groups.map(([g, list], i) => (
        <section key={g} className="mt-10">
          <h2 className="mb-4 font-display text-2xl font-bold">{g}</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {list.map((r) => <ReleaseCard key={r.id} r={r} />)}
          </div>
          {i === 0 && <AdBanner context="lancamentos" />}
        </section>
      ))}
    </>
  );
}
