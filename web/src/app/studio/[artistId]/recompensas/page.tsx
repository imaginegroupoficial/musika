import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { DeleteRow, RewardForm, ToggleActive } from '@/components/studio/Forms';
import RpcButton from '@/components/RpcButton';

export const revalidate = 0;

export default async function Recompensas({ params }: { params: { artistId: string } }) {
  const supabase = createClient();
  const [{ data: rewards }, { data: reds }] = await Promise.all([
    supabase.from('rewards').select('*').eq('artist_id', params.artistId).order('created_at', { ascending: false }),
    supabase.from('redemptions').select('id, contact, status, cost_points, created_at, rewards(title), profiles(username, display_name)').eq('artist_id', params.artistId).order('created_at', { ascending: false }).limit(100),
  ]);
  type Red = { id: string; contact: string; status: string; cost_points: number; created_at: string; rewards: { title: string }; profiles: { username: string; display_name: string | null } };
  const pending = ((reds as unknown as Red[]) || []).filter((r) => r.status === 'pending');
  const others = ((reds as unknown as Red[]) || []).filter((r) => r.status !== 'pending');
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Recompensas</h1>
      <p className="mt-2 max-w-[60ch] text-nevoa">O fã troca os pontos que fez com você. Você entrega e marca como entregue; se cancelar, os pontos voltam para ele.</p>
      <div className="mt-6"><RewardForm artistId={params.artistId} /></div>

      <ul className="mt-8 divide-y divide-lona">
        {(rewards || []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${r.active ? '' : 'text-nevoa line-through'}`}>{r.title}</p>
              <p className="text-sm text-nevoa">{r.cost_points} pontos, {r.stock} em estoque</p>
            </div>
            <ToggleActive table="rewards" id={r.id} active={r.active} />
            <DeleteRow table="rewards" id={r.id} />
          </li>
        ))}
      </ul>

      <h2 className="mt-12 font-display text-2xl font-bold">Resgates para entregar ({pending.length})</h2>
      <ul className="mt-4 divide-y divide-lona">
        {pending.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.rewards.title}</p>
              <p className="text-sm text-nevoa">
                <Link href={`/perfil/${r.profiles.username}`} className="hover:text-luar">{r.profiles.display_name || r.profiles.username}</Link>, contato {r.contact}, {new Date(r.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <a href={`https://wa.me/55${r.contact.replace(/\D/g, '').replace(/^55/, '')}`} target="_blank" rel="noopener" className="h-9 rounded-full border border-luar/40 px-4 pt-1.5 text-sm font-semibold">WhatsApp</a>
            <RpcButton fn="set_redemption_status" args={{ p_id: r.id, p_status: 'delivered' }} label="Entregue" done="Marcado como entregue" className="h-9 rounded-full bg-mandacaru px-4 text-sm font-semibold text-noite" />
            <RpcButton fn="set_redemption_status" args={{ p_id: r.id, p_status: 'canceled' }} label="Cancelar" confirm="Cancelar e devolver os pontos ao fã?" done="Cancelado" className="h-9 rounded-full px-3 text-sm font-semibold text-nevoa hover:text-chita" />
          </li>
        ))}
        {!pending.length && <li className="py-3 text-nevoa">Nenhum resgate pendente.</li>}
      </ul>
      {others.length > 0 && <p className="mt-4 text-sm text-nevoa">{others.filter((r) => r.status === 'delivered').length} entregues e {others.filter((r) => r.status === 'canceled').length} cancelados no histórico.</p>}
    </>
  );
}
