'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';
import { UFS } from '@/lib/labels';
import { avatarUrl } from '@/lib/media';
import type { Prefs } from '@/lib/prefs';
import PushToggle from '@/components/PushToggle';

type P = { username: string; display_name: string; city: string; uf: string; bio: string; avatar_url: string | null };

// reduz a foto no próprio aparelho (quadrada, 512 px, WebP) antes de enviar
async function squareWebp(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  c.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 512, 512);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('foto'))), 'image/webp', 0.86));
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-nevoa">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-sol' : 'bg-palco'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
      </button>
    </label>
  );
}

export default function AccountForms({ email, pendingEmail, profile, premiumUntil, prefs: initialPrefs, vapidKey }: { email: string; pendingEmail: string | null; profile: P; premiumUntil: string | null; prefs: Required<Prefs>; vapidKey: string | null }) {
  const router = useRouter();
  const toast = usePlayer((s) => s.toast);
  const [p, setP] = useState(profile);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [newEmail, setNewEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const uid = async () => (await createClient().auth.getUser()).data.user!.id;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('perfil');
    const { error } = await createClient().from('profiles').update({ username: p.username.toLowerCase(), display_name: p.display_name.trim() || null, city: p.city.trim() || null, uf: p.uf || null, bio: p.bio.trim() || null }).eq('id', await uid());
    setBusy(null);
    if (error) return toast(error.code === '23505' ? 'Esse nome de usuário já existe' : error.message.includes('bio') ? 'A bio pode ter até 300 caracteres' : 'Nome de usuário: só letras minúsculas, números, ponto e _ (3 a 30)');
    toast('Perfil salvo');
    router.refresh();
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Use uma foto JPG, PNG ou WebP');
    setBusy('foto');
    try {
      const supabase = createClient();
      const id = await uid();
      const blob = await squareWebp(file);
      const path = `${id}/foto-${Date.now()}.webp`;
      const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/webp' });
      if (up.error) throw up.error;
      const old = p.avatar_url;
      const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', id);
      if (error) throw error;
      if (old && !old.startsWith('http')) await supabase.storage.from('avatars').remove([old]);
      setP({ ...p, avatar_url: path });
      toast('Foto atualizada');
      router.refresh();
    } catch {
      toast('A foto não subiu. Tente outra imagem.');
    } finally {
      setBusy(null);
    }
  };

  const removeAvatar = async () => {
    const supabase = createClient();
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', await uid());
    if (p.avatar_url && !p.avatar_url.startsWith('http')) await supabase.storage.from('avatars').remove([p.avatar_url]);
    setP({ ...p, avatar_url: null });
    router.refresh();
  };

  // preferências salvam na hora em que mudam
  const setPref = async <K extends keyof Prefs>(k: K, v: Required<Prefs>[K]) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    const { error } = await createClient().from('profiles').update({ prefs: next }).eq('id', await uid());
    if (error) { setPrefs(prefs); return toast('Não foi possível salvar'); }
    if (k === 'audio') {
      try { localStorage.setItem('mk_audio', String(v)); } catch {}
      window.dispatchEvent(new Event('mk:audio'));
    }
    toast('Salvo');
  };

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('email');
    const { error } = await createClient().auth.updateUser({ email: newEmail.trim() }, { emailRedirectTo: `${window.location.origin}/conta` });
    setBusy(null);
    if (error) return toast(/registered|exists/i.test(error.message) ? 'Esse e-mail já tem conta' : /sending/i.test(error.message) ? 'Não conseguimos enviar o e-mail de confirmação agora' : 'Não foi possível trocar o e-mail');
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

  const deleteAccount = async () => {
    setBusy('excluir');
    const r = await fetch('/api/conta/excluir', { method: 'POST' });
    if (!r.ok) { setBusy(null); return toast('Não foi possível excluir agora. Tente de novo.'); }
    await createClient().auth.signOut();
    window.location.href = '/?conta=excluida';
  };

  const box = 'mt-8 scroll-mt-20 space-y-4 rounded-capa bg-lona p-6';
  const btn = (k: string, t: string) => <button disabled={busy === k} className="h-11 rounded-full bg-sol px-6 font-semibold text-noite disabled:opacity-60">{busy === k ? 'Salvando…' : t}</button>;
  const premium = premiumUntil && new Date(premiumUntil) > new Date();
  const foto = avatarUrl(p.avatar_url);

  return (
    <>
      <form id="perfil" onSubmit={saveProfile} className={box}>
        <h2 className="font-display text-xl font-bold">Perfil</h2>
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => fileRef.current?.click()} className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full" aria-label="Trocar foto">
            {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-sol font-display text-4xl font-black uppercase text-noite">{(p.display_name || p.username).slice(0, 1)}</span>}
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">{busy === 'foto' ? 'Enviando…' : 'Trocar'}</span>
          </button>
          <div className="space-y-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === 'foto'} className="h-10 rounded-full border border-luar/40 px-4 text-sm font-semibold">{busy === 'foto' ? 'Enviando…' : foto ? 'Trocar foto' : 'Colocar foto'}</button>
            {foto && <button type="button" onClick={removeAvatar} className="ml-2 text-sm font-semibold text-nevoa hover:text-luar">Remover</button>}
            <p className="text-xs text-nevoa">JPG, PNG ou WebP. A foto é cortada em quadrado.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-sm font-medium">Nome</span><input value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} className="field" maxLength={60} /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Nome de usuário</span><input value={p.username} onChange={(e) => setP({ ...p, username: e.target.value.toLowerCase() })} pattern="[a-z0-9_.]{3,30}" className="field" /></label>
          <label className="block sm:col-span-2"><span className="mb-1 flex justify-between text-sm font-medium"><span>Bio</span><span className="text-nevoa">{p.bio.length}/300</span></span>
            <textarea value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value.slice(0, 300) })} rows={3} className="field" placeholder="Conte o que você curte ouvir" />
          </label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Cidade</span><input value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} className="field" /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Estado</span>
            <select value={p.uf} onChange={(e) => setP({ ...p, uf: e.target.value })} className="field"><option value="">Escolha</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </label>
        </div>
        <p className="text-sm text-nevoa">Cidade e estado ajudam a mostrar o que está tocando perto de você e a lembrar dos shows na sua região.</p>
        <div className="flex flex-wrap items-center gap-4">
          {btn('perfil', 'Salvar perfil')}
          <Link href={`/perfil/${profile.username}`} className="text-sm font-semibold text-nevoa hover:text-luar">Ver meu perfil público</Link>
        </div>
      </form>

      <section id="notificacoes" className={box}>
        <h2 className="font-display text-xl font-bold">Notificações</h2>
        <PushToggle vapidKey={vapidKey} />
        <div className="divide-y divide-palco border-t border-palco">
          <Toggle on={prefs.n_lancamentos} onChange={(v) => setPref('n_lancamentos', v)} label="Lançamentos" hint="Quando um artista que você segue lançar CD ou single" />
          <Toggle on={prefs.n_shows} onChange={(v) => setPref('n_shows', v)} label="Shows" hint="Show novo marcado e lembrete na véspera, se for no seu estado" />
          <Toggle on={prefs.n_posts} onChange={(v) => setPref('n_posts', v)} label="Mural dos artistas" hint="Posts dos artistas que você segue e do fã-clube" />
          <Toggle on={prefs.n_avisos} onChange={(v) => setPref('n_avisos', v)} label="Novidades do Musika" hint="Avisos importantes e promoções da plataforma" />
          <Toggle on={prefs.push} onChange={(v) => setPref('push', v)} label="Avisos no celular e no computador" hint="Desligue para receber só aqui no site" />
          <Toggle on={prefs.email} onChange={(v) => setPref('email', v)} label="Também por e-mail" hint="Lançamentos, shows e novidades chegam no seu e-mail" />
        </div>
      </section>

      <section id="reproducao" className={box}>
        <h2 className="font-display text-xl font-bold">Reprodução</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {([['auto', 'Automática', 'Ajusta à sua internet'], ['economia', 'Economia de dados', 'Sempre 64 kbps, gasta metade'], ['alta', 'Alta', 'Sempre 128 kbps']] as const).map(([v, l, h]) => (
            <button key={v} type="button" onClick={() => setPref('audio', v)} className={`rounded-xl border-2 p-4 text-left ${prefs.audio === v ? 'border-sol bg-sol/10' : 'border-palco hover:border-luar/40'}`}>
              <span className="block font-semibold">{l}</span>
              <span className="block text-sm text-nevoa">{h}</span>
            </button>
          ))}
        </div>
      </section>

      <section id="acesso" className="scroll-mt-20">
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
      </section>

      <div id="assinatura" className={box}>
        <h2 className="font-display text-xl font-bold">Assinatura</h2>
        <p>{premium ? `Premium até ${new Date(premiumUntil!).toLocaleDateString('pt-BR')}.` : 'Você está no plano grátis, com anúncios.'}</p>
        <Link href="/premium" className="inline-flex h-11 items-center rounded-full border border-luar/40 px-5 font-semibold">{premium ? 'Renovar Premium' : 'Conhecer o Premium'}</Link>
      </div>

      <form action="/sair" method="post" className="mt-8">
        <button className="h-11 rounded-full border border-luar/40 px-5 font-semibold">Sair da conta</button>
      </form>

      <div id="excluir" className="mt-12 scroll-mt-20 space-y-3 rounded-capa border-2 border-chita/40 p-6">
        <h2 className="font-display text-xl font-bold">Excluir conta</h2>
        <p className="text-sm text-nevoa">Apaga seu perfil, pontos, playlists, curtidas e comentários. Não dá para desfazer. Perfis de artista que você criou continuam no ar para o resto da equipe.</p>
        <label className="block max-w-xs"><span className="mb-1 block text-sm font-medium">Digite EXCLUIR para confirmar</span><input value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} className="field" /></label>
        <button type="button" onClick={deleteAccount} disabled={confirmDel !== 'EXCLUIR' || busy === 'excluir'} className="h-11 rounded-full bg-chita px-5 font-semibold text-white disabled:opacity-40">{busy === 'excluir' ? 'Excluindo…' : 'Excluir minha conta'}</button>
      </div>
    </>
  );
}
