'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';

// Botão genérico que chama uma função do banco e atualiza a página
export default function RpcButton({
  fn, args, label, done, confirm, className, prompt,
}: {
  fn: string;
  args: Record<string, unknown>;
  label: string;
  done?: string;
  confirm?: string;
  prompt?: { text: string; arg: string };
  className?: string;
}) {
  const router = useRouter();
  const toast = usePlayer((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const click = async () => {
    if (confirm && !window.confirm(confirm)) return;
    const extra: Record<string, unknown> = {};
    if (prompt) {
      const v = window.prompt(prompt.text);
      if (v === null) return;
      extra[prompt.arg] = v;
    }
    setBusy(true);
    const { data, error } = await createClient().rpc(fn, { ...args, ...extra });
    setBusy(false);
    if (error) return toast(error.message);
    if (data && typeof data === 'object' && 'ok' in data && !(data as { ok: boolean }).ok) {
      const err = (data as { error?: string }).error;
      return toast(err ? `Não deu: ${err.replace(/_/g, ' ')}` : 'Não foi possível concluir');
    }
    if (done) toast(done);
    router.refresh();
  };
  return (
    <button onClick={click} disabled={busy} className={className || 'h-10 rounded-full border border-luar/40 px-4 text-sm font-semibold hover:border-luar disabled:opacity-50'}>
      {busy ? 'Aguarde…' : label}
    </button>
  );
}
