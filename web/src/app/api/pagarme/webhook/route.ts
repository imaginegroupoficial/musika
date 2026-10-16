import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getOrderStatus } from '@/lib/pagarme';

// Configure no painel do Pagar.me: https://musika.tech/api/pagarme/webhook?token=SEU_TOKEN
// Eventos: order.paid, charge.paid, order.payment_failed, order.canceled
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!process.env.PAGARME_WEBHOOK_TOKEN || token !== process.env.PAGARME_WEBHOOK_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const evt = await request.json().catch(() => null);
  const data = evt?.data || {};
  const orderId: string | undefined = typeof data.id === 'string' && data.id.startsWith('or_') ? data.id : data.order?.id;
  if (!orderId) return NextResponse.json({ ok: true, ignored: true });

  const admin = createAdminClient();
  const { data: p } = await admin.from('payments').select('id, status').eq('provider_order_id', orderId).maybeSingle();
  if (!p) return NextResponse.json({ ok: true, unknown: true });

  // nunca confiar só no corpo do webhook: confirma o status direto no Pagar.me
  const status = await getOrderStatus(orderId);
  if (status === 'paid') await admin.rpc('apply_payment', { p_payment: p.id });
  else if ((status === 'failed' || status === 'canceled') && p.status === 'pending') await admin.from('payments').update({ status }).eq('id', p.id);
  return NextResponse.json({ ok: true });
}
