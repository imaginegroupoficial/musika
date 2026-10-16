import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { brl, coverUrl } from '@/lib/media';
import PixCheckout from './PixCheckout';
import RpcButton from './RpcButton';

type Props = { artistId: string; artistName: string; userId: string | null; isMember: boolean; defaultName?: string | null };

export async function ArtistSections({ artistId, artistName, userId }: Props) {
  const supabase = createClient();
  const nowIso = new Date().toISOString();
  const [events, posts, missions, rewards, progress, score] = await Promise.all([
    supabase.from('events').select('id, title, venue, city, uf, starts_at, ticket_url').eq('artist_id', artistId).gte('starts_at', new Date(Date.now() - 12 * 36e5).toISOString()).order('starts_at').limit(8),
    supabase.from('artist_posts').select('id, body, image_path, fanclub_only, created_at').eq('artist_id', artistId).order('created_at', { ascending: false }).limit(6),
    supabase.from('missions').select('id, title, description, goal, points, ends_at, kind').eq('artist_id', artistId).eq('active', true).lte('starts_at', nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`),
    supabase.from('rewards').select('id, title, description, cost_points, stock').eq('artist_id', artistId).eq('active', true).order('cost_points'),
    userId ? supabase.from('mission_progress').select('mission_id, progress, completed_at').eq('user_id', userId) : Promise.resolve({ data: [] }),
    userId ? supabase.from('fan_scores').select('xp, spent').eq('user_id', userId).eq('artist_id', artistId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const prog = new Map((progress.data || []).map((p: { mission_id: string; progress: number; completed_at: string | null }) => [p.mission_id, p]));
  const balance = score.data ? (score.data as { xp: number; spent: number }).xp - (score.data as { xp: number; spent: number }).spent : 0;
  const howTo: Record<string, string> = { listen_release: 'faixas ouvidas até o fim', listen_tracks: 'faixas ouvidas até o fim', share: 'amigos que ouviram pelo seu link', checkin: 'check-ins em show' };

  return (
    <>
      {(events.data || []).length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">Agenda</h2>
          <ul className="divide-y divide-lona">
            {(events.data || []).map((e) => {
              const d = new Date(e.starts_at);
              return (
                <li key={e.id} className="flex items-center gap-4 py-3">
                  <div className="w-14 shrink-0 rounded-xl bg-lona py-2 text-center">
                    <span className="block font-display text-2xl font-extrabold leading-none">{d.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'America/Bahia' })}</span>
                    <span className="text-xs text-nevoa">{d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Bahia' }).replace('.', '')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.title}</p>
                    <p className="truncate text-sm text-nevoa">{[e.venue, e.city && `${e.city}${e.uf ? `/${e.uf}` : ''}`].filter(Boolean).join(', ')}, {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' })}</p>
                  </div>
                  {e.ticket_url && <a href={e.ticket_url} target="_blank" rel="noopener" className="h-10 shrink-0 rounded-full bg-sol px-4 pt-2 text-sm font-semibold text-noite">Ingressos</a>}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-sm text-nevoa">No show, escaneie o QR do telão e ganhe 50 pontos com {artistName}.</p>
        </section>
      )}

      {(missions.data || []).length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">Missões</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(missions.data || []).map((m) => {
              const p = prog.get(m.id);
              const done = !!p?.completed_at;
              const pct = Math.min(100, Math.round(((p?.progress || 0) / m.goal) * 100));
              return (
                <li key={m.id} className={`rounded-capa border p-4 ${done ? 'border-mandacaru bg-mandacaru/10' : 'border-palco'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{m.title}</p>
                    <span className="shrink-0 rounded-full bg-sol/20 px-2.5 py-0.5 text-sm font-semibold text-sol">+{m.points}</span>
                  </div>
                  {m.description && <p className="mt-1 text-sm text-nevoa">{m.description}</p>}
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-noite"><div className="h-full rounded-full bg-mandacaru" style={{ width: `${done ? 100 : pct}%` }} /></div>
                  <p className="mt-1.5 text-xs text-nevoa">
                    {done ? 'Missão cumprida' : `${p?.progress || 0} de ${m.goal} ${howTo[m.kind]}`}
                    {m.ends_at && !done ? `, até ${new Date(m.ends_at).toLocaleDateString('pt-BR')}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
          {!userId && <p className="mt-2 text-sm"><Link href="/entrar" className="font-semibold text-sol">Entre</Link> para o progresso contar.</p>}
        </section>
      )}

      {(rewards.data || []).length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">Recompensas</h2>
            {userId && <p className="text-sm text-nevoa">Seu saldo com {artistName}: <strong className="text-luar">{balance} pontos</strong></p>}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(rewards.data || []).map((r) => (
              <li key={r.id} className="flex flex-col rounded-capa bg-lona p-4">
                <p className="font-semibold">{r.title}</p>
                {r.description && <p className="mt-1 text-sm text-nevoa">{r.description}</p>}
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <span className="text-sm"><strong className="font-display text-xl">{r.cost_points}</strong> pontos, {r.stock > 0 ? `${r.stock} ${r.stock === 1 ? 'restante' : 'restantes'}` : 'esgotado'}</span>
                  {userId && r.stock > 0 && balance >= r.cost_points && (
                    <RpcButton fn="redeem_reward" args={{ p_reward: r.id }} prompt={{ text: 'Seu WhatsApp com DDD para o artista combinar a entrega:', arg: 'p_contact' }} label="Resgatar" done="Resgate feito. O artista vai te chamar." className="h-9 rounded-full bg-sol px-4 text-sm font-semibold text-noite" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(posts.data || []).length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">Mural</h2>
          <ul className="space-y-4">
            {(posts.data || []).map((p) => (
              <li key={p.id} className="rounded-capa bg-lona p-5">
                {p.fanclub_only && <p className="mb-2 text-xs font-semibold text-sol">Só para o fã-clube</p>}
                <p className="whitespace-pre-line leading-relaxed">{p.body}</p>
                {p.image_path && <img src={coverUrl(p.image_path) || ''} alt="" className="mt-3 max-h-96 rounded-xl object-cover" />}
                <p className="mt-3 text-xs text-nevoa">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export async function FanClubCard({ artistId, artistName, userId, isMember, defaultName }: Props) {
  const supabase = createClient();
  const { data: plan } = await supabase.from('fanclub_plans').select('price_cents, perks, active').eq('artist_id', artistId).maybeSingle();
  if (!plan?.active) return null;
  const { data: m } = userId ? await supabase.from('fanclub_members').select('member_until').eq('artist_id', artistId).eq('user_id', userId).maybeSingle() : { data: null };
  const until = m?.member_until ? new Date(m.member_until) : null;
  const active = until && until > new Date();
  return (
    <div className="mt-6 rounded-capa border border-sol/50 bg-sol/10 p-5">
      <h2 className="font-display text-xl font-bold">Fã-clube {artistName}</h2>
      <p className="mt-1 whitespace-pre-line text-sm text-nevoa">{plan.perks || 'Mural exclusivo e selo de sócio no seu perfil.'}</p>
      {active ? (
        <p className="mt-4 text-sm font-semibold text-sol">Você é sócio até {until!.toLocaleDateString('pt-BR')}.</p>
      ) : null}
      {!isMember && (
        <div className="mt-4">
          <PixCheckout purpose="fanclub" refId={artistId} label={active ? 'Renovar por 30 dias' : `Entrar por ${brl(plan.price_cents)}/mês`} amountCents={plan.price_cents} loggedIn={!!userId} defaultName={defaultName} className="h-11 w-full rounded-full bg-sol px-5 font-semibold text-noite" />
        </div>
      )}
    </div>
  );
}
