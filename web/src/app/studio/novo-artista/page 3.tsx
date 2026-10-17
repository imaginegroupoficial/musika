'use client';
import { SITE_HOST } from '@/lib/env';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/media';

import { GENRES as genres } from '@/lib/labels';

export default function NovoArtista() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [genre, setGenre] = useState('Forró');
  const [city, setCity] = useState('');
  const [uf, setUf] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const finalSlug = slugTouched ? slug : slugify(name);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_artist', { p_name: name.trim(), p_slug: finalSlug, p_genre: genre, p_city: city || null, p_uf: uf || null });
    setBusy(false);
    if (error) {
      setError(error.message.includes('duplicate') || error.message.includes('unique') ? 'Esse endereço já é de outro artista. Escolha outro.' : error.message.includes('reservado') ? 'Esse endereço é reservado. Escolha outro.' : 'Não foi possível criar. Confira o endereço: só letras minúsculas, números e hífen.');
      return;
    }
    router.push(`/studio/${data}`);
    router.refresh();
  };

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight">Seu perfil de artista</h1>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nome artístico</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Endereço da sua página</span>
          <div className="flex items-center rounded-xl border border-palco bg-lona pl-4 focus-within:border-sol">
            <span className="text-nevoa">{SITE_HOST}/</span>
            <input
              required
              pattern="[a-z0-9][a-z0-9\-]{1,40}"
              value={finalSlug}
              onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
              className="h-12 flex-1 bg-transparent pr-4 outline-none"
            />
          </div>
        </label>
        <div className="grid grid-cols-[1fr_1fr_88px] gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Estilo</span>
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className="field">
              {genres.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Cidade</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} className="field" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">UF</span>
            <input maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} className="field" />
          </label>
        </div>
        {error && <p className="rounded-lg bg-chita/15 px-3 py-2 text-sm" role="alert">{error}</p>}
        <button disabled={busy || !name} className="h-12 rounded-full bg-sol px-8 font-semibold text-noite disabled:opacity-60">
          {busy ? 'Criando…' : 'Criar perfil'}
        </button>
      </form>
    </div>
  );
}
