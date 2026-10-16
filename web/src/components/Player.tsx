'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type Hls from 'hls.js';
import { usePlayer } from '@/store/player';
import { formatDuration } from '@/lib/media';
import { createClient } from '@/lib/supabase/client';
import { useT } from './TextsProvider';
import { NextIcon, PauseIcon, PlayIcon, PrevIcon, QueueIcon, RepeatIcon, ShuffleIcon, VolumeIcon } from './Icons';

type Ad = { id: string; advertiser: string; headline: string | null; click_url: string | null; media_url: string; duration_sec: number | null };

export function anonId() {
  try {
    let id = localStorage.getItem('mk_anon');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('mk_anon', id);
    }
    return id;
  } catch {
    return null;
  }
}

function attribution() {
  try {
    return { ref: sessionStorage.getItem('mk_ref'), source: sessionStorage.getItem('mk_src') };
  } catch {
    return { ref: null, source: null };
  }
}

export default function Player({ isPremium = false, adEvery = 3 }: { isPremium?: boolean; adEvery?: number }) {
  const router = useRouter();
  const t = useT();
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const listened = useRef(0);
  const lastTime = useRef(0);
  const loadedId = useRef<string | null>(null);
  const sinceAd = useRef(0);
  const adDecidedFor = useRef<string | null>(null);

  const { queue, index, playing, shuffle, repeat, toasts } = usePlayer();
  const { setPlaying, next, prev, toggle, toggleShuffle, cycleRepeat, jump, toast, setCtl } = usePlayer();
  const track = queue[index] ?? null;

  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [panel, setPanel] = useState<'none' | 'queue' | 'lyrics'>('none');
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
  const [ad, setAd] = useState<Ad | null>(null);
  const [adTick, setAdTick] = useState(0);

  const report = useCallback(
    (trackId: string | null, beacon = false) => {
      const secs = Math.round(listened.current);
      listened.current = 0;
      if (!trackId || secs < 5) return;
      const { ref, source } = attribution();
      const body = JSON.stringify({ trackId, seconds: secs, anonId: anonId(), ref, source });
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/play', new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch('/api/play', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (!res) return;
          if (res.points > 0) toast(`+${res.points} pontos`);
          (res.badges || []).forEach((b: string) => toast(`Nova insígnia: ${b}`));
        })
        .catch(() => {});
    },
    [toast],
  );

  // controle externo (ouvir junto)
  useEffect(() => {
    setCtl({
      time: () => audioRef.current?.currentTime || 0,
      seek: (t: number) => {
        if (audioRef.current) {
          audioRef.current.currentTime = t;
          lastTime.current = t;
        }
      },
    });
    return () => setCtl(null);
  }, [setCtl]);

  const loadTrack = useCallback(
    (audio: HTMLAudioElement, t: NonNullable<typeof track>) => {
      loadedId.current = t.id;
      sinceAd.current += 1;
      lastTime.current = 0;
      setTime(0);
      setDuration(t.duration || 0);
      hlsRef.current?.destroy();
      hlsRef.current = null;

      const startPlayback = () => {
        if (usePlayer.getState().playing) audio.play().catch(() => setPlaying(false));
      };
      if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        audio.src = t.hls;
        startPlayback();
      } else {
        import('hls.js').then(({ default: HlsLib }) => {
          if (loadedId.current !== t.id) return;
          if (!HlsLib.isSupported()) return toast('Este navegador não toca HLS');
          const hls = new HlsLib({ maxBufferLength: 30 });
          hlsRef.current = hls;
          hls.loadSource(t.hls);
          hls.attachMedia(audio);
          hls.on(HlsLib.Events.MANIFEST_PARSED, startPlayback);
          hls.on(HlsLib.Events.ERROR, (_e, data) => {
            if (!data.fatal) return;
            if (data.type === HlsLib.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (data.type === HlsLib.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else toast('Não foi possível tocar esta faixa');
          });
        });
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.title,
          artist: t.artistName,
          album: t.releaseTitle,
          artwork: t.cover ? [{ src: t.cover, sizes: '512x512' }] : [],
        });
      }
    },
    [setPlaying, toast],
  );

  // troca de faixa, com anúncio em áudio a cada N faixas para quem não é Premium
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track || ad) return;
    if (loadedId.current === track.id) return;
    report(loadedId.current);
    loadedId.current = null;

    if (!isPremium && adEvery > 0 && sinceAd.current >= adEvery && adDecidedFor.current !== track.id) {
      adDecidedFor.current = track.id;
      fetch(`/api/ads?kind=audio&ctx=player&anon=${anonId() || ''}&genre=${encodeURIComponent(track.genre || '')}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((a: Ad | null) => {
          if (a?.id && a.media_url) {
            sinceAd.current = 0;
            hlsRef.current?.destroy();
            hlsRef.current = null;
            setAd(a);
            audio.src = a.media_url;
            audio.play().catch(() => setPlaying(false));
            if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: `Anúncio: ${a.advertiser}`, artist: 'Musika' });
          } else {
            sinceAd.current = 0;
            setAdTick((n) => n + 1);
          }
        })
        .catch(() => setAdTick((n) => n + 1));
      return;
    }
    loadTrack(audio, track);
  }, [track, ad, adTick, isPremium, adEvery, report, loadTrack, setPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || (!track && !ad)) return;
    if (playing && audio.paused) audio.play().catch(() => setPlaying(false));
    if (!playing && !audio.paused) audio.pause();
  }, [playing, track, ad, setPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => setPlaying(true));
    ms.setActionHandler('pause', () => setPlaying(false));
    ms.setActionHandler('nexttrack', () => { if (!ad) next(); });
    ms.setActionHandler('previoustrack', () => { if (!ad) prev(); });
    ms.setActionHandler('seekto', (d) => {
      if (!ad && audioRef.current && d.seekTime != null) audioRef.current.currentTime = d.seekTime;
    });
  }, [setPlaying, next, prev, ad]);

  useEffect(() => {
    const onHide = () => report(loadedId.current, true);
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [report]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || !usePlayer.getState().queue.length) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowRight' && e.shiftKey && !ad) next();
      if (e.code === 'ArrowLeft' && e.shiftKey && !ad) prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, next, prev, ad]);

  // letra da faixa atual
  useEffect(() => {
    if (panel !== 'lyrics' || !track) return;
    setLyrics(null);
    createClient().from('tracks').select('lyrics').eq('id', track.id).maybeSingle().then(({ data }) => setLyrics(data?.lyrics || ''));
  }, [panel, track]);

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    if (!ad) {
      const delta = a.currentTime - lastTime.current;
      if (delta > 0 && delta < 2 && !a.paused) listened.current += delta;
      lastTime.current = a.currentTime;
    }
    setTime(a.currentTime);
    if (Number.isFinite(a.duration)) setDuration(a.duration);
  };

  const onEnded = () => {
    if (ad) {
      fetch('/api/ads/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ c: ad.id, a: anonId() }), keepalive: true }).catch(() => {});
      setAd(null);
      return;
    }
    if (usePlayer.getState().repeat === 'one' && audioRef.current) {
      report(loadedId.current);
      lastTime.current = 0;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      return;
    }
    next(true);
  };

  const seek = (v: number) => {
    if (ad) return;
    if (audioRef.current) {
      audioRef.current.currentTime = v;
      lastTime.current = v;
    }
  };

  const startRoom = () => {
    const code = Math.random().toString(36).slice(2, 8);
    try { sessionStorage.setItem(`mk_host_${code}`, '1'); } catch {}
    router.push(`/sala/${code}`);
  };

  const showBar = track || ad;

  return (
    <>
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
      />

      <div className="pointer-events-none fixed bottom-36 right-4 z-50 flex flex-col items-end gap-2 md:bottom-24" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in rounded-full bg-mandacaru px-4 py-2 text-sm font-semibold text-noite">{t.text}</div>
        ))}
      </div>

      {showBar && (
        <div className="fixed inset-x-0 bottom-14 z-40 border-t border-palco bg-lona/95 backdrop-blur md:bottom-0">
          {ad ? (
            <div className="absolute -top-[3px] left-0 h-[3px] bg-sol" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
          ) : (
            <input aria-label="Posição da música" type="range" min={0} max={duration || 0} step={0.5} value={Math.min(time, duration || 0)} onChange={(e) => seek(Number(e.target.value))} className="seek absolute -top-[7px] left-0 w-full md:hidden" />
          )}
          <div className="mx-auto flex h-20 max-w-[1400px] items-center gap-3 px-3 md:gap-6 md:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {ad ? (
                <>
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-sol text-xs font-bold text-noite">AD</div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{ad.headline || `Anúncio de ${ad.advertiser}`}</p>
                    <p className="truncate text-sm text-nevoa">
                      Anúncio de {ad.advertiser}, {Math.max(0, Math.ceil(duration - time))} s.{' '}
                      {!isPremium && <Link href="/premium" className="text-sol hover:underline">{t('player_ad_upsell')}</Link>}
                    </p>
                  </div>
                  {ad.click_url && (
                    <a href={`/api/ads/click?c=${ad.id}&a=${anonId() || ''}`} target="_blank" rel="noopener sponsored" className="ml-2 hidden h-9 shrink-0 items-center rounded-full border border-luar/40 px-4 text-sm font-semibold hover:border-luar sm:inline-flex">
                      Saiba mais
                    </a>
                  )}
                </>
              ) : track ? (
                <>
                  {track.cover ? <img src={track.cover} alt="" className="h-12 w-12 shrink-0 rounded-[10px] object-cover" /> : <div className="h-12 w-12 shrink-0 rounded-[10px] bg-palco" />}
                  <div className="min-w-0">
                    <Link href={`/${track.artistSlug}/${track.releaseSlug}`} className="block truncate font-semibold text-luar hover:underline">{track.title}</Link>
                    <Link href={`/${track.artistSlug}`} className="block truncate text-sm text-nevoa hover:text-luar">{track.artistName}</Link>
                  </div>
                  <div className={`paredao ml-1 hidden sm:flex ${playing && !buffering ? 'is-on' : ''}`} aria-hidden><span /><span /><span /><span /><span /></div>
                </>
              ) : null}
            </div>

            <div className="flex flex-col items-center md:flex-[1.4]">
              <div className="flex items-center gap-1 md:gap-3">
                <button onClick={toggleShuffle} disabled={!!ad} aria-pressed={shuffle} aria-label="Aleatório" className={`ctl hidden disabled:opacity-30 md:inline-grid ${shuffle ? 'text-sol' : ''}`}><ShuffleIcon className="h-[18px] w-[18px]" /></button>
                <button onClick={prev} disabled={!!ad} aria-label="Anterior" className="ctl disabled:opacity-30"><PrevIcon /></button>
                <button onClick={toggle} aria-label={playing ? 'Pausar' : 'Tocar'} className="grid h-11 w-11 place-items-center rounded-full bg-sol text-noite transition-transform active:scale-95">
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button onClick={() => next()} disabled={!!ad} aria-label="Próxima" className="ctl disabled:opacity-30"><NextIcon /></button>
                <button onClick={cycleRepeat} disabled={!!ad} aria-label={`Repetir: ${repeat}`} className={`ctl relative hidden disabled:opacity-30 md:inline-grid ${repeat !== 'off' ? 'text-sol' : ''}`}>
                  <RepeatIcon className="h-[18px] w-[18px]" />
                  {repeat === 'one' && <span className="absolute -right-0.5 -top-0.5 text-[10px] font-bold">1</span>}
                </button>
              </div>
              {!ad && (
                <div className="mt-1 hidden w-full max-w-[560px] items-center gap-2 text-xs tabular-nums text-nevoa md:flex">
                  <span className="w-10 text-right">{formatDuration(time) || '0:00'}</span>
                  <input aria-label="Posição da música" type="range" min={0} max={duration || 0} step={0.5} value={Math.min(time, duration || 0)} onChange={(e) => seek(Number(e.target.value))} className="seek flex-1" />
                  <span className="w-10">{formatDuration(duration)}</span>
                </div>
              )}
            </div>

            <div className="hidden flex-1 items-center justify-end gap-2 md:flex">
              <button onClick={() => setPanel(panel === 'lyrics' ? 'none' : 'lyrics')} disabled={!!ad} aria-pressed={panel === 'lyrics'} className={`h-9 rounded-full px-3 text-sm font-semibold disabled:opacity-30 ${panel === 'lyrics' ? 'bg-palco text-sol' : 'text-nevoa hover:text-luar'}`}>Letra</button>
              <button onClick={startRoom} disabled={!!ad || !track} className="h-9 rounded-full px-3 text-sm font-semibold text-nevoa hover:text-luar disabled:opacity-30">Ouvir junto</button>
              <button onClick={() => setPanel(panel === 'queue' ? 'none' : 'queue')} aria-label="Fila" aria-expanded={panel === 'queue'} className={`ctl ${panel === 'queue' ? 'text-sol' : ''}`}><QueueIcon /></button>
              <VolumeIcon className="h-5 w-5 text-nevoa" />
              <input aria-label="Volume" type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="seek w-24" />
            </div>
          </div>

          {panel === 'queue' && (
            <div className="absolute bottom-full right-4 mb-2 max-h-[60vh] w-[360px] overflow-auto rounded-capa border border-palco bg-noite p-3">
              <p className="mb-2 px-2 font-display text-lg font-bold">Tocando a seguir</p>
              <ol>
                {queue.map((t, i) => (
                  <li key={`${t.id}-${i}`}>
                    <button onClick={() => jump(i)} className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-lona ${i === index ? 'text-sol' : ''}`}>
                      <span className="w-5 text-right text-xs tabular-nums text-nevoa">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className="block truncate text-xs text-nevoa">{t.artistName}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {panel === 'lyrics' && track && (
            <div className="absolute bottom-full right-4 mb-2 max-h-[65vh] w-[400px] overflow-auto rounded-capa border border-palco bg-noite p-5">
              <p className="font-display text-lg font-bold">{track.title}</p>
              <p className="text-sm text-nevoa">{track.artistName}</p>
              {lyrics === null ? (
                <p className="mt-4 text-nevoa">Carregando…</p>
              ) : lyrics ? (
                <p className="mt-4 whitespace-pre-line text-lg leading-relaxed">{lyrics}</p>
              ) : (
                <p className="mt-4 text-nevoa">O artista ainda não publicou a letra desta música.</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
