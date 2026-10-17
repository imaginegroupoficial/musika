'use client';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/media';

type Item = { file: File; title: string; state: 'waiting' | 'uploading' | 'done' | 'error' };

const AUDIO = /\.(mp3|m4a|aac|wav|flac|ogg)$/i;

// "03 - Zé Vaqueiro - Lembrar de Mim (Ao Vivo).mp3" vira "Lembrar de Mim (Ao Vivo)"
function titleFromFile(name: string, artistName?: string) {
  let t = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  t = t.replace(/^\s*\d{1,3}\s*[-.)_ ]\s*/, '');
  if (artistName) t = t.replace(new RegExp(`^${artistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*`, 'i'), '');
  return t.trim() || name;
}

export default function NovoLancamento() {
  const { artistId } = useParams<{ artistId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'cd' | 'single' | 'ao_vivo'>('cd');
  const [publishAt, setPublishAt] = useState('');
  const [download, setDownload] = useState(true);
  const [cover, setCover] = useState<File | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverPreview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => AUDIO.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    setItems((prev) => [...prev, ...files.map((f) => ({ file: f, title: titleFromFile(f.name), state: 'waiting' as const }))]);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.length) return setError('Adicione pelo menos uma faixa.');
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // endereço único dentro do artista
    const base = slugify(title) || 'lancamento';
    const { data: existing } = await supabase.from('releases').select('slug').eq('artist_id', artistId).like('slug', `${base}%`);
    const taken = new Set((existing || []).map((r) => r.slug));
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

    const { data: rel, error: e1 } = await supabase
      .from('releases')
      .insert({
        artist_id: artistId,
        title: title.trim(),
        slug,
        kind,
        download_allowed: download,
        publish_at: publishAt ? new Date(publishAt).toISOString() : new Date().toISOString(),
      })
      .select('id')
      .single();
    if (e1 || !rel) {
      setBusy(false);
      return setError('Não foi possível criar o lançamento. Verifique se você é membro deste artista.');
    }

    if (cover) {
      const ext = cover.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${artistId}/${rel.id}/capa.${ext}`;
      const up = await supabase.storage.from('covers').upload(path, cover, { contentType: cover.type, upsert: true });
      if (!up.error) await supabase.from('releases').update({ cover_path: path }).eq('id', rel.id);
    }

    let failures = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      setItems((prev) => prev.map((p, k) => (k === i ? { ...p, state: 'uploading' } : p)));
      const ext = it.file.name.split('.').pop()?.toLowerCase() || 'mp3';
      const path = `${artistId}/${rel.id}/${String(i + 1).padStart(2, '0')}-${slugify(it.title) || 'faixa'}.${ext}`;
      const up = await supabase.storage.from('uploads').upload(path, it.file, { contentType: it.file.type || 'audio/mpeg', upsert: true });
      let ok = !up.error;
      if (ok) {
        const ins = await supabase.from('tracks').insert({ release_id: rel.id, artist_id: artistId, position: i + 1, title: it.title.trim() || `Faixa ${i + 1}`, upload_path: path });
        ok = !ins.error;
      }
      if (!ok) failures++;
      setItems((prev) => prev.map((p, k) => (k === i ? { ...p, state: ok ? 'done' : 'error' } : p)));
    }

    setBusy(false);
    if (failures) {
      setError(`${failures} faixa(s) não subiram. As outras já estão convertendo; você pode reenviar as que falharam num novo lançamento.`);
      return;
    }
    router.push(`/studio/${artistId}`);
    router.refresh();
  };

  return (
    <form onSubmit={publish} className="max-w-3xl">
      <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight">Novo lançamento</h1>
      <p className="mt-3 text-nevoa">Envie MP3, M4A, WAV ou FLAC. O Paredão Play converte cada faixa para tocar rápido até no 3G.</p>

      <div className="mt-8 grid gap-6 md:grid-cols-[200px_1fr]">
        <label className="block cursor-pointer">
          <span className="mb-1 block text-sm font-medium">Capa</span>
          {coverPreview ? (
            <img src={coverPreview} alt="Prévia da capa" className="aspect-square w-full rounded-capa object-cover" />
          ) : (
            <span className="grid aspect-square w-full place-items-center rounded-capa border-2 border-dashed border-palco text-center text-sm text-nevoa">Escolher imagem quadrada</span>
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setCover(e.target.files?.[0] || null)} />
        </label>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Título</span>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ao Vivo em Feira de Santana" className="field" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Tipo</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="field">
                <option value="cd">CD</option>
                <option value="ao_vivo">Ao vivo</option>
                <option value="single">Single</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Publicar em</span>
              <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="field" />
            </label>
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={download} onChange={(e) => setDownload(e.target.checked)} className="h-5 w-5 accent-sol" />
            <span>Permitir que os fãs baixem as faixas</span>
          </label>
          <p className="text-sm text-nevoa">Deixe a data em branco para publicar assim que a conversão terminar.</p>
        </div>
      </div>

      <section className="mt-10">
        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-capa border-2 border-dashed border-palco px-6 py-10 text-center hover:border-sol"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        >
          <span className="font-display text-2xl font-bold">Arraste as faixas aqui</span>
          <span className="mt-1 text-nevoa">ou toque para escolher no celular ou no computador</span>
          <input type="file" multiple accept="audio/*,.mp3,.m4a,.wav,.flac" className="sr-only" onChange={(e) => addFiles(e.target.files)} />
        </label>

        {items.length > 0 && (
          <ol className="mt-4 divide-y divide-lona">
            {items.map((it, i) => (
              <li key={`${it.file.name}-${i}`} className="flex items-center gap-3 py-2">
                <span className="w-6 text-right text-sm tabular-nums text-nevoa">{i + 1}</span>
                <input
                  value={it.title}
                  disabled={busy}
                  aria-label={`Título da faixa ${i + 1}`}
                  onChange={(e) => setItems(items.map((p, k) => (k === i ? { ...p, title: e.target.value } : p)))}
                  className="h-10 min-w-0 flex-1 rounded-lg bg-lona px-3 outline-none focus:ring-2 focus:ring-sol"
                />
                <span className="hidden w-16 text-right text-xs text-nevoa sm:block">{(it.file.size / 1048576).toFixed(1)} MB</span>
                <span className={`w-20 text-right text-xs font-semibold ${it.state === 'done' ? 'text-mandacaru' : it.state === 'error' ? 'text-chita' : it.state === 'uploading' ? 'text-sol' : 'text-nevoa'}`}>
                  {{ waiting: 'na fila', uploading: 'enviando', done: 'enviada', error: 'falhou' }[it.state]}
                </span>
                {!busy && (
                  <span className="flex">
                    <button type="button" onClick={() => move(i, -1)} aria-label="Subir faixa" className="ctl !h-8 !w-8">↑</button>
                    <button type="button" onClick={() => move(i, 1)} aria-label="Descer faixa" className="ctl !h-8 !w-8">↓</button>
                    <button type="button" onClick={() => setItems(items.filter((_, k) => k !== i))} aria-label="Remover faixa" className="ctl !h-8 !w-8">×</button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {error && <p className="mt-6 rounded-lg bg-chita/15 px-4 py-3 text-sm" role="alert">{error}</p>}

      <button disabled={busy || !title || !items.length} className="mt-8 h-12 rounded-full bg-sol px-8 font-semibold text-noite disabled:opacity-50">
        {busy ? `Enviando ${items.filter((i) => i.state === 'done').length + 1} de ${items.length}…` : `Publicar ${items.length || ''} ${items.length === 1 ? 'faixa' : 'faixas'}`}
      </button>
    </form>
  );
}
