'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';
import { UFS } from '@/lib/labels';

// Aviso geral: vai para o sino de todo mundo (ou de um estado), no celular de quem ativou e por e-mail para quem pediu
export default function BroadcastForm() {
  const toast = usePlayer((s) => s.toast);
  const [f, setF] = useState({ title: '', body: '', link: '', uf: '' });
  const [busy, setBusy] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(f.uf ? `Enviar para todos os usuários de ${f.uf}?` : 'Enviar para todos os usuários?')) return;
    setBusy(true);
    const { data, error } = await createClient().rpc('admin_broadcast', { p_title: f.title, p_body: f.body, p_link: f.link, p_uf: f.uf || null });
    setBusy(false);
    if (error) return toast(error.message.includes('link') || error.message.includes('check') ? 'O link precisa começar com https:// ou /' : 'Não foi possível enviar');
    toast(`Aviso enviado para ${data} pessoas`);
    setF({ title: '', body: '', link: '', uf: '' });
  };
  return (
    <form onSubmit={send} className="grid max-w-2xl gap-3 rounded-capa border border-palco bg-lona p-5">
      <label className="block"><span className="mb-1 block text-sm font-medium">Título</span><input required maxLength={90} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="field" placeholder="Ex.: O São João do Musika começou" /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Texto (opcional)</span><textarea rows={3} maxLength={240} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="field" /></label>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <label className="block"><span className="mb-1 block text-sm font-medium">Link (opcional)</span><input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} className="field" placeholder="/top ou https://..." /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium">Só para o estado</span>
          <select value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value })} className="field"><option value="">Todos</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
        </label>
      </div>
      <div><button disabled={busy} className="h-11 rounded-full bg-sol px-6 font-semibold text-noite disabled:opacity-60">{busy ? 'Enviando…' : 'Enviar aviso'}</button></div>
    </form>
  );
}
