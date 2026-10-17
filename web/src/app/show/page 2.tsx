'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const msgs: Record<string, string> = {
  codigo: 'Código não encontrado ou vencido. Ele muda a cada 30 segundos; confira no telão.',
  login: 'Entre na sua conta para fazer check-in.',
};

export default function Show() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [res, setRes] = useState<{ ok?: boolean; points?: number; already?: boolean; error?: string } | null>(null);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.push('/entrar?voltar=/show');
    const { data } = await supabase.rpc('event_checkin_by_code', { p_code: code });
    setRes(data);
  };
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="font-display text-5xl font-extrabold leading-[0.95]">Check-in no show</h1>
      {res?.ok ? (
        <>
          <p className="mt-8 font-display text-6xl font-extrabold text-sol">{res.already ? 'Já está!' : `+${res.points}`}</p>
          <p className="mt-3 text-lg">{res.already ? 'Seu check-in neste show já tinha sido feito.' : 'Check-in confirmado. Curte o show!'}</p>
          <Link href="/" className="mt-8 inline-flex h-12 items-center rounded-full border border-luar/40 px-6 font-semibold">Voltar ao início</Link>
        </>
      ) : (
        <form onSubmit={send} className="mt-8">
          <p className="mb-4 text-nevoa">Digite o código de 6 letras e números que aparece no telão.</p>
          {res?.error && <p className="mb-4 rounded-lg bg-chita/15 px-3 py-2" role="alert">{msgs[res.error] || 'Não foi possível fazer o check-in.'}</p>}
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} aria-label="Código do telão" className="field text-center font-display text-3xl tracking-[0.3em]" />
          <button className="mt-4 h-12 w-full rounded-full bg-sol font-semibold text-noite">Fazer check-in</button>
        </form>
      )}
    </div>
  );
}
