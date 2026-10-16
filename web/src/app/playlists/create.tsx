'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CreatePlaylist() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [collab, setCollab] = useState(false);
  const [priv, setPriv] = useState(false);
  const [busy, setBusy] = useState(false);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.from('playlists').insert({ owner_id: u.user?.id, title: title.trim(), collaborative: collab, is_public: !priv }).select('id').single();
    setBusy(false);
    if (data) router.push(`/playlist/${data.id}`);
  };
  return (
    <form onSubmit={create} className="rounded-capa bg-lona p-5">
      <div className="flex gap-3">
        <input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Nome da nova playlist" className="field" aria-label="Nome da playlist" />
        <button disabled={busy} className="h-12 shrink-0 rounded-full bg-sol px-6 font-semibold text-noite">Criar</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={collab} onChange={(e) => setCollab(e.target.checked)} className="h-4 w-4 accent-[#FFC531]" /> Colaborativa: amigos com o link adicionam faixas</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} className="h-4 w-4 accent-[#FFC531]" /> Privada</label>
      </div>
    </form>
  );
}
