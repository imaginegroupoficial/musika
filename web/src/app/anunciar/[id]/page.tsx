import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import PixCheckout from '@/components/PixCheckout';
import CampaignPauseButton from '@/components/CampaignPauseButton';
import { adMediaUrl, brl, formatCount } from '@/lib/media';
import { campaignStatus } from '@/lib/labels';

export const revalidate = 0;

type Report = { impressions: number; clicks: number; completes: number; reach: number; spent_cents: number; daily: { day: string; impressions: number }[] };

export default async function Campanha({ params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user) redirect(`/entrar?voltar=/anunciar/${params.id}`);
  const { data: c } = await supabase.from('ad_campaigns').select('*').eq('id', params.id).maybeSingle();
  if (!c) notFound();
  const { data: rep } = await supabase.rpc('campaign_report', { p_campaign: c.id });
  const r = rep as Report;
  const st = campaignStatus[c.status];
  const media = adMediaUrl(c.media_path);
  const ctr = r.impressions ? ((r.clicks / r.impressions) * 100).toFixed(1).replace('.', ',') : '0';
  const maxDay = Math.max(1, ...r.daily.map((d) => d.impressions));

  return (
    <div className="max-w-4xl">
      <Link href="/anunciar" className="text-sm font-semibold text-nevoa hover:text-luar">Suas campanhas</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">{c.name}</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${st.cls}`}>{st.text}</span>
      </div>
      <p className="mt-2 text-nevoa">{c.kind === 'audio' ? `Áudio de ${c.duration_sec || '?'} s` : 'Banner'} de {c.advertiser}. {c.target_genres.length ? c.target_genres.join(', ') : 'Todos os estilos'}; {c.target_ufs.length ? c.target_ufs.join(', ') : 'Brasil todo'}.</p>

      {c.status === 'pending_payment' && (
        <div className="mt-6 rounded-capa border border-sol/40 bg-sol/10 p-5">
          <p className="font-semibold">Falta só o pagamento de {brl(c.budget_cents)} para a campanha ir para análise.</p>
          <div className="mt-4"><PixCheckout purpose="ad_campaign" refId={c.id} label="Pagar com Pix" amountCents={c.budget_cents} loggedIn defaultName={profile?.display_name} /></div>
        </div>
      )}
      {c.status === 'pending_review' && <p className="mt-6 rounded-capa bg-lona p-5">Pagamento recebido. A equipe do Paredão Play revisa o anúncio em até 1 dia útil.</p>}
      {c.status === 'rejected' && <p className="mt-6 rounded-capa bg-chita/15 p-5">Campanha recusada{c.review_note ? `: ${c.review_note}` : '.'} Fale com a gente para ajustar e reaproveitar o valor pago.</p>}
      {(c.status === 'active' || c.status === 'paused') && <div className="mt-6"><CampaignPauseButton id={c.id} paused={c.status === 'paused'} /></div>}

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-5">
        {[
          ['Exibições', formatCount(r.impressions)],
          ['Pessoas alcançadas', formatCount(r.reach)],
          ['Cliques', formatCount(r.clicks)],
          ['Taxa de clique', `${ctr}%`],
          ['Investido', `${brl(Number(r.spent_cents))} de ${brl(c.budget_cents)}`],
        ].map(([k, v]) => (
          <div key={k}><dt className="text-sm text-nevoa">{k}</dt><dd className="font-display text-2xl font-extrabold">{v}</dd></div>
        ))}
      </dl>
      {c.kind === 'audio' && r.impressions > 0 && <p className="mt-3 text-sm text-nevoa">{Math.round((r.completes / r.impressions) * 100)}% ouviram o anúncio até o fim.</p>}

      {r.daily.length > 0 && (
        <section className="mt-8 rounded-capa bg-lona p-5">
          <h2 className="mb-3 font-display text-xl font-bold">Exibições por dia</h2>
          <div className="flex h-32 items-end gap-1">
            {r.daily.map((d) => (
              <div key={d.day} title={`${new Date(String(d.day).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR')}: ${d.impressions}`} className="max-w-[40px] flex-1 rounded-t bg-chita" style={{ height: `${(d.impressions / maxDay) * 100}%` }} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl font-bold">Anúncio</h2>
        {media && c.kind === 'audio' && <audio controls src={media} className="w-full max-w-md" />}
        {media && c.kind === 'banner' && <img src={media} alt="" className="aspect-[4/1] w-full max-w-2xl rounded-capa object-cover" />}
        {c.headline && <p className="mt-2">{c.headline}</p>}
        {c.click_url && <p className="mt-1 text-sm text-nevoa">{c.click_url}</p>}
      </section>
    </div>
  );
}
