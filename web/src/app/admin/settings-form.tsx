'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';

type S = Record<string, unknown>;

const money = [
  ['premium_price_cents', 'Preço do Premium (R$)'],
  ['cpm_audio_cents', 'CPM de anúncio em áudio (R$ por mil)'],
  ['cpm_banner_cents', 'CPM de banner (R$ por mil)'],
  ['min_campaign_cents', 'Investimento mínimo por campanha (R$)'],
] as const;

export default function SettingsForm({ settings }: { settings: S }) {
  const router = useRouter();
  const toast = usePlayer((s) => s.toast);
  const boost = (settings.boost_day_cents || {}) as Record<string, number>;
  const [f, setF] = useState<Record<string, number>>({
    premium_price_cents: Number(settings.premium_price_cents) / 100,
    cpm_audio_cents: Number(settings.cpm_audio_cents) / 100,
    cpm_banner_cents: Number(settings.cpm_banner_cents) / 100,
    min_campaign_cents: Number(settings.min_campaign_cents) / 100,
    premium_days: Number(settings.premium_days),
    ad_every_n_tracks: Number(settings.ad_every_n_tracks),
    fanclub_fee_pct: Number(settings.fanclub_fee_pct),
    home_hero: (boost.home_hero || 0) / 100,
    home_row: (boost.home_row || 0) / 100,
    search: (boost.search || 0) / 100,
  });
  const [admins, setAdmins] = useState(((settings.admin_emails as string[]) || []).join(', '));
  const [busy, setBusy] = useState(false);
  const num = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const cents = (v: number) => Math.round(v * 100);
    const updates: [string, unknown][] = [
      ...money.map(([k]) => [k, cents(f[k])] as [string, unknown]),
      ['premium_days', f.premium_days],
      ['ad_every_n_tracks', f.ad_every_n_tracks],
      ['fanclub_fee_pct', f.fanclub_fee_pct],
      ['boost_day_cents', { home_hero: cents(f.home_hero), home_row: cents(f.home_row), search: cents(f.search) }],
      ['admin_emails', admins.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)],
    ];
    for (const [k, v] of updates) {
      const { error } = await supabase.rpc('admin_set_setting', { p_key: k, p_value: v });
      if (error) { setBusy(false); return toast(`Erro em ${k}: ${error.message}`); }
    }
    setBusy(false);
    toast('Configurações salvas');
    router.refresh();
  };

  const field = (k: string, label: string, step = '0.01') => (
    <label key={k} className="block"><span className="mb-1 block text-sm font-medium">{label}</span><input type="number" min={0} step={step} value={f[k]} onChange={num(k)} className="field" /></label>
  );
  return (
    <form onSubmit={save} className="max-w-3xl space-y-8">
      <section className="grid gap-4 sm:grid-cols-2">
        {money.map(([k, l]) => field(k, l))}
        {field('premium_days', 'Dias de Premium por pagamento', '1')}
        {field('ad_every_n_tracks', 'Anúncio em áudio a cada quantas faixas', '1')}
        {field('fanclub_fee_pct', 'Taxa do Musika no fã-clube (%)', '1')}
      </section>
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Impulsionamento, preço por dia (R$)</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {field('home_hero', 'Destaque principal')}
          {field('home_row', 'Fileira patrocinada')}
          {field('search', 'Topo da busca')}
        </div>
      </section>
      <label className="block"><span className="mb-1 block text-sm font-medium">E-mails com acesso de administrador (contas novas com esses e-mails já entram como admin)</span><input value={admins} onChange={(e) => setAdmins(e.target.value)} className="field" /></label>
      <button disabled={busy} className="h-12 rounded-full bg-sol px-8 font-semibold text-noite disabled:opacity-60">{busy ? 'Salvando…' : 'Salvar configurações'}</button>
    </form>
  );
}
