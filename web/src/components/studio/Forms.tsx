'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';
import { brl } from '@/lib/media';
import { placementLabel } from '@/lib/labels';
import PixCheckout from '@/components/PixCheckout';

function useSaver() {
  const router = useRouter();
  const toast = usePlayer((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string, reset?: () => void) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast(`Não foi possível salvar: ${error.message}`), false;
    toast(ok);
    reset?.();
    router.refresh();
    return true;
  };
  return { busy, run };
}

const Label = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <label className="block"><span className="mb-1 block text-sm font-medium">{t}</span>{children}</label>
);
const Save = ({ busy, text }: { busy: boolean; text: string }) => (
  <button disabled={busy} className="h-11 rounded-full bg-sol px-6 font-semibold text-noite disabled:opacity-60">{busy ? 'Salvando…' : text}</button>
);

export function EventForm({ artistId }: { artistId: string }) {
  const { busy, run } = useSaver();
  const empty = { title: '', venue: '', city: '', uf: '', starts_at: '', ticket_url: '' };
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createClient().from('events').insert({ artist_id: artistId, ...f, uf: f.uf.toUpperCase() || null, ticket_url: f.ticket_url || null, starts_at: new Date(f.starts_at).toISOString() }), 'Show adicionado', () => setF(empty));
      }}
      className="grid gap-3 rounded-capa bg-lona p-5 sm:grid-cols-2"
    >
      <Label t="Nome do show"><input required value={f.title} onChange={set('title')} className="field" placeholder="Ex.: Arrocha no Parque" /></Label>
      <Label t="Data e hora"><input required type="datetime-local" value={f.starts_at} onChange={set('starts_at')} className="field" /></Label>
      <Label t="Local"><input value={f.venue} onChange={set('venue')} className="field" /></Label>
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <Label t="Cidade"><input value={f.city} onChange={set('city')} className="field" /></Label>
        <Label t="UF"><input maxLength={2} value={f.uf} onChange={set('uf')} className="field" /></Label>
      </div>
      <Label t="Link de ingressos (opcional)"><input type="url" value={f.ticket_url} onChange={set('ticket_url')} className="field" placeholder="https://" /></Label>
      <div className="self-end"><Save busy={busy} text="Adicionar show" /></div>
    </form>
  );
}

export function MissionForm({ artistId, releases, events }: { artistId: string; releases: { id: string; title: string }[]; events: { id: string; title: string }[] }) {
  const { busy, run } = useSaver();
  const empty = { title: '', description: '', kind: 'listen_release', target_id: releases[0]?.id || '', goal: 3, points: 30, ends_at: '' };
  const [f, setF] = useState(empty);
  const needsTarget = f.kind === 'listen_release' || f.kind === 'checkin';
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createClient().from('missions').insert({
          artist_id: artistId, title: f.title, description: f.description || null, kind: f.kind,
          target_id: needsTarget ? f.target_id || null : null, goal: f.goal, points: f.points,
          ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
        }), 'Missão publicada', () => setF(empty));
      }}
      className="grid gap-3 rounded-capa bg-lona p-5 sm:grid-cols-2"
    >
      <Label t="Título"><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="field" placeholder="Ex.: Ouça o CD novo 3 vezes" /></Label>
      <Label t="Tipo">
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, target_id: e.target.value === 'checkin' ? events[0]?.id || '' : releases[0]?.id || '' })} className="field">
          <option value="listen_release">Ouvir faixas de um lançamento</option>
          <option value="listen_tracks">Ouvir qualquer faixa minha</option>
          <option value="share">Trazer amigos pelo link</option>
          <option value="checkin">Fazer check-in em show</option>
        </select>
      </Label>
      {f.kind === 'listen_release' && (
        <Label t="Lançamento">
          <select value={f.target_id} onChange={(e) => setF({ ...f, target_id: e.target.value })} className="field">
            {releases.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        </Label>
      )}
      {f.kind === 'checkin' && (
        <Label t="Show (vazio = qualquer show)">
          <select value={f.target_id} onChange={(e) => setF({ ...f, target_id: e.target.value })} className="field">
            <option value="">Qualquer show</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
          </select>
        </Label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Label t="Meta"><input type="number" min={1} max={1000} value={f.goal} onChange={(e) => setF({ ...f, goal: Number(e.target.value) })} className="field" /></Label>
        <Label t="Pontos de prêmio"><input type="number" min={1} max={500} value={f.points} onChange={(e) => setF({ ...f, points: Number(e.target.value) })} className="field" /></Label>
      </div>
      <Label t="Termina em (opcional)"><input type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} className="field" /></Label>
      <Label t="Descrição (opcional)"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="field" /></Label>
      <div className="self-end"><Save busy={busy} text="Publicar missão" /></div>
    </form>
  );
}

export function RewardForm({ artistId }: { artistId: string }) {
  const { busy, run } = useSaver();
  const empty = { title: '', description: '', cost_points: 200, stock: 5 };
  const [f, setF] = useState(empty);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); run(() => createClient().from('rewards').insert({ artist_id: artistId, ...f, description: f.description || null }), 'Recompensa publicada', () => setF(empty)); }}
      className="grid gap-3 rounded-capa bg-lona p-5 sm:grid-cols-2"
    >
      <Label t="Recompensa"><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="field" placeholder="Ex.: Acesso ao camarim" /></Label>
      <Label t="Detalhes (opcional)"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="field" /></Label>
      <div className="grid grid-cols-2 gap-3">
        <Label t="Custo em pontos"><input type="number" min={1} value={f.cost_points} onChange={(e) => setF({ ...f, cost_points: Number(e.target.value) })} className="field" /></Label>
        <Label t="Quantidade"><input type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} className="field" /></Label>
      </div>
      <div className="self-end"><Save busy={busy} text="Publicar recompensa" /></div>
    </form>
  );
}

export function ToggleActive({ table, id, active }: { table: 'missions' | 'rewards'; id: string; active: boolean }) {
  const { busy, run } = useSaver();
  return (
    <button disabled={busy} onClick={() => run(() => createClient().from(table).update({ active: !active }).eq('id', id), active ? 'Desativado' : 'Reativado')} className="h-9 rounded-full border border-luar/40 px-4 text-sm font-semibold">
      {active ? 'Desativar' : 'Reativar'}
    </button>
  );
}

export function DeleteRow({ table, id, label = 'Excluir', confirm = 'Excluir mesmo?' }: { table: string; id: string; label?: string; confirm?: string }) {
  const { busy, run } = useSaver();
  return (
    <button disabled={busy} onClick={() => window.confirm(confirm) && run(() => createClient().from(table).delete().eq('id', id), 'Excluído')} className="h-9 rounded-full px-3 text-sm font-semibold text-nevoa hover:text-chita">
      {label}
    </button>
  );
}

export function FanClubPlanForm({ artistId, plan }: { artistId: string; plan: { price_cents: number; perks: string; active: boolean } | null }) {
  const { busy, run } = useSaver();
  const [price, setPrice] = useState((plan?.price_cents || 990) / 100);
  const [perks, setPerks] = useState(plan?.perks || '');
  const [active, setActive] = useState(plan?.active ?? true);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); run(() => createClient().from('fanclub_plans').upsert({ artist_id: artistId, price_cents: Math.round(price * 100), perks, active, updated_at: new Date().toISOString() }), 'Fã-clube salvo'); }}
      className="space-y-3 rounded-capa bg-lona p-5"
    >
      <Label t="Mensalidade (R$, mínimo 5)"><input type="number" min={5} step={0.5} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="field" /></Label>
      <Label t="O que o sócio ganha"><textarea rows={4} value={perks} onChange={(e) => setPerks(e.target.value)} className="field" placeholder="Ex.: mural com bastidores, prioridade no camarim, sorteio mensal de camisa" /></Label>
      <label className="flex items-center gap-3"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-sol" /> Fã-clube aberto para novos sócios</label>
      <Save busy={busy} text="Salvar fã-clube" />
    </form>
  );
}

export function PostForm({ artistId }: { artistId: string }) {
  const { busy, run } = useSaver();
  const [body, setBody] = useState('');
  const [only, setOnly] = useState(false);
  const [img, setImg] = useState<File | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const supabase = createClient();
          const { data: u } = await supabase.auth.getUser();
          let image_path: string | null = null;
          if (img) {
            const path = `${artistId}/mural-${Date.now()}.${img.name.split('.').pop()?.toLowerCase() || 'jpg'}`;
            const up = await supabase.storage.from('covers').upload(path, img, { contentType: img.type });
            if (up.error) return { error: { message: 'imagem não subiu' } };
            image_path = path;
          }
          return supabase.from('artist_posts').insert({ artist_id: artistId, author_id: u.user?.id, body, fanclub_only: only, image_path });
        }, 'Publicado no mural', () => { setBody(''); setImg(null); });
      }}
      className="space-y-3 rounded-capa bg-lona p-5"
    >
      <Label t="Novo post no mural"><textarea required rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} className="field" /></Label>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImg(e.target.files?.[0] || null)} className="block text-sm text-nevoa file:mr-3 file:rounded-full file:border-0 file:bg-palco file:px-4 file:py-2 file:font-semibold file:text-luar" />
      <label className="flex items-center gap-3"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} className="h-5 w-5 accent-sol" /> Só para sócios do fã-clube</label>
      <Save busy={busy} text="Publicar" />
    </form>
  );
}

export function BoostForm({ artistId, releases, prices, defaultName }: { artistId: string; releases: { id: string; title: string }[]; prices: Record<string, number>; defaultName?: string | null }) {
  const router = useRouter();
  const toast = usePlayer((s) => s.toast);
  const [release, setRelease] = useState(releases[0]?.id || '');
  const [placement, setPlacement] = useState('home_hero');
  const [days, setDays] = useState(3);
  const [boostId, setBoostId] = useState<string | null>(null);
  const total = (prices[placement] || 0) * days;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('boosts').insert({ artist_id: artistId, release_id: release, placement, days, amount_cents: total, created_by: u.user?.id }).select('id').single();
    if (error || !data) return toast('Não foi possível criar o impulsionamento.');
    setBoostId(data.id);
  };

  if (!releases.length) return <p className="text-nevoa">Publique um lançamento para poder impulsionar.</p>;
  return (
    <form onSubmit={create} className="grid gap-3 rounded-capa bg-lona p-5 sm:grid-cols-2">
      <Label t="Lançamento">
        <select value={release} disabled={!!boostId} onChange={(e) => setRelease(e.target.value)} className="field">
          {releases.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
      </Label>
      <Label t="Onde aparece">
        <select value={placement} disabled={!!boostId} onChange={(e) => setPlacement(e.target.value)} className="field">
          {Object.entries(placementLabel).map(([k, v]) => <option key={k} value={k}>{v} ({brl(prices[k] || 0)}/dia)</option>)}
        </select>
      </Label>
      <Label t="Dias"><input type="number" min={1} max={60} value={days} disabled={!!boostId} onChange={(e) => setDays(Number(e.target.value))} className="field" /></Label>
      <div className="self-end">
        <p className="mb-2 text-nevoa">Total: <strong className="font-display text-2xl text-luar">{brl(total)}</strong></p>
        {boostId ? (
          <PixCheckout purpose="boost" refId={boostId} label="Pagar com Pix" amountCents={total} loggedIn defaultName={defaultName} onPaid={() => { setBoostId(null); router.refresh(); }} />
        ) : (
          <button className="h-11 rounded-full bg-sol px-6 font-semibold text-noite">Continuar</button>
        )}
      </div>
    </form>
  );
}

export function InviteButton({ artistId }: { artistId: string }) {
  const toast = usePlayer((s) => s.toast);
  const [role, setRole] = useState('editor');
  const [link, setLink] = useState<string | null>(null);
  const create = async () => {
    const { data, error } = await createClient().rpc('create_invite', { p_artist: artistId, p_role: role });
    if (error) return toast(error.message);
    const url = `${window.location.origin}/convite/${data}`;
    setLink(url);
    try { await navigator.clipboard.writeText(url); toast('Link copiado'); } catch {}
  };
  return (
    <div className="rounded-capa bg-lona p-5">
      <div className="flex flex-wrap items-end gap-3">
        <Label t="Papel">
          <select value={role} onChange={(e) => setRole(e.target.value)} className="field">
            <option value="editor">Editor (publica e edita)</option>
            <option value="manager">Empresário (também convida)</option>
          </select>
        </Label>
        <button onClick={create} className="h-12 rounded-full bg-sol px-6 font-semibold text-noite">Gerar link de convite</button>
      </div>
      {link && <p className="mt-3 break-all text-sm">Mande este link (vale 7 dias, uso único): <span className="text-sol">{link}</span></p>}
    </div>
  );
}

export async function qrDataUrl(text: string) {
  return QRCode.toDataURL(text, { margin: 1, width: 640, color: { dark: '#15112B', light: '#FFFFFF' } });
}

export function ReleaseEditor({ release, tracks }: { release: { id: string; title: string; publish_at: string; download_allowed: boolean }; tracks: { id: string; title: string; position: number; lyrics: string | null; status: string; error: string | null }[] }) {
  const { busy, run } = useSaver();
  const local = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const [r, setR] = useState({ title: release.title, publish_at: local(release.publish_at), download_allowed: release.download_allowed });
  const [ts, setTs] = useState(tracks);
  const [open, setOpen] = useState<string | null>(null);
  const saveRelease = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => createClient().from('releases').update({ title: r.title, publish_at: new Date(r.publish_at).toISOString(), download_allowed: r.download_allowed }).eq('id', release.id), 'Lançamento salvo');
  };
  const saveTrack = (t: (typeof ts)[number]) => run(() => createClient().from('tracks').update({ title: t.title, lyrics: t.lyrics || null }).eq('id', t.id), 'Faixa salva');
  return (
    <>
      <form onSubmit={saveRelease} className="grid gap-3 rounded-capa bg-lona p-5 sm:grid-cols-[1fr_220px_auto]">
        <Label t="Título"><input required value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} className="field" /></Label>
        <Label t="Publicar em"><input type="datetime-local" value={r.publish_at} onChange={(e) => setR({ ...r, publish_at: e.target.value })} className="field" /></Label>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.download_allowed} onChange={(e) => setR({ ...r, download_allowed: e.target.checked })} className="h-4 w-4 accent-sol" /> Download liberado</label>
          <Save busy={busy} text="Salvar" />
        </div>
      </form>
      <ol className="mt-6 divide-y divide-lona">
        {ts.map((t, i) => (
          <li key={t.id} className="py-3">
            <div className="flex items-center gap-3">
              <span className="w-6 text-right text-sm text-nevoa">{t.position}</span>
              <input value={t.title} onChange={(e) => setTs(ts.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} className="h-10 min-w-0 flex-1 rounded-lg bg-lona px-3 outline-none focus:ring-2 focus:ring-sol" aria-label={`Título da faixa ${t.position}`} />
              <span className={`text-xs font-semibold ${t.status === 'ready' ? 'text-mandacaru' : t.status === 'error' ? 'text-chita' : 'text-sol'}`}>{{ ready: 'pronta', error: 'erro', pending: 'na fila', processing: 'convertendo' }[t.status]}</span>
              <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} className="h-9 rounded-full px-3 text-sm font-semibold text-nevoa hover:text-luar">Letra</button>
              <button type="button" onClick={() => saveTrack(t)} disabled={busy} className="h-9 rounded-full border border-luar/40 px-4 text-sm font-semibold">Salvar</button>
            </div>
            {t.error && <p className="ml-9 mt-1 text-xs text-chita">{t.error.slice(0, 200)}</p>}
            {open === t.id && (
              <textarea rows={10} value={t.lyrics || ''} onChange={(e) => setTs(ts.map((x, k) => (k === i ? { ...x, lyrics: e.target.value } : x)))} className="field ml-9 mt-2 w-[calc(100%-2.25rem)]" placeholder="Cole a letra aqui. Uma linha por verso." />
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
