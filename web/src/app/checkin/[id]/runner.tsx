'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const msgs: Record<string, string> = {
  codigo: 'O código venceu. Escaneie o QR do telão de novo.',
  fora_do_horario: 'O check-in abre 6 horas antes do show e fecha 12 horas depois.',
  evento: 'Evento não encontrado.',
  login: 'Entre na sua conta para fazer check-in.',
};

export default function CheckinRunner({ eventId, code, artistSlug }: { eventId: string; code: string; artistSlug: string }) {
  const [state, setState] = useState<{ ok?: boolean; points?: number; already?: boolean; error?: string } | null>(null);
  const [manual, setManual] = useState(code);
  const ran = useRef(false);

  const run = async (c: string) => {
    const { data, error } = await createClient().rpc('event_checkin', { p_event: eventId, p_code: c });
    setState(error ? { ok: false, error: 'evento' } : data);
  };
  useEffect(() => {
    if (ran.current || !code) return;
    ran.current = true;
    run(code);
  }, [code]);

  if (state?.ok) {
    return (
      <div className="mt-8">
        <p className="font-display text-6xl font-extrabold text-sol">{state.already ? 'Já está!' : `+${state.points}`}</p>
        <p className="mt-3 text-lg">{state.already ? 'Seu check-in neste show já tinha sido feito.' : 'Check-in confirmado. Curte o show!'}</p>
        <Link href={`/${artistSlug}`} className="mt-8 inline-flex h-12 items-center rounded-full border border-luar/40 px-6 font-semibold">Ver o ranking de fãs</Link>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(manual); }} className="mt-8">
      {state?.error && <p className="mb-4 rounded-lg bg-chita/15 px-3 py-2" role="alert">{msgs[state.error] || 'Não foi possível fazer o check-in.'}</p>}
      <label className="block text-left">
        <span className="mb-1 block text-sm font-medium">Código do telão</span>
        <input value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} maxLength={6} className="field text-center font-display text-3xl tracking-[0.3em]" />
      </label>
      <button className="mt-4 h-12 w-full rounded-full bg-sol font-semibold text-noite">Fazer check-in</button>
    </form>
  );
}
