import { getSessionProfile } from '@/lib/supabase/server';
import { BoostForm } from '@/components/studio/Forms';
import { brl, formatCount } from '@/lib/media';
import { placementLabel } from '@/lib/labels';

export const revalidate = 0;

export default async function Impulsionar({ params }: { params: { artistId: string } }) {
  const { supabase, profile } = await getSessionProfile();
  const [{ data: releases }, { data: price }, { data: boosts }] = await Promise.all([
    supabase.from('releases').select('id, title').eq('artist_id', params.artistId).eq('status', 'ready').order('publish_at', { ascending: false }),
    supabase.from('settings').select('value').eq('key', 'boost_day_cents').single(),
    supabase.from('boosts').select('id, placement, days, amount_cents, status, starts_at, ends_at, impressions, clicks, releases(title)').eq('artist_id', params.artistId).neq('status', 'pending_payment').order('created_at', { ascending: false }),
  ]);
  type B = { id: string; placement: string; days: number; amount_cents: number; status: string; ends_at: string | null; impressions: number; clicks: number; releases: { title: string } };
  return (
    <>
      <h1 className="titulo-sm">Impulsionar lançamento</h1>
      <p className="mt-2 max-w-[60ch] text-nevoa">Seu CD aparece com o selo Patrocinado no lugar que você escolher. Começa assim que o Pix cair.</p>
      <div className="mt-6"><BoostForm artistId={params.artistId} releases={releases || []} prices={(price?.value as Record<string, number>) || {}} defaultName={profile?.display_name} /></div>
      <ul className="mt-8 divide-y divide-lona">
        {((boosts as unknown as B[]) || []).map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{b.releases.title}</p>
              <p className="text-sm text-nevoa">{placementLabel[b.placement]}, {b.days} dias, {brl(b.amount_cents)}{b.ends_at ? `, até ${new Date(b.ends_at).toLocaleDateString('pt-BR')}` : ''}</p>
            </div>
            <span className="text-sm tabular-nums text-nevoa">{formatCount(b.impressions)} exibições, {formatCount(b.clicks)} cliques</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${b.status === 'active' ? 'bg-mandacaru/20 text-mandacaru' : 'bg-palco text-nevoa'}`}>{b.status === 'active' ? 'No ar' : 'Encerrado'}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
