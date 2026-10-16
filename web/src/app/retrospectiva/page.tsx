import { SITE_HOST } from '@/lib/env';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import { coverUrl, formatCount, levelInfo } from '@/lib/media';

export const metadata = { title: 'Sua retrospectiva' };
export const revalidate = 0;

type W = {
  minutes: number; plays: number; genre: string | null; checkins: number;
  artists: { slug: string; name: string; plays: number }[];
  tracks: { title: string; artist_name: string; cover_path: string | null; plays: number }[];
};

export default async function Retrospectiva({ searchParams }: { searchParams: { periodo?: string } }) {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user) redirect('/entrar?voltar=/retrospectiva');
  const year = new Date().getFullYear();
  const sj = searchParams.periodo === 'sao-joao';
  const from = sj ? `${year}-06-01` : `${year}-01-01`;
  const to = sj ? `${year}-07-15` : `${year}-12-31`;
  const { data } = await supabase.rpc('my_wrapped', { p_from: from, p_to: to });
  const w = data as W;
  const top = w.artists[0];
  const lv = levelInfo(profile?.xp || 0);
  const tab = (on: boolean, href: string, label: string) => <Link href={href} className={`rounded-full px-4 py-2 text-sm font-semibold ${on ? 'bg-sol text-noite' : 'bg-lona text-nevoa'}`}>{label}</Link>;

  if (!w.plays) {
    return (
      <div className="max-w-xl py-10">
        <div className="flex gap-2">{tab(!sj, '/retrospectiva', `${year}`)}{tab(sj, '/retrospectiva?periodo=sao-joao', `São João ${year}`)}</div>
        <h1 className="mt-8 font-display text-5xl font-extrabold leading-[0.95]">Sua retrospectiva ainda está em branco.</h1>
        <p className="mt-4 text-nevoa">Ouça seus artistas até o fim das faixas e volte aqui para ver o seu resumo.</p>
      </div>
    );
  }

  const card = 'relative flex aspect-[9/16] w-full max-w-[360px] shrink-0 snap-center flex-col justify-between overflow-hidden rounded-[28px] p-7';
  return (
    <>
      <div className="flex gap-2">{tab(!sj, '/retrospectiva', `${year}`)}{tab(sj, '/retrospectiva?periodo=sao-joao', `São João ${year}`)}</div>
      <p className="mt-4 text-nevoa">Arraste para o lado e tire print do card para postar.</p>
      <div className="scroll-row -mx-4 mt-6 flex snap-x gap-5 overflow-x-auto px-4 pb-4">
        <div className={`${card} bg-chita text-noite`}>
          <p className="font-display text-2xl font-bold">{sj ? `Seu São João ${year}` : `Seu ${year} no Paredão Play`}</p>
          <div>
            <p className="font-display text-[88px] font-extrabold leading-none">{formatCount(w.minutes)}</p>
            <p className="font-display text-3xl font-bold">minutos de música</p>
          </div>
          <p className="font-semibold">{formatCount(w.plays)} faixas tocadas. {SITE_HOST}</p>
        </div>

        {top && (
          <div className={`${card} bg-sol text-noite`}>
            <p className="font-display text-2xl font-bold">Seu artista número 1</p>
            <p className="font-display text-[64px] font-extrabold leading-[0.9]">{top.name}</p>
            <p className="font-semibold">{top.plays} plays seus. Você é {lv.name} no Paredão Play.</p>
          </div>
        )}

        <div className={`${card} bg-lona`}>
          <p className="font-display text-2xl font-bold text-sol">Os mais ouvidos</p>
          <ol className="space-y-3">
            {w.artists.map((a, i) => (
              <li key={a.slug} className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-extrabold text-chita">{i + 1}</span>
                <span className="font-display text-2xl font-bold leading-tight">{a.name}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-nevoa">{SITE_HOST}</p>
        </div>

        {w.tracks[0] && (
          <div className={`${card} bg-mandacaru text-noite`}>
            <p className="font-display text-2xl font-bold">A música que não saiu da sua cabeça</p>
            {w.tracks[0].cover_path && <img src={coverUrl(w.tracks[0].cover_path) || ''} alt="" className="mx-auto aspect-square w-3/4 rounded-2xl object-cover" />}
            <div>
              <p className="font-display text-4xl font-extrabold leading-tight">{w.tracks[0].title}</p>
              <p className="font-semibold">{w.tracks[0].artist_name}, {w.tracks[0].plays} vezes</p>
            </div>
          </div>
        )}

        <div className={`${card} bg-palco`}>
          <p className="font-display text-2xl font-bold text-sol">Seu jeito de ouvir</p>
          <div className="space-y-4">
            {w.genre && <p className="font-display text-4xl font-extrabold">{w.genre} na veia</p>}
            {w.checkins > 0 && <p className="text-2xl font-bold">{w.checkins} {w.checkins === 1 ? 'show' : 'shows'} com check-in</p>}
            <p className="text-2xl font-bold">Nível {lv.name}, {profile?.xp || 0} pontos</p>
          </div>
          <p className="text-sm text-nevoa">{SITE_HOST}</p>
        </div>
      </div>
    </>
  );
}
