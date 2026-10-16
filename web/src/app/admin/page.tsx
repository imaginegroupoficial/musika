import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import RpcButton from '@/components/RpcButton';
import SettingsForm from './settings-form';
import { adMediaUrl, brl, formatCount } from '@/lib/media';
import { campaignStatus } from '@/lib/labels';

export const metadata = { title: 'Administração' };
export const revalidate = 0;

const tabs = [
  ['visao', 'Visão geral'],
  ['campanhas', 'Campanhas'],
  ['pagamentos', 'Pagamentos'],
  ['artistas', 'Artistas'],
  ['denuncias', 'Denúncias'],
  ['repasses', 'Repasses'],
  ['config', 'Preços e regras'],
] as const;

const purposeLabel: Record<string, string> = { premium: 'Premium', fanclub: 'Fã-clube', boost: 'Impulsionamento', ad_campaign: 'Anúncio' };

export default async function Admin({ searchParams }: { searchParams: { aba?: string; q?: string } }) {
  const { supabase, profile } = await getSessionProfile();
  if (!profile?.is_admin) notFound();
  const aba = tabs.find(([k]) => k === searchParams.aba)?.[0] || 'visao';

  let body: React.ReactNode = null;

  if (aba === 'visao') {
    const { data } = await supabase.rpc('admin_overview');
    const o = data as Record<string, number> & { revenue_by_purpose: Record<string, number> };
    const cards = [
      ['Usuários', formatCount(o.users)], ['Artistas', formatCount(o.artists)], ['Lançamentos no ar', formatCount(o.releases)],
      ['Plays hoje', formatCount(o.plays_today)], ['Plays em 30 dias', formatCount(o.plays_30d)], ['Premium ativos', formatCount(o.premium_active)],
      ['Receita em 30 dias', brl(o.revenue_30d_cents)], ['Exibições de anúncio (30 d)', formatCount(o.ad_impressions_30d)], ['Repasses a fazer', brl(o.payouts_due_cents)],
    ];
    body = (
      <>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
          {cards.map(([k, v]) => <div key={k}><dt className="text-sm text-nevoa">{k}</dt><dd className="font-display text-4xl font-extrabold tabular-nums">{v}</dd></div>)}
        </dl>
        <h2 className="mt-10 font-display text-xl font-bold">Receita por tipo, 30 dias</h2>
        <ul className="mt-3 max-w-md divide-y divide-lona">
          {Object.entries(o.revenue_by_purpose || {}).map(([k, v]) => <li key={k} className="flex justify-between py-2"><span>{purposeLabel[k] || k}</span><span className="tabular-nums">{brl(v)}</span></li>)}
          {!Object.keys(o.revenue_by_purpose || {}).length && <li className="py-2 text-nevoa">Nenhum pagamento confirmado ainda.</li>}
        </ul>
        <p className="mt-8 text-nevoa">{o.pending_review} campanhas esperando análise e {o.open_reports} denúncias abertas.</p>
      </>
    );
  }

  if (aba === 'campanhas') {
    const { data } = await supabase.from('ad_campaigns').select('*, profiles(username)').order('created_at', { ascending: false }).limit(100);
    type C = { id: string; name: string; advertiser: string; kind: string; status: string; media_path: string | null; headline: string | null; click_url: string | null; budget_cents: number; spent_cents: number; target_genres: string[]; target_ufs: string[]; profiles: { username: string } };
    const list = (data as unknown as C[]) || [];
    const pending = list.filter((c) => c.status === 'pending_review');
    body = (
      <>
        <h2 className="font-display text-xl font-bold">Para analisar ({pending.length})</h2>
        <ul className="mt-4 space-y-4">
          {pending.map((c) => {
            const media = adMediaUrl(c.media_path);
            return (
              <li key={c.id} className="rounded-capa bg-lona p-5">
                <p className="font-display text-xl font-bold">{c.name} <span className="font-body text-base font-normal text-nevoa">de {c.advertiser}, por @{c.profiles.username}</span></p>
                <p className="mt-1 text-sm text-nevoa">{c.kind === 'audio' ? 'Áudio' : 'Banner'}, {brl(c.budget_cents)}, {c.target_genres.join(', ') || 'todos os estilos'}, {c.target_ufs.join(', ') || 'Brasil'}</p>
                {c.headline && <p className="mt-2">{c.headline}</p>}
                {c.click_url && <a href={c.click_url} target="_blank" rel="noopener" className="text-sm text-sol">{c.click_url}</a>}
                <div className="mt-3">
                  {media && c.kind === 'audio' && <audio controls src={media} className="w-full max-w-md" />}
                  {media && c.kind === 'banner' && <img src={media} alt="" className="aspect-[4/1] w-full max-w-2xl rounded-xl object-cover" />}
                </div>
                <div className="mt-4 flex gap-2">
                  <RpcButton fn="admin_review_campaign" args={{ p_campaign: c.id, p_approve: true, p_note: null }} label="Aprovar e colocar no ar" done="Campanha no ar" className="h-10 rounded-full bg-mandacaru px-5 text-sm font-semibold text-noite" />
                  <RpcButton fn="admin_review_campaign" args={{ p_campaign: c.id, p_approve: false }} prompt={{ text: 'Motivo da recusa (o anunciante vai ver):', arg: 'p_note' }} label="Recusar" done="Campanha recusada" />
                </div>
              </li>
            );
          })}
          {!pending.length && <li className="text-nevoa">Nada para analisar.</li>}
        </ul>
        <h2 className="mt-10 font-display text-xl font-bold">Todas</h2>
        <ul className="mt-3 divide-y divide-lona">
          {list.filter((c) => c.status !== 'pending_review').map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <Link href={`/anunciar/${c.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-sol">{c.name} <span className="font-normal text-nevoa">de {c.advertiser}</span></Link>
              <span className="text-sm tabular-nums text-nevoa">{brl(Number(c.spent_cents))} de {brl(c.budget_cents)}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${campaignStatus[c.status].cls}`}>{campaignStatus[c.status].text}</span>
              {(c.status === 'active' || c.status === 'paused') && <RpcButton fn="set_campaign_paused" args={{ p_campaign: c.id, p_paused: c.status === 'active' }} label={c.status === 'active' ? 'Pausar' : 'Retomar'} />}
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (aba === 'pagamentos') {
    const { data } = await supabase.from('payments').select('id, purpose, description, amount_cents, status, created_at, paid_at, provider_order_id, profiles(username)').order('created_at', { ascending: false }).limit(100);
    type P = { id: string; purpose: string; description: string; amount_cents: number; status: string; created_at: string; paid_at: string | null; provider_order_id: string | null; profiles: { username: string } };
    body = (
      <ul className="divide-y divide-lona">
        {((data as unknown as P[]) || []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.description}</p>
              <p className="text-sm text-nevoa">@{p.profiles.username}, {purposeLabel[p.purpose]}, {new Date(p.created_at).toLocaleString('pt-BR')}{p.provider_order_id ? `, ${p.provider_order_id}` : ''}</p>
            </div>
            <span className="tabular-nums">{brl(p.amount_cents)}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${p.status === 'paid' ? 'bg-mandacaru/20 text-mandacaru' : p.status === 'pending' ? 'bg-sol/20 text-sol' : 'bg-palco text-nevoa'}`}>{p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : p.status === 'expired' ? 'Expirado' : p.status === 'failed' ? 'Falhou' : p.status}</span>
            {(p.status === 'pending' || p.status === 'expired') && (
              <RpcButton fn="apply_payment" args={{ p_payment: p.id }} label="Marcar como pago" confirm="Confirme que este valor caiu na conta. Isso libera o que foi comprado." done="Pagamento aplicado" />
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (aba === 'artistas') {
    const q = (searchParams.q || '').trim();
    let query = supabase.from('artists').select('id, slug, name, genre, city, uf, verified, created_at').order('created_at', { ascending: false }).limit(60);
    if (q) query = query.ilike('name', `%${q}%`);
    const { data } = await query;
    body = (
      <>
        <form className="max-w-md"><input name="q" defaultValue={q} placeholder="Buscar artista" className="field" aria-label="Buscar artista" /><input type="hidden" name="aba" value="artistas" /></form>
        <ul className="mt-4 divide-y divide-lona">
          {(data || []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <Link href={`/${a.slug}`} className="min-w-0 flex-1 truncate font-semibold hover:text-sol">{a.name} <span className="font-normal text-nevoa">{[a.genre, a.city && `${a.city}/${a.uf || ''}`].filter(Boolean).join(', ')}</span></Link>
              <RpcButton fn="admin_set_verified" args={{ p_artist: a.id, p_verified: !a.verified }} label={a.verified ? 'Tirar verificado' : 'Verificar'} done="Atualizado" className={`h-9 rounded-full px-4 text-sm font-semibold ${a.verified ? 'border border-luar/40' : 'bg-sol text-noite'}`} />
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (aba === 'denuncias') {
    const { data } = await supabase.from('reports').select('id, target_kind, target_id, reason, status, created_at, profiles(username)').order('created_at', { ascending: false }).limit(100);
    type R = { id: string; target_kind: string; target_id: string; reason: string; status: string; created_at: string; profiles: { username: string } | null };
    const kindLabel: Record<string, string> = { release: 'Lançamento', track: 'Faixa', comment: 'Comentário', artist: 'Artista', campaign: 'Campanha' };
    body = (
      <ul className="divide-y divide-lona">
        {((data as unknown as R[]) || []).map((r) => (
          <li key={r.id} className={`py-3 ${r.status !== 'open' ? 'opacity-50' : ''}`}>
            <p className="text-sm text-nevoa">{kindLabel[r.target_kind]} {r.target_id.slice(0, 8)}, por @{r.profiles?.username || '?'}, {new Date(r.created_at).toLocaleString('pt-BR')}</p>
            <p className="mt-1">{r.reason}</p>
            {r.status === 'open' && (
              <div className="mt-2 flex gap-2">
                <RpcButton fn="admin_resolve_report" args={{ p_report: r.id, p_hide: true }} label={r.target_kind === 'release' ? 'Tirar do ar' : r.target_kind === 'campaign' ? 'Pausar campanha' : 'Ocultar'} confirm="Aplicar a remoção?" done="Resolvido" className="h-9 rounded-full bg-chita px-4 text-sm font-semibold text-noite" />
                <RpcButton fn="admin_resolve_report" args={{ p_report: r.id, p_hide: false }} label="Descartar" done="Descartada" />
              </div>
            )}
          </li>
        ))}
        {!data?.length && <li className="py-3 text-nevoa">Nenhuma denúncia.</li>}
      </ul>
    );
  }

  if (aba === 'repasses') {
    const { data } = await supabase.from('artist_earnings').select('artist_id, net_cents, artists(name, slug, booking_whatsapp)').is('paid_out_at', null);
    type E = { artist_id: string; net_cents: number; artists: { name: string; slug: string; booking_whatsapp: string | null } };
    const by = new Map<string, { name: string; slug: string; phone: string | null; total: number }>();
    ((data as unknown as E[]) || []).forEach((e) => {
      const cur = by.get(e.artist_id) || { name: e.artists.name, slug: e.artists.slug, phone: e.artists.booking_whatsapp, total: 0 };
      cur.total += e.net_cents;
      by.set(e.artist_id, cur);
    });
    body = (
      <>
        <p className="max-w-[60ch] text-nevoa">Valores líquidos do fã-clube, já sem a taxa do Musika. Faça o Pix para o artista e marque como pago.</p>
        <ul className="mt-4 divide-y divide-lona">
          {[...by.entries()].map(([id, a]) => (
            <li key={id} className="flex flex-wrap items-center gap-3 py-3">
              <Link href={`/${a.slug}`} className="min-w-0 flex-1 font-semibold hover:text-sol">{a.name}</Link>
              <span className="font-display text-xl font-bold tabular-nums">{brl(a.total)}</span>
              <RpcButton fn="admin_mark_payout" args={{ p_artist: id }} label="Marcar como pago" confirm={`Confirma que fez o Pix de ${brl(a.total)} para ${a.name}?`} done="Repasse registrado" className="h-9 rounded-full bg-sol px-4 text-sm font-semibold text-noite" />
            </li>
          ))}
          {!by.size && <li className="py-3 text-nevoa">Nenhum repasse pendente.</li>}
        </ul>
      </>
    );
  }

  if (aba === 'config') {
    const { data } = await supabase.from('settings').select('key, value');
    body = <SettingsForm settings={Object.fromEntries((data || []).map((s) => [s.key, s.value]))} />;
  }

  return (
    <>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Administração</h1>
      <nav className="scroll-row -mx-4 mb-8 mt-6 flex gap-1 overflow-x-auto border-b border-lona px-4 md:mx-0 md:px-0">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/admin?aba=${k}`} className={`shrink-0 border-b-2 px-3 pb-3 pt-1 font-semibold ${aba === k ? 'border-sol text-luar' : 'border-transparent text-nevoa hover:text-luar'}`}>{l}</Link>
        ))}
      </nav>
      {body}
    </>
  );
}
