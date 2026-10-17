'use client';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';
import { UFS } from '@/lib/labels';
import { coverUrl, adMediaUrl } from '@/lib/media';

export type ReleaseOption = { id: string; title: string; kind: string; artist: string; artist_slug: string; slug: string; cover_path: string | null };

const kindName: Record<string, string> = { cd: 'CD', single: 'Single', ao_vivo: 'Ao vivo' };

// Aviso geral: sino de todo mundo (ou de um estado), celular de quem ativou e e-mail de quem pediu.
// Pode levar um lançamento: a capa vira a imagem e o toque abre o CD.
export default function BroadcastForm({ releases, brandName }: { releases: ReleaseOption[]; brandName: string }) {
  const toast = usePlayer((s) => s.toast);
  const [f, setF] = useState({ title: '', body: '', link: '', uf: '' });
  const [rel, setRel] = useState<ReleaseOption | null>(null);
  const [find, setFind] = useState('');
  const [img, setImg] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const q = find.trim().toLowerCase();
    const list = q ? releases.filter((r) => `${r.title} ${r.artist}`.toLowerCase().includes(q)) : releases;
    return list.slice(0, 8);
  }, [find, releases]);

  const pick = (r: ReleaseOption) => {
    setRel(r);
    setFind('');
    // sugere o texto quando ainda está em branco
    setF((x) => ({ ...x, title: x.title || `${r.artist} lançou ${kindName[r.kind] === 'Single' ? 'o single' : 'o CD'} ${r.title}`, body: x.body || 'Já está no ar. Ouça agora e ganhe pontos nas primeiras 48 horas.' }));
  };

  const preview = img ? URL.createObjectURL(img) : rel ? coverUrl(rel.cover_path) : null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(f.uf ? `Enviar para todos os usuários de ${f.uf}?` : 'Enviar para todos os usuários?')) return;
    setBusy(true);
    const supabase = createClient();
    let image: string | null = null;
    if (img) {
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user!.id}/avisos/${Date.now()}.${img.name.split('.').pop()?.toLowerCase() || 'jpg'}`;
      const up = await supabase.storage.from('ads').upload(path, img, { contentType: img.type });
      if (up.error) { setBusy(false); return toast('A imagem não subiu. Use JPG, PNG ou WebP até 10 MB.'); }
      image = adMediaUrl(path);
    }
    const { data, error } = await supabase.rpc('admin_broadcast', { p_title: f.title, p_body: f.body, p_link: f.link, p_uf: f.uf || null, p_release: rel?.id || null, p_image: image });
    setBusy(false);
    if (error) return toast(/link|check/i.test(error.message) ? 'O link precisa começar com https:// ou /' : 'Não foi possível enviar');
    toast(`Aviso enviado para ${data} pessoas`);
    setF({ title: '', body: '', link: '', uf: '' });
    setRel(null);
    setImg(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={send} className="grid gap-4 rounded-2xl border border-palco bg-lona p-5">
        <div>
          <span className="mb-1 block text-sm font-medium">Vincular um CD ou single (opcional)</span>
          {rel ? (
            <div className="flex items-center gap-3 rounded-xl border border-sol bg-noite/60 p-3">
              {coverUrl(rel.cover_path) ? <img src={coverUrl(rel.cover_path)!} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <span className="h-14 w-14 rounded-lg bg-palco" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{rel.title}</span>
                <span className="block truncate text-sm text-nevoa">{rel.artist} · {kindName[rel.kind] || 'CD'}</span>
              </span>
              <button type="button" onClick={() => setRel(null)} className="h-9 rounded-full border border-palco px-3 text-sm font-semibold">Trocar</button>
            </div>
          ) : (
            <>
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Busque pelo nome do CD ou do artista" className="field" />
              {(find || releases.length <= 8) && (
                <ul className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-palco">
                  {matches.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => pick(r)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-palco">
                        {coverUrl(r.cover_path) ? <img src={coverUrl(r.cover_path)!} alt="" className="h-10 w-10 rounded-md object-cover" /> : <span className="h-10 w-10 rounded-md bg-palco" />}
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{r.title}</span><span className="block truncate text-xs text-nevoa">{r.artist} · {kindName[r.kind] || 'CD'}</span></span>
                      </button>
                    </li>
                  ))}
                  {!matches.length && <li className="px-3 py-2 text-sm text-nevoa">Nenhum lançamento encontrado.</li>}
                </ul>
              )}
            </>
          )}
          <p className="mt-1 text-xs text-nevoa">Com um lançamento, a capa vai como imagem, o e-mail mostra as faixas e o toque no aviso abre o CD.</p>
        </div>
        <label className="block"><span className="mb-1 block text-sm font-medium">Título</span><input required maxLength={90} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="field" placeholder="Ex.: Saiu o CD novo do Netto Brito" /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium">Texto (opcional)</span><textarea rows={3} maxLength={240} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="field" /></label>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <label className="block"><span className="mb-1 block text-sm font-medium">Link {rel ? '(já vai para o CD)' : '(opcional)'}</span><input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} className="field" placeholder={rel ? `/${rel.artist_slug}/${rel.slug}` : '/top ou https://...'} /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Só para o estado</span>
            <select value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value })} className="field"><option value="">Todos</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </label>
        </div>
        <label className="block"><span className="mb-1 block text-sm font-medium">Imagem própria (opcional, substitui a capa)</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImg(e.target.files?.[0] || null)} className="block text-sm text-nevoa file:mr-3 file:rounded-full file:border-0 file:bg-palco file:px-4 file:py-2 file:font-semibold file:text-luar" />
        </label>
        <div><button disabled={busy} className="h-12 rounded-full bg-sol px-7 font-semibold text-noite disabled:opacity-60">{busy ? 'Enviando…' : 'Enviar aviso'}</button></div>
      </form>

      <aside aria-label="Prévia" className="space-y-4">
        <p className="text-sm font-semibold text-nevoa">Como chega no celular</p>
        <div className="overflow-hidden rounded-2xl bg-[#2A2A33] text-white shadow-xl">
          <div className="flex items-start gap-3 p-3">
            <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-white/60">{brandName} · agora</p>
              <p className="truncate text-sm font-semibold">{f.title || 'Título do aviso'}</p>
              <p className="line-clamp-2 text-[13px] text-white/80">{f.body || (rel ? `${rel.artist} · ${rel.title}` : 'Texto do aviso')}</p>
            </div>
            {preview && <img src={preview} alt="" className="h-11 w-11 rounded-md object-cover" />}
          </div>
          {preview && <img src={preview} alt="" className="aspect-[2/1] w-full object-cover" />}
          {(rel || f.link) && <div className="border-t border-white/10 px-4 py-2.5 text-sm font-semibold text-[#8AB4F8]">{rel ? 'Ouvir agora' : 'Abrir'}</div>}
        </div>
        <p className="text-sm font-semibold text-nevoa">No sino do site</p>
        <div className="flex items-center gap-3 rounded-2xl border border-palco bg-lona p-3">
          {preview ? <img src={preview} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full border border-palco p-2"><img src="/brand/marca.png" alt="" /></span>}
          <span className="min-w-0"><span className="block truncate font-semibold">{f.title || 'Título do aviso'}</span><span className="block truncate text-sm text-nevoa">{f.body || 'Texto do aviso'}</span></span>
        </div>
      </aside>
    </div>
  );
}
