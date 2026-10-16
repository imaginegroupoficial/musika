import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { createPixOrder, pagarmeEnabled, validCpf } from '@/lib/pagarme';

export async function POST(request: Request) {
  if (!pagarmeEnabled()) return NextResponse.json({ error: 'Pagamentos ainda não foram ativados no Paredão Play.' }, { status: 503 });
  const body = await request.json().catch(() => null);
  const { purpose, refId, name, cpf, phone } = body || {};
  if (!['premium', 'fanclub', 'boost', 'ad_campaign'].includes(purpose)) return NextResponse.json({ error: 'Pagamento inválido' }, { status: 400 });
  if (!name || String(name).trim().length < 3) return NextResponse.json({ error: 'Informe seu nome completo.' }, { status: 400 });
  if (!validCpf(String(cpf || ''))) return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 13) return NextResponse.json({ error: 'Celular inválido. Use DDD + número.' }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta para pagar.' }, { status: 401 });

  const { data: prep, error } = await supabase.rpc('prepare_payment', { p_purpose: purpose, p_ref: refId || null, p_extra: {} });
  if (error || !prep) return NextResponse.json({ error: error?.message || 'Não foi possível iniciar o pagamento.' }, { status: 400 });

  const admin = createAdminClient();
  try {
    const order = await createPixOrder({
      paymentId: prep.id,
      amountCents: prep.amount_cents,
      description: prep.description,
      customer: { name: String(name).trim(), email: user.email || 'cliente@musika.tech', document: String(cpf), phone: phoneDigits },
    });
    await admin.from('payments').update({
      provider_order_id: order.orderId,
      pix_qr_code: order.qrCode,
      pix_qr_url: order.qrUrl,
      expires_at: order.expiresAt || new Date(Date.now() + 3600e3).toISOString(),
    }).eq('id', prep.id);
    return NextResponse.json({ id: prep.id, amount_cents: prep.amount_cents, description: prep.description, qr_code: order.qrCode, qr_url: order.qrUrl, expires_at: order.expiresAt });
  } catch (e) {
    await admin.from('payments').update({ status: 'failed' }).eq('id', prep.id);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
