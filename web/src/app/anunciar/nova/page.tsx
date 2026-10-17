'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/media';
import { GENRES, UFS } from '@/lib/labels';

function audioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => { resolve(a.duration); URL.revokeObjectURL(a.src); };
    a.onerror = () => resolve(0);
    a.src = URL.createObjectURL(file);
  });
}

export default function NovaCampanha() {
  const router = useRouter();
  const [kind, setKind] = useState<'audio' | 'banner'>('audio');
  const [name, setName] = useState('');
  const [advertiser, setAdvertiser] = useState('');
  const [headline, setHeadline] = useState('');
  const [url, setUrl] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);
  const [budget, setBudget] = useState(100);
  const [endsAt, setEndsAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [cfg, setCfg] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    createClient().from('settings').select('key, value').in('key', ['cpm_audio_cents', 'cpm_banner_cents', 'min_campaign_cents'])
      .then(({ data }) => setCfg(Object.fromEntries((data || []).map((r) => [r.key, Number(r.value)]))));
  }, []);

  const cpm = kind === 'audio' ? cfg.cpm_audio_cents || 2500 : cfg.cpm_banner_cents || 800;
  const min = (cfg.min_campaign_cents || 5000) / 100;
  const estimated = Math.floor((budget * 100 * 1000) / cpm);

  const pick = async (f: File | null) => {
    setError(null);
    setFile(f);
    setDuration(null);
    if (f && kind === 'audio') {
      const d = await audioDuration(f);
      setDuration(Math.round(d));
      if (d > 31) setError('O áudio precisa ter até 30 segundos.');
    }
  };

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError(kind === 'audio' ? 'Envie o áudio do anúncio.' : 'Envie a imagem do banner.');
    if (kind === 'audio' && (duration || 0) > 31) return setError('O áudio precisa ter até 30 segundos.');
    if (budget < min) return setError(`O investimento mínimo é ${brl(min * 100)}.`);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.push('/entrar?voltar=/anunciar/nova');

    const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'audio' ? 'mp3' : 'jpg');
    const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from('ads').upload(path, file, { contentType: file.type });
    if (up.error) {
      setBusy(false);
      return setError(kind === 'audio' ? 'O áudio não subiu. Use MP3 ou M4A de até 10 MB.' : 'A imagem não subiu. Use JPG, PNG ou WebP de até 10 MB.');
    }
    const { data: c, error: e1 } = await supabase.from('ad_campaigns').insert({
      owner_id: u.user.id,
      name: name.trim(),
      advertiser: advertiser.trim(),
      kind,
      media_path: path,
      duration_sec: kind === 'audio' ? duration : null,
      headline: headline.trim() || null,
      click_url: url.trim() || null,
      target_genres: genres,
      target_ufs: ufs,
      cpm_cents: cpm,
      budget_cents: Math.round(budget * 100),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    }).select('id').single();
    if (e1 || !c) {
      setBusy(false);
      return setError('Não foi possível criar a campanha. Confira o link (precisa começar com https://).');
    }
    const { error: e2 } = await supabase.rpc('submit_campaign', { p_campaign: c.id });
    if (e2) {
      setBusy(false);
      return setError(e2.message);
    }
    router.push(`/anunciar/${c.id}`);
  };

  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm font-medium ${on ? 'bg-sol text-noite' : 'bg-lona text-nevoa hover:text-luar'}`;

  return (
    <form onSubmit={submit} className="max-w-3xl">
      <h1 className="titulo">Nova campanha</h1>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:max-w-md">
        {(['audio', 'banner'] as const).map((k) => (
          <button type="button" key={k} onClick={() => { setKind(k); setFile(null); setDuration(null); }} className={`rounded-capa border p-4 text-left ${kind === k ? 'border-sol bg-sol/10' : 'border-palco'}`}>
            <span className="block font-display text-xl font-bold">{k === 'audio' ? 'Áudio' : 'Banner'}</span>
            <span className="text-sm text-nevoa">{k === 'audio' ? 'Toca entre as faixas, até 30 s' : 'Imagem nas páginas, 1200 x 300'}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nome da campanha</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Promoção de verão" className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nome do anunciante</span>
          <input required value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} placeholder="Como aparece para o ouvinte" className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Frase do anúncio</span>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} placeholder="Ex.: Paredão em 10x sem juros" className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Link do botão Saiba mais</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className="field" />
        </label>
      </div>

      <label className="mt-6 block cursor-pointer rounded-capa border-2 border-dashed border-palco p-6 text-center hover:border-sol">
        <span className="block font-semibold">{file ? file.name : kind === 'audio' ? 'Escolher o áudio (MP3, até 30 s)' : 'Escolher o banner (1200 x 300)'}</span>
        {duration != null && <span className="mt-1 block text-sm text-nevoa">{duration} segundos</span>}
        <input type="file" className="sr-only" accept={kind === 'audio' ? 'audio/mpeg,audio/mp4,audio/aac,.mp3,.m4a' : 'image/jpeg,image/png,image/webp,image/gif'} onChange={(e) => pick(e.target.files?.[0] || null)} />
      </label>
      {preview && kind === 'audio' && <audio controls src={preview} className="mt-3 w-full" />}
      {preview && kind === 'banner' && <img src={preview} alt="Prévia do banner" className="mt-3 aspect-[4/1] w-full rounded-capa object-cover" />}

      <fieldset className="mt-8">
        <legend className="mb-2 font-semibold">Estilos musicais <span className="font-normal text-nevoa">(nenhum = todos)</span></legend>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => <button type="button" key={g} onClick={() => toggle(genres, setGenres, g)} className={chip(genres.includes(g))}>{g}</button>)}
        </div>
      </fieldset>
      <fieldset className="mt-6">
        <legend className="mb-2 font-semibold">Estados <span className="font-normal text-nevoa">(nenhum = Brasil todo; vale para quem informou o estado no perfil)</span></legend>
        <div className="flex flex-wrap gap-1.5">
          {UFS.map((u) => <button type="button" key={u} onClick={() => toggle(ufs, setUfs, u)} className={chip(ufs.includes(u))}>{u}</button>)}
        </div>
      </fieldset>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Investimento (R$)</span>
          <input type="number" min={min} step={10} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Terminar em <span className="text-nevoa">(opcional)</span></span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="field" />
        </label>
      </div>
      <p className="mt-3 text-nevoa">
        Cerca de <strong className="text-luar">{estimated.toLocaleString('pt-BR')}</strong> {kind === 'audio' ? 'execuções do áudio' : 'exibições do banner'} a {brl(cpm)} por mil.
        Depois do Pix, a equipe do Paredão Play revisa o anúncio antes de ir ao ar.
      </p>

      {error && <p className="mt-6 rounded-lg bg-chita/15 px-4 py-3 text-sm" role="alert">{error}</p>}
      <button disabled={busy} className="mt-8 h-12 rounded-full bg-sol px-8 font-semibold text-noite disabled:opacity-60">{busy ? 'Enviando…' : 'Continuar para o pagamento'}</button>
    </form>
  );
}
