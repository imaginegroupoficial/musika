import Link from 'next/link';
import { getSessionProfile } from '@/lib/supabase/server';
import { brl } from '@/lib/media';
import { campaignStatus } from '@/lib/labels';
import { getSite } from '@/lib/site';

export const metadata = { title: 'Anunciar no Paredão Play' };
export const revalidate = 0;


export default async function Anunciar() {
  const { supabase, user } = await getSessionProfile();
  const { texts: t } = await getSite();
  const { data: rows } = await supabase.from('settings').select('key, value').in('key', ['cpm_audio_cents', 'cpm_banner_cents', 'min_campaign_cents']);
  const cfg = Object.fromEntries((rows || []).map((r) => [r.key, Number(r.value)]));
  const { data: campaigns } = user
    ? await supabase.from('ad_campaigns').select('id, name, kind, status, budget_cents, spent_cents, created_at').eq('owner_id', user.id).order('created_at', { ascending: false })
    : { data: [] };

  return (
    <>
      <h1 className="titulo-xl max-w-[18ch]">{t.ads_title}</h1>
      <p className="mt-5 max-w-[60ch] text-lg text-nevoa">
        {t.ads_intro}
      </p>

      <div className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
        <div className="rounded-capa bg-lona p-5">
          <p className="text-sm text-nevoa">Áudio entre faixas</p>
          <p className="font-display text-3xl font-extrabold">{brl(cfg.cpm_audio_cents || 2500)}</p>
          <p className="text-sm text-nevoa">a cada mil execuções</p>
        </div>
        <div className="rounded-capa bg-lona p-5">
          <p className="text-sm text-nevoa">Banner</p>
          <p className="font-display text-3xl font-extrabold">{brl(cfg.cpm_banner_cents || 800)}</p>
          <p className="text-sm text-nevoa">a cada mil exibições</p>
        </div>
        <div className="rounded-capa bg-lona p-5">
          <p className="text-sm text-nevoa">Investimento mínimo</p>
          <p className="font-display text-3xl font-extrabold">{brl(cfg.min_campaign_cents || 5000)}</p>
          <p className="text-sm text-nevoa">por campanha</p>
        </div>
      </div>

      <Link href={user ? '/anunciar/nova' : '/entrar?voltar=/anunciar/nova'} className="mt-8 inline-flex h-12 items-center rounded-full bg-sol px-6 font-semibold text-noite">
        Criar campanha
      </Link>

      {user && (campaigns || []).length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-2xl font-bold">Suas campanhas</h2>
          <ul className="max-w-3xl divide-y divide-lona">
            {(campaigns || []).map((c) => (
              <li key={c.id}>
                <Link href={`/anunciar/${c.id}`} className="flex items-center gap-4 py-3 hover:text-sol">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="text-sm text-nevoa">{c.kind === 'audio' ? 'Áudio' : 'Banner'}, {brl(Number(c.spent_cents) || 0)} de {brl(c.budget_cents)}</span>
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${campaignStatus[c.status].cls}`}>{campaignStatus[c.status].text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
