import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getOrderStatus, pagarmeEnabled } from '@/lib/pagarme';

// O navegador consulta aqui enquanto mostra o QR. Se o webhook ainda não chegou, perguntamos direto ao Pagar.me.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: p } = await supabase.from('payments').select('id, status, provider_order_id, applied_at').eq('id', params.id).maybeSingle();
  if (!p) return NextResponse.json({ status: 'not_found' }, { status: 404 });
  if (p.status === 'pending' && p.provider_order_id && pagarmeEnabled()) {
    const st = await getOrderStatus(p.provider_order_id);
    const admin = createAdminClient();
    if (st === 'paid') {
      await admin.rpc('apply_payment', { p_payment: p.id });
      return NextResponse.json({ status: 'paid' });
    }
    if (st === 'failed' || st === 'canceled') {
      await admin.from('payments').update({ status: st }).eq('id', p.id);
      return NextResponse.json({ status: st });
    }
  }
  return NextResponse.json({ status: p.status });
}
