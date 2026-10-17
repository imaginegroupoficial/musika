'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NovaSenha() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setReady(!!data.user));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
    if (pass !== pass2) return setError('As duas senhas não são iguais.');
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password: pass });
    setBusy(false);
    if (error) return setError(/different|same/i.test(error.message) ? 'A senha nova precisa ser diferente da atual.' : 'Não foi possível salvar. Peça um link novo.');
    router.replace('/?senha=ok');
    router.refresh();
  };

  if (ready === null) return null;
  if (!ready) {
    return (
      <div className="mx-auto max-w-md py-10">
        <h1 className="titulo">Link vencido</h1>
        <p className="mt-4 text-nevoa">O link para trocar a senha vale por 1 hora e só funciona uma vez. Peça outro.</p>
        <Link href="/esqueci-senha" className="mt-8 inline-flex h-12 items-center rounded-full bg-sol px-6 font-semibold text-noite">Pedir link novo</Link>
      </div>
    );
  }
  return (
    <form onSubmit={save} className="mx-auto max-w-md space-y-4 py-10">
      <h1 className="titulo">Crie sua senha nova</h1>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Senha nova</span>
        <input type="password" required minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} className="field" autoComplete="new-password" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Repita a senha</span>
        <input type="password" required minLength={6} value={pass2} onChange={(e) => setPass2(e.target.value)} className="field" autoComplete="new-password" />
      </label>
      {error && <p className="rounded-lg bg-chita/15 px-3 py-2 text-sm" role="alert">{error}</p>}
      <button disabled={busy} className="h-12 w-full rounded-full bg-sol font-semibold text-noite disabled:opacity-60">{busy ? 'Salvando…' : 'Salvar senha'}</button>
    </form>
  );
}
