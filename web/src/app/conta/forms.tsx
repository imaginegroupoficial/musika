'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';
import { UFS } from '@/lib/labels';

type P = { username: string; display_name: string; city: string; uf: string };

export default function AccountForms({ email, pendingEmail, profile, premiumUntil }: { email: string; pendingEmail: string | null; profile: P; premiumUntil: string | null }) {
  const router = useRouter();
  const toast = usePlayer((s) => s.toast);
  const [p, setP] = useState(profile);
  const [newEmail, setNewEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('perfil');
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({ username: p.username.toLowerCase(), display_name: p.display_name, city: p.city || null, uf: p.uf || null }).eq('id', u.user!.id);
    setBusy(null);
    if (error) return toast(error.code === '23505' ? 'Esse nome de usuário já existe' : 'Nome de usuário: só letras minúsculas, números, ponto e _ (3 a 30)');
    toast('Perfil salvo');
    router.refresh();
  };

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('email');
    const { error } = await createClient().auth.updateUser({ email: newEmail.trim() }, { emailRedirectTo: `${window.location.origin}/conta` });
    setBusy(null);
    if (error) return toast(/registered|exists/i.test(error.message) ? 'Esse e-mail já tem conta' : 'Não foi possível trocar o e-mail');
    toast('Enviamos a confirmação para o e-mail novo');
    setNewEmail('');
    router.refresh();
  };

  const changePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres');
    setBusy('senha');
    const { error } = await createClient().auth.updateUser({ password: pass });
    setBusy(null);
    if (error) return toast(/different|same/i.test(error.message) ? 'A senha nova precisa ser diferente da atual' : 'Não foi possível trocar a senha');
    toast('Senha trocada');
    setPass('');
  };

  const box = 'mt-8 space-y-4 rounded-capa bg-lona p-6';
  const btn = (k: string, t: string) => <button disabled={busy === k} className="h-11 rounded-full bg-sol px-6 font-semibold text-noite disabled:opacity-60">{busy === k ? 'Salvando…' : t}</button>;
  const premium = premiumUntil && new Date(premiumUntil) > new Date();

  return (
    <>
      <form onSubmit={saveProfile} className={box}>
        <h2 className="font-display text-xl font-bold">Perfil</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-sm font-medium">Nome</span><input value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} className="field" /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Nome de usuário</span><input value={p.username} onChange={(e) => setP({ ...p, username: e.target.value.toLowerCase() })} pattern="[a-z0-9_.]{3,30}" className="field" /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Cidade</span><input value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} className="field" /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Estado</span>
            <select value={p.uf} onChange={(e) => setP({ ...p, uf: e.target.value })} className="field"><option value="">Escolha</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </label>
        </div>
        <p className="text-sm text-nevoa">Cidade e estado ajudam a mostrar o que está tocando perto de você.</p>
        {btn('perfil', 'Salvar perfil')}
      </form>

      <form onSubmit={changeEmail} className={box}>
        <h2 className="font-display text-xl font-bold">E-mail</h2>
        <p>Atual: <strong>{email}</strong></p>
        {pendingEmail && <p className="text-sm text-sol">Aguardando confirmação de {pendingEmail}. Abra o link que enviamos para ele.</p>}
        <label className="block"><span className="mb-1 block text-sm font-medium">E-mail novo</span><input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="field" /></label>
        {btn('email', 'Trocar e-mail')}
      </form>

      <form onSubmit={changePass} className={box}>
        <h2 className="font-display text-xl font-bold">Senha</h2>
        <label className="block"><span className="mb-1 block text-sm font-medium">Senha nova</span><input type="password" minLength={6} required value={pass} onChange={(e) => setPass(e.target.value)} className="field" autoComplete="new-password" /></label>
        {btn('senha', 'Trocar senha')}
      </form>

      <div className={box}>
        <h2 className="font-display text-xl font-bold">Assinatura</h2>
        <p>{premium ? `Premium até ${new Date(premiumUntil!).toLocaleDateString('pt-BR')}.` : 'Você está no plano grátis, com anúncios.'}</p>
        <Link href="/premium" className="inline-flex h-11 items-center rounded-full border border-luar/40 px-5 font-semibold">{premium ? 'Renovar Premium' : 'Conhecer o Premium'}</Link>
      </div>

      <form action="/sair" method="post" className="mt-8">
        <button className="text-sm font-semibold text-nevoa hover:text-luar">Sair da conta</button>
      </form>
    </>
  );
}
