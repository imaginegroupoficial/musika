'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/nova-senha` });
    setBusy(false);
    if (error && /rate|seconds/i.test(error.message)) return setError('Muitas tentativas. Espere um minuto e tente de novo.');
    // por segurança, a resposta é a mesma exista ou não a conta
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight">Esqueceu a senha?</h1>
      {sent ? (
        <>
          <p className="mt-6 text-lg">Se existir uma conta com <strong>{email}</strong>, o link para criar uma senha nova já está a caminho.</p>
          <p className="mt-3 text-nevoa">Olhe também a caixa de spam e a aba Promoções. O link vale por 1 hora.</p>
          <Link href="/entrar" className="mt-8 inline-flex h-12 items-center rounded-full border border-luar/40 px-6 font-semibold">Voltar para entrar</Link>
        </>
      ) : (
        <form onSubmit={send} className="mt-8 space-y-4">
          <p className="text-nevoa">Informe o e-mail da sua conta. Enviaremos um link para você criar uma senha nova.</p>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">E-mail</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" autoComplete="email" />
          </label>
          {error && <p className="rounded-lg bg-chita/15 px-3 py-2 text-sm" role="alert">{error}</p>}
          <button disabled={busy} className="h-12 w-full rounded-full bg-sol font-semibold text-noite disabled:opacity-60">{busy ? 'Enviando…' : 'Enviar link'}</button>
        </form>
      )}
    </div>
  );
}
