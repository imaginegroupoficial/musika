'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Artist = { id: string; name: string; bio: string | null; booking_whatsapp: string | null; instagram: string | null; city: string | null; uf: string | null };

export default function ArtistSettings({ artist }: { artist: Artist }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: artist.name,
    bio: artist.bio || '',
    booking_whatsapp: artist.booking_whatsapp || '',
    instagram: artist.instagram || '',
    city: artist.city || '',
    uf: artist.uf || '',
  });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const patch: Record<string, string | null> = { ...form, uf: form.uf.toUpperCase() || null };
    if (avatar) {
      const ext = avatar.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${artist.id}/avatar-${Date.now()}.${ext}`;
      const up = await supabase.storage.from('covers').upload(path, avatar, { contentType: avatar.type, upsert: true });
      if (up.error) {
        setBusy(false);
        setMsg('A foto não subiu. Use JPG, PNG ou WebP de até 10 MB.');
        return;
      }
      patch.avatar_path = path;
    }
    const { error } = await supabase.from('artists').update(patch).eq('id', artist.id);
    setBusy(false);
    setMsg(error ? 'Não foi possível salvar.' : 'Perfil salvo.');
    if (!error) router.refresh();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Nome artístico</span>
        <input value={form.name} onChange={set('name')} className="field" required />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Foto do perfil</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setAvatar(e.target.files?.[0] || null)} className="block w-full text-sm text-nevoa file:mr-3 file:rounded-full file:border-0 file:bg-palco file:px-4 file:py-2 file:font-semibold file:text-luar" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Sobre</span>
        <textarea rows={4} value={form.bio} onChange={set('bio')} className="field" maxLength={600} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">WhatsApp de shows</span>
          <input value={form.booking_whatsapp} onChange={set('booking_whatsapp')} placeholder="75 99999-9999" className="field" inputMode="tel" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Instagram</span>
          <input value={form.instagram} onChange={set('instagram')} placeholder="@seuperfil" className="field" />
        </label>
      </div>
      <div className="grid grid-cols-[1fr_88px] gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Cidade</span>
          <input value={form.city} onChange={set('city')} className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">UF</span>
          <input value={form.uf} onChange={set('uf')} maxLength={2} className="field" />
        </label>
      </div>
      <div className="flex items-center gap-4">
        <button disabled={busy} className="h-11 rounded-full bg-sol px-6 font-semibold text-noite disabled:opacity-60">{busy ? 'Salvando…' : 'Salvar perfil'}</button>
        {msg && <span className="text-sm text-nevoa" role="status">{msg}</span>}
      </div>
    </form>
  );
}
