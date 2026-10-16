'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';
import type { PlayerTrack } from '@/lib/types';

type StateMsg = { track: PlayerTrack | null; time: number; playing: boolean; sentAt: number };
type Chat = { id: string; name: string; text: string };

// Ouvir junto: o anfitrião transmite o que está tocando e todo mundo na sala acompanha no mesmo segundo
export default function Sala() {
  const { code } = useParams<{ code: string }>();
  const [isHost, setIsHost] = useState(false);
  const [name, setName] = useState('Ouvinte');
  const [people, setPeople] = useState<{ name: string; host: boolean }[]>([]);
  const [chat, setChat] = useState<Chat[]>([]);
  const [text, setText] = useState('');
  const [hostTrack, setHostTrack] = useState<PlayerTrack | null>(null);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const toast = usePlayer((s) => s.toast);

  useEffect(() => {
    try { setIsHost(sessionStorage.getItem(`mk_host_${code}`) === '1'); } catch {}
    createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await createClient().from('profiles').select('display_name, username').eq('id', data.user.id).maybeSingle();
      if (p) setName(p.display_name || p.username);
    });
  }, [code]);

  useEffect(() => {
    const supabase = createClient();
    const me = crypto.randomUUID();
    const ch = supabase.channel(`sala-${code}`, { config: { broadcast: { self: false }, presence: { key: me } } });
    channelRef.current = ch;

    const snapshot = (): StateMsg => {
      const s = usePlayer.getState();
      return { track: s.queue[s.index] ?? null, time: s.ctl?.time() || 0, playing: s.playing, sentAt: Date.now() };
    };

    ch.on('broadcast', { event: 'state' }, ({ payload }) => {
      if (isHost) return;
      const msg = payload as StateMsg;
      setHostTrack(msg.track);
      if (!msg.track) return;
      const s = usePlayer.getState();
      const target = msg.time + (msg.playing ? (Date.now() - msg.sentAt) / 1000 : 0);
      if (s.queue[s.index]?.id !== msg.track.id) {
        s.playQueue([msg.track], 0, `sala:${code}`);
        setTimeout(() => usePlayer.getState().ctl?.seek(target + 1.5), 1500);
      } else if (s.ctl && Math.abs(s.ctl.time() - target) > 2) {
        s.ctl.seek(target);
      }
      if (s.playing !== msg.playing) s.setPlaying(msg.playing);
    });
    ch.on('broadcast', { event: 'hello' }, () => {
      if (isHost) ch.send({ type: 'broadcast', event: 'state', payload: snapshot() });
    });
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => setChat((c) => [...c.slice(-80), payload as Chat]));
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState<{ name: string; host: boolean }>();
      setPeople(Object.values(st).map((v) => v[0]).filter(Boolean));
    });

    ch.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      setConnected(true);
      await ch.track({ name, host: isHost });
      if (!isHost) ch.send({ type: 'broadcast', event: 'hello', payload: {} });
    });

    let timer: ReturnType<typeof setInterval> | null = null;
    let unsub: (() => void) | null = null;
    if (isHost) {
      const send = () => ch.send({ type: 'broadcast', event: 'state', payload: snapshot() });
      timer = setInterval(send, 2000);
      unsub = usePlayer.subscribe((s, prev) => {
        if (s.index !== prev.index || s.playing !== prev.playing || s.queue !== prev.queue) setTimeout(send, 300);
      });
    }
    return () => {
      if (timer) clearInterval(timer);
      unsub?.();
      supabase.removeChannel(ch);
      setConnected(false);
    };
  }, [code, isHost, name]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !channelRef.current) return;
    const msg = { id: crypto.randomUUID(), name, text: text.trim().slice(0, 300) };
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg });
    setChat((c) => [...c, msg]);
    setText('');
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast('Link da sala copiado'); } catch {}
  };

  const current = usePlayer((s) => s.queue[s.index]);
  const shown = isHost ? current : hostTrack;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section>
        <p className="text-sm font-semibold text-chita">{isHost ? 'Você está no comando' : 'Ouvindo junto'}{connected ? '' : ', conectando…'}</p>
        <h1 className="mt-1 font-display text-[clamp(2.5rem,7vw,5rem)] font-extrabold leading-[0.9] tracking-tight">Sala {code.toUpperCase()}</h1>
        <p className="mt-3 max-w-[56ch] text-nevoa">
          {isHost ? 'Toque qualquer música no Musika: quem estiver na sala ouve a mesma coisa, no mesmo segundo.' : 'O anfitrião escolhe as músicas. Seu player acompanha sozinho.'}
        </p>
        <button onClick={copy} className="mt-5 h-12 rounded-full bg-sol px-6 font-semibold text-noite">Copiar link da sala</button>

        <div className="mt-8 flex items-center gap-4 rounded-capa bg-lona p-4">
          {shown?.cover ? <img src={shown.cover} alt="" className="h-20 w-20 rounded-xl object-cover" /> : <div className="h-20 w-20 rounded-xl bg-palco" />}
          <div className="min-w-0">
            <p className="text-sm text-nevoa">Tocando agora</p>
            <p className="truncate font-display text-2xl font-bold">{shown?.title || 'Nada ainda'}</p>
            <p className="truncate text-nevoa">{shown?.artistName || (isHost ? 'Escolha uma música para começar' : 'Esperando o anfitrião')}</p>
          </div>
        </div>

        <h2 className="mt-8 font-display text-xl font-bold">Na sala ({people.length})</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {people.map((p, i) => (
            <li key={i} className={`rounded-full px-3 py-1.5 text-sm ${p.host ? 'bg-sol text-noite' : 'bg-lona'}`}>{p.name}{p.host ? ', anfitrião' : ''}</li>
          ))}
        </ul>
      </section>

      <aside className="flex h-[60vh] flex-col rounded-capa bg-lona p-4">
        <h2 className="font-display text-xl font-bold">Conversa</h2>
        <ul className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
          {chat.map((m) => (
            <li key={m.id} className="text-sm"><span className="font-semibold text-sol">{m.name}</span> {m.text}</li>
          ))}
          {!chat.length && <li className="text-sm text-nevoa">Mande um oi para a sala.</li>}
        </ul>
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Mensagem" className="field" aria-label="Mensagem" />
          <button className="h-12 shrink-0 rounded-full bg-sol px-4 font-semibold text-noite">Enviar</button>
        </form>
      </aside>
    </div>
  );
}
