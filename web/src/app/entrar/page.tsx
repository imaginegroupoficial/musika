'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function Form() {
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const back = useSearchParams().get('voltar') || '/';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const res =
      mode === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
    setBusy(false);
    if (res.error) {
      const msg = res.error.message.toLowerCase();
      setError(
        msg.includes('invalid login') ? 'E-mail ou senha não conferem.'
        : msg.includes('already registered') ? 'Esse e-mail já tem conta. Entre com a senha.'
        : msg.includes('password') ? 'A senha precisa ter pelo menos 6 caracteres.'
        : res.error.message,
      );
      return;
    }
    if (mode === 'criar' && !res.data.session) {
      setError('Conta criada. Confirme pelo link enviado no seu e-mail e depois entre.');
      setMode('entrar');
      return;
    }
    router.replace(back.startsWith('/') ? back : '/');
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight">
        {mode === 'entrar' ? 'Bem-vindo de volta.' : 'Crie sua conta e comece a pontuar.'}
      </h1>
      <p className="mt-4 text-nevoa">
        {mode === 'entrar' ? 'Seus pontos, curtidas e artistas seguidos estão te esperando.' : 'Cada faixa ouvida até o fim vale ponto no ranking do seu artista.'}
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
        <button disabled={busy} className="h-12 w-full rounded-full bg-sol font-semibold text-noite disabled:opacity-60">
          {busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
      <button onClick={() => { setMode(mode === 'entrar' ? 'criar' : 'entrar'); setError(null); }} className="mt-6 text-sm font-semibold text-nevoa hover:text-luar">
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
