import Link from 'next/link';
import { getSessionProfile } from '@/lib/supabase/server';
import { levelInfo } from '@/lib/media';
import { getSite } from '@/lib/site';

export const metadata = { title: 'Ranking de fãs' };
export const revalidate = 0;

export default async function RankingPage({ searchParams }: { searchParams: { periodo?: string } }) {
  const semanal = searchParams.periodo !== 'geral';
  const { supabase, user } = await getSessionProfile();
  const { texts: t } = await getSite();
  const { data } = await supabase.rpc('global_ranking', { p_days: semanal ? 7 : null, p_limit: 100 });
  const rows = ((data || []) as { user_id: string; username: string; display_name: string | null; xp: number; total_xp: number }[]).filter((r) => r.xp > 0);

  return (
    <>
      <h1 className="titulo">{t.ranking_title}</h1>
      <p className="mt-3 max-w-[60ch] text-nevoa">
        {t.ranking_intro}
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/ranking" className={`rounded-full px-4 py-2 text-sm font-semibold ${semanal ? 'bg-sol text-noite' : 'bg-lona text-nevoa'}`}>Esta semana</Link>
        <Link href="/ranking?periodo=geral" className={`rounded-full px-4 py-2 text-sm font-semibold ${!semanal ? 'bg-sol text-noite' : 'bg-lona text-nevoa'}`}>Geral</Link>
      </div>

      {rows.length >= 3 && (
        <div className="mt-10 grid grid-cols-3 items-end gap-3 md:max-w-2xl">
          {[1, 0, 2].map((i) => {
            const r = rows[i];
            const h = i === 0 ? 'h-40' : i === 1 ? 'h-28' : 'h-20';
            return (
              <Link key={r.user_id} href={`/perfil/${r.username}`} className="text-center">
                <span className="block truncate font-semibold">{r.display_name || r.username}</span>
                <span className="block text-sm text-nevoa">{r.xp} pts</span>
                <span className={`mt-2 grid ${h} place-items-start justify-center rounded-t-capa pt-3 font-display text-4xl font-extrabold ${i === 0 ? 'bg-sol text-noite' : 'bg-palco text-luar'}`}>
                  {i + 1}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <ol className="mt-8 max-w-2xl divide-y divide-lona">
        {rows.map((r, i) => (
          <li key={r.user_id}>
            <Link href={`/perfil/${r.username}`} className={`flex items-center gap-4 px-2 py-3 hover:bg-lona ${user?.id === r.user_id ? 'bg-lona' : ''}`}>
              <span className="w-8 text-right font-display text-xl font-bold text-nevoa">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.display_name || r.username}</span>
                <span className="block text-xs text-nevoa">{levelInfo(r.total_xp).name}</span>
              </span>
              <span className="tabular-nums">{r.xp} pts</span>
            </Link>
          </li>
        ))}
      </ol>
      {!rows.length && <p className="mt-8 text-nevoa">Ninguém pontuou ainda nesse período. Toque uma música até o fim e o primeiro lugar é seu.</p>}
    </>
  );
}
