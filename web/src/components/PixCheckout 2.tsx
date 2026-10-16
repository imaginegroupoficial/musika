'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlayer } from '@/store/player';

type Props = {
  purpose: 'premium' | 'fanclub' | 'boost' | 'ad_campaign';
  refId?: string | null;
  label: string;
  amountCents: number;
  loggedIn: boolean;
  defaultName?: string | null;
  className?: string;
  onPaid?: () => void;
};

type Pix = { id: string; qr_code: string; qr_url: string; expires_at: string; description: string; amount_cents: number };

export const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function maskCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3') : d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
}

export default function PixCheckout({ purpose, refId, label, amountCents, loggedIn, defaultName, className, onPaid }: Props) {
  const router = useRouter();
  const toast = usePlayer((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'pix' | 'paid'>('form');
  const [name, setName] = useState(defaultName || '');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pix, setPix] = useState<Pix | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mk_payer') || '{}');
      if (saved.phone) setPhone(saved.phone);
      if (saved.name && !defaultName) setName(saved.name);
    } catch {}
  }, [defaultName]);

  // consulta o status a cada 4 s enquanto o QR está aberto
  useEffect(() => {
    if (step !== 'pix' || !pix) return;
    const poll = setInterval(async () => {
      const r = await fetch(`/api/payments/${pix.id}`, { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
      if (r?.status === 'paid') {
        setStep('paid');
        toast('Pagamento confirmado');
        onPaid?.();
        router.refresh();
      } else if (r?.status === 'failed' || r?.status === 'expired' || r?.status === 'canceled') {
        setError('O Pix expirou ou foi cancelado. Gere um novo.');
        setStep('form');
      }
    }, 4000);
    const tick = setInterval(() => setLeft(Math.max(0, Math.round((new Date(pix.expires_at).getTime() - Date.now()) / 1000))), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [step, pix, router, toast, onPaid]);

  const start = () => {
    if (!loggedIn) return router.push(`/entrar?voltar=${encodeURIComponent(window.location.pathname)}`);
    setOpen(true);
    setStep('form');
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { localStorage.setItem('mk_payer', JSON.stringify({ name, phone })); } catch {}
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose, refId, name, cpf, phone }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error || 'Não foi possível gerar o Pix.');
    setPix(json);
    setStep('pix');
  };

  const copy = async () => {
    if (!pix) return;
    try { await navigator.clipboard.writeText(pix.qr_code); toast('Código Pix copiado'); } catch {}
  };

  return (
    <>
      <button onClick={start} className={className || 'inline-flex h-12 items-center rounded-full bg-sol px-6 font-semibold text-noite'}>
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-noite/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Pagamento com Pix">
          <div className="w-full max-w-md rounded-capa border border-palco bg-lona p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-nevoa">{pix?.description || label}</p>
                <p className="font-display text-3xl font-extrabold">{brl(pix?.amount_cents || amountCents)}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="ctl">×</button>
            </div>

            {step === 'form' && (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Nome completo</span>
                  <input required value={name} onChange={(e) => setName(e.target.value)} className="field" autoComplete="name" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">CPF</span>
                    <input required inputMode="numeric" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} className="field" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Celular</span>
                    <input required inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} className="field" autoComplete="tel" />
                  </label>
                </div>
                <p className="text-xs text-nevoa">O Pagar.me exige CPF e celular para gerar o Pix. O Musika não guarda o seu CPF.</p>
                {error && <p className="rounded-lg bg-chita/15 px-3 py-2 text-sm" role="alert">{error}</p>}
                <button disabled={busy} className="h-12 w-full rounded-full bg-sol font-semibold text-noite disabled:opacity-60">
                  {busy ? 'Gerando Pix…' : 'Gerar Pix'}
                </button>
              </form>
            )}

            {step === 'pix' && pix && (
              <div className="mt-6 text-center">
                <img src={pix.qr_url} alt="QR Code do Pix" className="mx-auto h-56 w-56 rounded-xl bg-white p-2" />
                <button onClick={copy} className="mt-4 h-12 w-full rounded-full bg-sol font-semibold text-noite">Copiar código Pix</button>
                <p className="mt-3 text-sm text-nevoa">
                  Pague no app do seu banco. A confirmação aparece aqui sozinha.
                  {left > 0 && ` Expira em ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}.`}
                </p>
                <div className="paredao is-on mx-auto mt-4 flex w-max" aria-hidden><span /><span /><span /><span /><span /></div>
              </div>
            )}

            {step === 'paid' && (
              <div className="mt-6 text-center">
                <p className="font-display text-2xl font-bold text-mandacaru">Pagamento confirmado</p>
                <p className="mt-2 text-nevoa">Já está valendo. Obrigado por apoiar a música independente.</p>
                <button onClick={() => setOpen(false)} className="mt-6 h-12 w-full rounded-full bg-sol font-semibold text-noite">Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
