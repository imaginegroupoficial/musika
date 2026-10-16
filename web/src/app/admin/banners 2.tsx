'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';

export type BannerRow = { id: string; title: string; subtitle: string | null; cta: string | null; image_url: string | null; link_url: string | null; placement: string; position: number; active: boolean; ends_at: string | null };

export function BannerForm() {
  const router = useRouter();
  const toast = usePlayer((s) => s.toast);
  const empty = { title: '', subtitle: '', cta: '', link_url: '', placement: 'carrossel', position: 0, ends_at: '' };
  const [f, setF] = useState(empty);
  const [img, setImg] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    let image_path: string | null = null;
    if (img) {
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user!.id}/casa/${Date.now()}.${img.name.split('.').pop()?.toLowerCase() || 'jpg'}`;
      const up = await supabase.storage.from('ads').upload(path, img, { contentType: img.type });
      if (up.error) { setBusy(false); return toast('A imagem não subiu. Use JPG, PNG ou WebP até 10 MB.'); }
      image_path = path;
    }
    const { error } = await supabase.from('house_banners').insert({
      title: f.title.trim(), subtitle: f.subtitle.trim() || null, cta: f.cta.trim() || null, link_url: f.link_url.trim() || null,
      placement: f.placement, position: f.position, image_path, ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    });
    setBusy(false);
    if (error) return toast('Não foi possível salvar. O link precisa começar com https:// ou /');
    toast('Banner publicado');
    setF(empty);
    setImg(null);
    router.refresh();
  };

  return (
    <form onSubmit={save} className="grid gap-3 rounded-capa border border-palco bg-lona p-5 sm:grid-cols-2">
      <label className="block"><span className="mb-1 block text-sm font-medium">Título</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="field" placeholder="Ex.: São João no Musika" /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Onde aparece</span>
        <select value={f.placement} onChange={(e) => setF({ ...f, placement: e.target.value })} className="field">
          <option value="carrossel">Carrossel no topo da página inicial (1600 x 500)</option>
          <option value="faixa">Faixa no lugar de anúncio, quando não houver (1200 x 300)</option>
        </select>
      </label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Texto de apoio (opcional)</span><input value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} className="field" /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Texto do botão (opcional)</span><input value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} className="field" placeholder="Ex.: Ouvir agora" /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Link</span><input value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} className="field" placeholder="/netto-brito ou https://..." /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-sm font-medium">Ordem</span><input type="number" value={f.position} onChange={(e) => setF({ ...f, position: Number(e.target.value) })} className="field" /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium">Sai do ar em</span><input type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} className="field" /></label>
      </div>
      <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-medium">Imagem (opcional: sem imagem, o banner é feito com as cores do tema)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setImg(e.target.files?.[0] || null)} className="block text-sm text-nevoa file:mr-3 file:rounded-full file:border-0 file:bg-palco file:px-4 file:py-2 file:font-semibold file:text-luar" />
      </label>
      <div><button disabled={busy} className="h-11 rounded-full bg-sol px-6 font-semibold text-noite disabled:opacity-60">{busy ? 'Publicando…' : 'Publicar banner'}</button></div>
    </form>
  );
}

export function BannerActions({ id, active, placement, expired }: { id: string; active: boolean; placement: string; expired?: boolean }) {
  const router = useRouter();
  const run = async (fn: () => PromiseLike<unknown>) => { await fn(); router.refresh(); };
  const sb = () => createClient().from('house_banners');
  return (
    <span className="flex gap-1">
      <button onClick={() => run(() => sb().update({ active: !active || !!expired, ...(expired ? { ends_at: null } : {}) }).eq('id', id))} className="h-9 rounded-full border border-palco px-4 text-sm font-semibold">{expired ? 'Recolocar no ar' : active ? 'Tirar do ar' : 'Colocar no ar'}</button>
      <button onClick={() => run(() => sb().update({ placement: placement === 'carrossel' ? 'faixa' : 'carrossel' }).eq('id', id))} className="h-9 rounded-full border border-palco px-4 text-sm font-semibold">{placement === 'carrossel' ? 'Virar faixa' : 'Virar carrossel'}</button>
      <button onClick={() => window.confirm('Excluir este banner?') && run(() => sb().delete().eq('id', id))} className="h-9 rounded-full px-3 text-sm font-semibold text-nevoa hover:text-chita">Excluir</button>
    </span>
  );
}
