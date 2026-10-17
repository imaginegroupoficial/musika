import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import { coverUrl, timeAgo } from '@/lib/media';
import PushToggle from '@/components/PushToggle';
import MarkRead from './mark-read';

export const metadata = { title: 'Notificações' };
export const revalidate = 0;

type N = { id: number; kind: string; title: string; body: string | null; link: string | null; image_path: string | null; read_at: string | null; deliver_at: string; artists: { name: string; avatar_path: string | null } | null };

const kindTag: Record<string, string> = { lancamento: 'Lançamento', show: 'Show', lembrete: 'Lembrete', post: 'Mural', insignia: 'Insígnia', nivel: 'Nível', aviso: 'Aviso' };

function group(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d >= today) return 'Hoje';
  if (d.getTime() >= today.getTime() - 6 * 86400000) return 'Esta semana';
  return 'Antes';
}

export default async function Notificacoes() {
  const { supabase, user } = await getSessionProfile();
  if (!user) redirect('/entrar?voltar=/notificacoes');
  const { data } = await supabase
    .from('notifications')
    .select('id, kind, title, body, link, image_path, read_at, deliver_at, artists(name, avatar_path)')
    .order('deliver_at', { ascending: false })
    .limit(80);
  const items = (data || []) as unknown as N[];
  const unread = items.some((n) => !n.read_at);
  const groups = ['Hoje', 'Esta semana', 'Antes'].map((g) => [g, items.filter((n) => group(n.deliver_at) === g)] as const).filter(([, l]) => l.length);

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="cartaz text-[clamp(2.5rem,7vw,4.5rem)]">Avisos</h1>
        <Link href="/conta#notificacoes" className="text-sm font-semibold text-nevoa hover:text-luar">Escolher o que receber</Link>
      </div>

      <div className="mt-6">
        <PushToggle vapidKey={process.env.VAPID_PUBLIC_KEY || null} compact />
      </div>

      {!items.length && (
        <div className="mt-8 rounded-capa border-2 border-dashed border-palco p-8">
          <p className="font-display text-2xl font-bold">Nada por aqui ainda.</p>
          <p className="mt-2 text-nevoa">Siga seus artistas: quando eles lançarem música, marcarem show ou postarem no mural, você fica sabendo aqui primeiro.</p>
          <Link href="/top" className="mt-5 inline-flex h-11 items-center rounded-full bg-sol px-5 font-semibold text-noite">Descobrir artistas</Link>
        </div>
      )}

      {groups.map(([g, list]) => (
        <section key={g} className="mt-8">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-nevoa">{g}</h2>
          <ul className="divide-y divide-palco">
            {list.map((n) => {
              const img = coverUrl(n.image_path || n.artists?.avatar_path);
              const inner = (
                <>
                  <span className="relative shrink-0">
                    {img ? (
                      <img src={img} alt="" className={`h-14 w-14 object-cover ${n.image_path ? 'rounded-lg' : 'rounded-full'}`} />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sol font-display text-xl font-black text-noite">{(n.artists?.name || 'M').slice(0, 1)}</span>
                    )}
                    {!n.read_at && <span className="absolute -left-1 -top-1 h-3.5 w-3.5 rounded-full bg-chita ring-2 ring-noite" aria-label="Nova" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-sm text-nevoa">{n.body}</span>}
                    <span className="mt-1 block text-xs text-nevoa">{kindTag[n.kind] || 'Aviso'} · {timeAgo(n.deliver_at)}</span>
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} className="-mx-3 flex items-center gap-4 rounded-xl px-3 py-3 hover:bg-lona">{inner}</Link>
                  ) : (
                    <div className="-mx-3 flex items-center gap-4 px-3 py-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {unread && <MarkRead />}
    </div>
  );
}
