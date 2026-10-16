// Pagar.me API v5: pedidos com Pix. Só roda no servidor.
const BASE = 'https://api.pagar.me/core/v5';

function auth() {
  const key = process.env.PAGARME_SECRET_KEY;
  if (!key) throw new Error('PAGARME_SECRET_KEY não configurada');
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64');
}

export const pagarmeEnabled = () => !!process.env.PAGARME_SECRET_KEY;

export type PixCustomer = { name: string; email: string; document: string; phone: string };

export async function createPixOrder(opts: { paymentId: string; amountCents: number; description: string; customer: PixCustomer; expiresIn?: number }) {
  const digits = opts.customer.phone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  const body = {
    code: opts.paymentId,
    items: [{ amount: opts.amountCents, description: opts.description.slice(0, 250), quantity: 1, code: opts.paymentId.slice(0, 50) }],
    customer: {
      name: opts.customer.name.slice(0, 64),
      email: opts.customer.email,
      type: 'individual',
      document: opts.customer.document.replace(/\D/g, ''),
      phones: { mobile_phone: { country_code: '55', area_code: digits.slice(0, 2), number: digits.slice(2) } },
    },
    payments: [{ payment_method: 'pix', pix: { expires_in: opts.expiresIn ?? 3600, additional_information: [{ name: 'Produto', value: opts.description.slice(0, 60) }] } }],
    metadata: { payment_id: opts.paymentId },
  };
  const res = await fetch(`${BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.message || JSON.stringify(json?.errors || json).slice(0, 300);
    throw new Error(`Pagar.me recusou o pedido: ${msg}`);
  }
  const tx = json?.charges?.[0]?.last_transaction || {};
  if (json.status === 'failed' || !tx.qr_code) throw new Error('Pagar.me não gerou o Pix. Confira CPF e telefone.');
  return { orderId: json.id as string, qrCode: tx.qr_code as string, qrUrl: tx.qr_code_url as string, expiresAt: tx.expires_at as string };
}

export async function getOrderStatus(orderId: string): Promise<'paid' | 'pending' | 'failed' | 'canceled' | string> {
  const res = await fetch(`${BASE}/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: auth() }, cache: 'no-store' });
  if (!res.ok) return 'unknown';
  const json = await res.json();
  return json.status;
}

export function validCpf(cpf: string) {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}
