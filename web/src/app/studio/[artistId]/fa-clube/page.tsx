import { createClient } from '@/lib/supabase/server';
import { DeleteRow, FanClubPlanForm, PostForm } from '@/components/studio/Forms';
import { brl } from '@/lib/media';

export const revalidate = 0;

export default async function FaClube({ params }: { params: { artistId: string } }) {
  const supabase = createClient();
  const [{ data: plan }, { data: money }, { data: posts }] = await Promise.all([
    supabase.from('fanclub_plans').select('price_cents, perks, active').eq('artist_id', params.artistId).maybeSingle(),
    supabase.rpc('artist_money', { p_artist: params.artistId }),
    supabase.from('artist_posts').select('id, body, fanclub_only, created_at').eq('artist_id', params.artistId).order('created_at', { ascending: false }).limit(30),
  ]);
  const m = money as { members: number; pending_cents: number; paid_cents: number };
  return (
    <>
      <h1 className="titulo-sm">Fã-clube e mural</h1>
      <dl className="mt-6 grid max-w-2xl grid-cols-3 gap-4">
        <div><dt className="text-sm text-nevoa">Sócios ativos</dt><dd className="font-display text-3xl font-extrabold">{m.members}</dd></div>
        <div><dt className="text-sm text-nevoa">A receber</dt><dd className="font-display text-3xl font-extrabold">{brl(m.pending_cents)}</dd></div>
        <div><dt className="text-sm text-nevoa">Já repassado</dt><dd className="font-display text-3xl font-extrabold">{brl(m.paid_cents)}</dd></div>
      </dl>
      <p className="mt-2 text-sm text-nevoa">Valores já descontada a taxa do Paredão Play. O repasse é feito por Pix pela equipe do Paredão Play.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <FanClubPlanForm artistId={params.artistId} plan={plan} />
        <PostForm artistId={params.artistId} />
      </div>
      <ul className="mt-8 space-y-3">
        {(posts || []).map((p) => (
          <li key={p.id} className="flex items-start gap-3 rounded-capa bg-lona p-4">
            <div className="min-w-0 flex-1">
              {p.fanclub_only && <p className="text-xs font-semibold text-sol">Só para sócios</p>}
              <p className="line-clamp-3 whitespace-pre-line">{p.body}</p>
              <p className="mt-1 text-xs text-nevoa">{new Date(p.created_at).toLocaleString('pt-BR')}</p>
            </div>
            <DeleteRow table="artist_posts" id={p.id} />
          </li>
        ))}
      </ul>
    </>
  );
}
