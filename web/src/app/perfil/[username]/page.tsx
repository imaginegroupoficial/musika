import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import { avatarUrl, levelInfo } from '@/lib/media';

export const revalidate = 0;

export async function generateMetadata({ params }: { params: { username: string } }) {
  return { title: `@${params.username}` };
}

export default async function PerfilPage({ params }: { params: { username: string } }) {
  const { supabase, user } = await getSessionProfile();
  const { data: p } = await supabase.from('profiles').select('*').eq('username', params.username).maybeSingle();
  if (!p) notFound();

  const [badges, allBadges, fanOf] = await Promise.all([
    supabase.from('user_badges').select('code, granted_at').eq('user_id', p.id),
    supabase.from('badges').select('*'),
    supabase.from('fan_scores').select('xp, artists(slug, name)').eq('user_id', p.id).order('xp', { ascending: false }).limit(10),
  ]);
  const owned = new Set((badges.data || []).map((b) => b.code));
  const lv = levelInfo(p.xp);
  const pct = lv.next ? Math.round(((p.xp - lv.floor) / (lv.next - lv.floor)) * 100) : 100;
  const isMe = user?.id === p.id;

  return (
    <>
      <div className="flex flex-wrap items-end gap-5 md:gap-7">
        {avatarUrl(p.avatar_url) ? (
          <img src={avatarUrl(p.avatar_url)!} alt="" className="h-28 w-28 shrink-0 rounded-full object-cover ring-4 ring-sol md:h-36 md:w-36" />
        ) : (
          <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-sol font-display text-5xl font-black uppercase text-noite md:h-36 md:w-36">{(p.display_name || p.username).slice(0, 1)}</span>
        )}
        <div className="min-w-0">
          <p className="text-nevoa">@{p.username}{p.city ? ` · ${p.city}${p.uf ? `/${p.uf}` : ''}` : ''}</p>
          <h1 className="titulo-xl mt-1">{p.display_name || p.username}</h1>
        </div>
      </div>
      {p.bio && <p className="mt-5 max-w-[60ch] whitespace-pre-line text-lg">{p.bio}</p>}

      <section className="mt-8 max-w-xl rounded-capa bg-lona p-6">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-3xl font-extrabold text-sol">{lv.name}</span>
          <span className="tabular-nums text-nevoa">{p.xp} pontos</span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-noite">
          <div className="h-full rounded-full bg-mandacaru" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-nevoa">
          {lv.next ? `Faltam ${lv.next - p.xp} pontos para o próximo nível.` : 'Nível máximo. Respeito.'}
          {p.streak > 0 ? ` Sequência atual: ${p.streak} ${p.streak === 1 ? 'dia' : 'dias'}.` : ''}
        </p>
        {isMe && <Link href="/conta#perfil" className="mt-4 inline-block text-sm font-semibold text-sol">Editar perfil e configurações</Link>}
        {isMe && (
          <p className="mt-4 text-sm">
            Compartilhe qualquer CD pelo botão Compartilhar: cada amigo que ouvir pelo seu link vale 5 pontos.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl font-bold">Insígnias</h2>
        <ul className="grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
          {(allBadges.data || []).map((b) => (
            <li key={b.code} className={`rounded-capa border p-4 ${owned.has(b.code) ? 'border-sol bg-sol/10' : 'border-lona opacity-50'}`}>
              <span className="text-3xl" aria-hidden>{b.icon}</span>
              <span className="mt-2 block font-semibold">{b.name}</span>
              <span className="mt-1 block text-xs text-nevoa">{b.description}</span>
            </li>
          ))}
        </ul>
      </section>

      {(fanOf.data || []).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-2xl font-bold">Fã de</h2>
          <ul className="max-w-xl divide-y divide-lona">
            {((fanOf.data as unknown as { xp: number; artists: { slug: string; name: string } }[]) || []).map((f) => (
              <li key={f.artists.slug} className="flex items-center justify-between py-3">
                <Link href={`/${f.artists.slug}`} className="font-medium hover:text-sol">{f.artists.name}</Link>
                <span className="text-sm text-nevoa">{levelInfo(f.xp).name}, {f.xp} pts</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
