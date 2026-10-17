'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlayer } from '@/store/player';
import { avatarUrl, levelInfo } from '@/lib/media';

export type AdminUser = {
  id: string; username: string; display_name: string | null; email: string; avatar_url: string | null; city: string | null; uf: string | null; xp: number;
  premium_until: string | null; premium_note: string | null; is_admin: boolean; blocked_at: string | null; blocked_reason: string | null;
  created_at: string; last_sign_in_at: string | null; artists: number; plays: number; paid_cents: number;
};

const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : 'nunca');
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Badge({ children, tone }: { children: React.ReactNode; tone: 'sol' | 'verde' | 'cinza' | 'alerta' }) {
  const cls = { sol: 'bg-sol text-noite', verde: 'bg-mandacaru/20 text-mandacaru', cinza: 'bg-palco text-luar', alerta: 'bg-chita/20 text-chita' }[tone];
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}>{children}</span>;
}

function Row({ u, me }: { u: AdminUser; me: string }) {
  const router = useRouter();
  const toast = usePlayer((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [note, setNote] = useState('');
  const premium = !!u.premium_until && new Date(u.premium_until) > new Date();
  const name = u.display_name || u.username;
  const foto = avatarUrl(u.avatar_url);

  const act = async (action: string, extra: Record<string, unknown>, ok: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(action);
    const r = await fetch('/api/admin/usuarios', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, user: u.id, ...extra }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return toast(j.error || 'Não foi possível');
    toast(ok);
    router.refresh();
  };

  return (
    <li className={`rounded-2xl border bg-lona ${u.blocked_at ? 'border-chita/40' : 'border-palco'}`}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-4 p-4 text-left">
        {foto ? <img src={foto} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-palco text-lg font-black uppercase text-sol">{name.slice(0, 1)}</span>}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-bold">{name}</span>
            {u.is_admin && <Badge tone="cinza">Admin</Badge>}
            {premium && <Badge tone="sol">Premium</Badge>}
            {u.artists > 0 && <Badge tone="verde">Artista</Badge>}
            {u.blocked_at && <Badge tone="alerta">Bloqueado</Badge>}
          </span>
          <span className="mt-0.5 block truncate text-sm text-nevoa">@{u.username} · {u.email}</span>
        </span>
        <span className="hidden shrink-0 text-right text-sm text-nevoa sm:block">
          <span className="block">{levelInfo(u.xp).name}, {u.xp} pts</span>
          <span className="block">desde {d(u.created_at)}</span>
        </span>
        <span className={`shrink-0 text-xl text-nevoa transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>›</span>
      </button>

      {open && (
        <div className="grid gap-5 border-t border-palco p-4 md:grid-cols-2">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-nevoa">Cidade</dt><dd className="font-semibold">{u.city ? `${u.city}${u.uf ? `/${u.uf}` : ''}` : 'não informou'}</dd></div>
            <div><dt className="text-nevoa">Último acesso</dt><dd className="font-semibold">{d(u.last_sign_in_at)}</dd></div>
            <div><dt className="text-nevoa">Plays</dt><dd className="font-semibold tabular-nums">{u.plays}</dd></div>
            <div><dt className="text-nevoa">Pagou no total</dt><dd className="font-semibold tabular-nums">{brl(u.paid_cents)}</dd></div>
            <div><dt className="text-nevoa">Perfis de artista</dt><dd className="font-semibold">{u.artists}</dd></div>
            <div><dt className="text-nevoa">Premium</dt><dd className="font-semibold">{premium ? `até ${d(u.premium_until)}` : 'não'}</dd></div>
            {premium && u.premium_note && <div className="col-span-2"><dt className="text-nevoa">Origem do Premium</dt><dd className="font-semibold">{u.premium_note}</dd></div>}
            {u.blocked_at && <div className="col-span-2"><dt className="text-nevoa">Bloqueado em {d(u.blocked_at)}</dt><dd className="font-semibold">{u.blocked_reason || 'sem motivo informado'}</dd></div>}
            <div className="col-span-2"><a href={`/perfil/${u.username}`} target="_blank" className="font-semibold text-sol hover:underline">Ver perfil público</a></div>
          </dl>

          <div className="space-y-4">
            <div className="rounded-xl bg-noite/60 p-4">
              <p className="font-bold">{premium ? 'Estender Premium' : 'Dar Premium'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[7, 30, 90, 365].map((n) => (
                  <button key={n} type="button" onClick={() => setDays(n)} className={`h-9 rounded-full border px-4 text-sm font-semibold ${days === n ? 'border-sol bg-sol text-noite' : 'border-palco'}`}>{n === 365 ? '1 ano' : `${n} dias`}</button>
                ))}
                <input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} className="field h-9 w-24" aria-label="Dias" />
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo (ex.: cortesia, parceria, sorteio)" className="field mt-3 h-10" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={!!busy || days < 1} onClick={() => act('premium', { days, note }, `Premium de ${days} dias dado para ${name}`)} className="h-10 rounded-full bg-sol px-5 text-sm font-semibold text-noite disabled:opacity-50">{busy === 'premium' ? 'Salvando…' : premium ? `Somar ${days} dias` : `Dar ${days} dias`}</button>
                {premium && <button disabled={!!busy} onClick={() => act('premium', { days: 0 }, 'Premium removido', `Tirar o Premium de ${name}?`)} className="h-10 rounded-full border border-palco px-5 text-sm font-semibold">Tirar Premium</button>}
              </div>
              <p className="mt-2 text-xs text-nevoa">O usuário recebe um aviso no sino e no celular.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {u.id !== me && (
                <button disabled={!!busy} onClick={() => act('admin', { on: !u.is_admin }, u.is_admin ? 'Não é mais administrador' : 'Agora é administrador', u.is_admin ? `Tirar o acesso de administrador de ${name}?` : `Dar acesso total ao /admin para ${name}?`)} className="h-10 rounded-full border border-palco px-4 text-sm font-semibold hover:border-sol">{u.is_admin ? 'Tirar admin' : 'Tornar admin'}</button>
              )}
              {u.id !== me && (u.blocked_at ? (
                <button disabled={!!busy} onClick={() => act('block', { on: false }, 'Conta desbloqueada')} className="h-10 rounded-full border border-palco px-4 text-sm font-semibold hover:border-sol">Desbloquear</button>
              ) : (
                <button disabled={!!busy} onClick={() => { const reason = window.prompt(`Motivo do bloqueio de ${name} (opcional):`); if (reason !== null) act('block', { on: true, reason }, 'Conta bloqueada'); }} className="h-10 rounded-full border border-chita/50 px-4 text-sm font-semibold text-chita">Bloquear</button>
              ))}
              {u.id !== me && (
                <button disabled={!!busy} onClick={() => act('delete', {}, 'Conta excluída', `Excluir a conta de ${name} para sempre? Pontos, playlists e curtidas somem. Perfis de artista continuam para o resto da equipe.`)} className="h-10 rounded-full px-4 text-sm font-semibold text-nevoa hover:text-chita">Excluir conta</button>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export default function UsersList({ users, me }: { users: AdminUser[]; me: string }) {
  if (!users.length) return <p className="mt-6 text-nevoa">Nenhum usuário com esse filtro.</p>;
  return <ul className="mt-6 space-y-3">{users.map((u) => <Row key={u.id} u={u} me={me} />)}</ul>;
}
