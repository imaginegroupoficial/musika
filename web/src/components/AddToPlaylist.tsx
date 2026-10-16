'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';

type P = { id: string; title: string };

export default function AddToPlaylist({ trackId }: { trackId: string }) {
  const toast = usePlayer((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<P[] | null>(null);

  const load = async () => {
    setOpen(!open);
    if (lists) return;
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [own, member] = await Promise.all([
      supabase.from('playlists').select('id, title').eq('owner_id', u.user.id).order('updated_at', { ascending: false }),
      supabase.from('playlist_members').select('playlists(id, title)').eq('user_id', u.user.id),
    ]);
    const extra = ((member.data as unknown as { playlists: P }[]) || []).map((m) => m.playlists).filter(Boolean);
    setLists([...(own.data || []), ...extra]);
  };

  const add = async (p: P) => {
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('playlist_tracks').insert({ playlist_id: p.id, track_id: trackId, added_by: u.user?.id, position: Date.now() % 2147483647 });
    setOpen(false);
    toast(error ? (error.code === '23505' ? `Já está em ${p.title}` : 'Não foi possível adicionar') : `Adicionada a ${p.title}`);
    if (!error) await supabase.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', p.id);
  };

  return (
    <div className="relative">
      <button onClick={load} aria-label="Adicionar à playlist" aria-expanded={open} className="ctl text-lg font-bold">+</button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-palco bg-noite p-1.5 shadow-lg">
          {lists === null && <p className="px-3 py-2 text-sm text-nevoa">Carregando…</p>}
          {lists?.length === 0 && <a href="/playlists" className="block px-3 py-2 text-sm text-sol">Criar sua primeira playlist</a>}
          {lists?.map((p) => (
            <button key={p.id} onClick={() => add(p)} className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-lona">{p.title}</button>
          ))}
        </div>
      )}
    </div>
  );
}
