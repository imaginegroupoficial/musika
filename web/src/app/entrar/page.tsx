'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/components/TextsProvider';

function Form() {
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState<string | null>(null);
  const tx = useT();
  const router = useRouter();
  const params = useSearchParams();
  const back = params.get('voltar') || '/';
  const linkError = params.get('erro') === 'link';

  const resend = async (to: string) => {
    const { error } = await createClient().auth.resend({ type: 'signup', email: to, options: { emailRedirectTo: `${window.location.origin}/` } });
    setError(error ? 'Espere um minuto antes de pedir outro e-mail.' : 'Enviamos o e-mail de confirmação de novo.');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const res =
      mode === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: `${window.location.origin}/` } });
    setBusy(false);
    if (res.error) {
      const msg = res.error.message.toLowerCase();
      setError(
        msg.includes('not confirmed') ? 'Confirme seu e-mail antes de entrar. Procure o e-mail do Paredão Play na caixa de entrada e no spam.'
        : msg.includes('invalid login') ? 'E-mail ou senha não conferem.'
        : msg.includes('already registered') ? 'Esse e-mail já tem conta. Entre com a senha.'
        : msg.includes('sending') && msg.includes('email') ? 'Não conseguimos enviar o e-mail de confirmação agora. Tente de novo em alguns minutos.'
        : msg.includes('rate limit') ? 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
        : msg.includes('password') ? 'A senha precisa ter pelo menos 6 caracteres.'
        : 'Não deu certo agora. Tente de novo em instantes.',
      );
      return;
    }
    if (mode === 'criar' && !res.data.session) {
      setWaiting(email);
      return;
    }
    router.replace(back.startsWith('/') ? back : '/');
    router.refresh();
  };

  if (waiting) {
    return (
      <div className="mx-auto max-w-md py-10">
        <h1 className="titulo">Confirme seu e-mail.</h1>
        <p className="mt-5 text-lg">Enviamos um link para <strong>{waiting}</strong>. Abra e toque em Confirmar meu e-mail para ativar a conta.</p>
        <p className="mt-3 text-nevoa">Não chegou? Olhe o spam e a aba Promoções.</p>
        {error && <p className="mt-4 rounded-lg bg-lona px-3 py-2 text-sm" role="status">{error}</p>}
        <button onClick={() => resend(waiting)} className="mt-8 h-12 rounded-full border border-luar/40 px-6 font-semibold">Reenviar e-mail</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <img src="/brand/logo.png" alt="Paredão Play" className="mx-auto mb-10 h-32 w-auto" />
      {linkError && <p className="mb-6 rounded-lg bg-chita/15 px-4 py-3 text-sm">Esse link já foi usado ou venceu. Entre com sua senha ou peça um link novo.</p>}
      <h1 className="titulo">
        {mode === 'entrar' ? tx('login_title') : tx('signup_title')}
      </h1>
      <p className="mt-4 text-nevoa">
        {mode === 'entrar' ? tx('login_text') : tx('signup_text')}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === 'criar' && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Seu nome</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="field" autoComplete="name" />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">E-mail</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" autoComplete="email" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Senha</span>
          <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="field" autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} />
        </label>
        {error && <p className="rounded-lg bg-chita/15 px-3 py-2 text-sm text-luar" role="alert">{error}</p>}
        {error?.startsWith('Confirme seu e-mail') && (
          <button type="button" onClick={() => resend(email)} className="text-sm font-semibold text-sol">Reenviar e-mail de confirmação</button>
        )}
        <button disabled={busy} className="h-12 w-full rounded-full bg-sol font-semibold text-noite disabled:opacity-60">
          {busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
      {mode === 'entrar' && <Link href="/esqueci-senha" className="mt-6 block text-sm font-semibold text-nevoa hover:text-luar">Esqueci minha senha</Link>}
      <button onClick={() => { setMode(mode === 'entrar' ? 'criar' : 'entrar'); setError(null); }} className="mt-3 text-sm font-semibold text-nevoa hover:text-luar">
        {mode === 'entrar' ? 'Ainda não tem conta? Criar conta' : 'Já tem conta? Entrar'}
      </button>
    </div>
  );
}

export default function EntrarPage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
