'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type Hls from 'hls.js';
import { usePlayer } from '@/store/player';
import { formatDuration } from '@/lib/media';
import { NextIcon, PauseIcon, PlayIcon, PrevIcon, QueueIcon, RepeatIcon, ShuffleIcon, VolumeIcon } from './Icons';

function anonId() {
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

export default function Player() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const listened = useRef(0);
  const lastTime = useRef(0);
  const loadedId = useRef<string | null>(null);

  const { queue, index, playing, shuffle, repeat, toasts } = usePlayer();
  const { setPlaying, next, prev, toggle, toggleShuffle, cycleRepeat, jump, toast } = usePlayer();
  const track = queue[index] ?? null;

  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showQueue, setShowQueue] = useState(false);
  const [buffering, setBuffering] = useState(false);

  // envia a escuta acumulada da faixa que está saindo
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

  // troca de faixa
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (loadedId.current === track.id) return;
    report(loadedId.current);
    loadedId.current = track.id;
    lastTime.current = 0;
    setTime(0);
    setDuration(track.duration || 0);

    hlsRef.current?.destroy();
    hlsRef.current = null;

    const startPlayback = () => {
      if (usePlayer.getState().playing) audio.play().catch(() => setPlaying(false));
    };

    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = track.hls;
      startPlayback();
    } else {
      import('hls.js').then(({ default: HlsLib }) => {
        if (!HlsLib.isSupported()) {
          toast('Este navegador não toca HLS');
          return;
        }
        const hls = new HlsLib({ maxBufferLength: 30, startLevel: -1, capLevelToPlayerSize: false });
        hlsRef.current = hls;
        hls.loadSource(track.hls);
        hls.attachMedia(audio);
        hls.on(HlsLib.Events.MANIFEST_PARSED, startPlayback);
        hls.on(HlsLib.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            if (data.type === HlsLib.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (data.type === HlsLib.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else toast('Não foi possível tocar esta faixa');
          }
        });
      });
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artistName,
        album: track.releaseTitle,
        artwork: track.cover ? [{ src: track.cover, sizes: '512x512' }] : [],
      });
    }
  }, [track, report, setPlaying, toast]);

  // play / pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (playing && audio.paused) audio.play().catch(() => setPlaying(false));
    if (!playing && !audio.paused) audio.pause();
  }, [playing, track, setPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // controles da tela de bloqueio
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => setPlaying(true));
    ms.setActionHandler('pause', () => setPlaying(false));
    ms.setActionHandler('nexttrack', () => next());
    ms.setActionHandler('previoustrack', () => prev());
    ms.setActionHandler('seekto', (d) => {
      if (audioRef.current && d.seekTime != null) audioRef.current.currentTime = d.seekTime;
    });
  }, [setPlaying, next, prev]);

  // fechar a aba não perde a escuta
  useEffect(() => {
    const onHide = () => report(loadedId.current, true);
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [report]);

  // atalhos: espaço e setas
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || !usePlayer.getState().queue.length) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowRight' && e.shiftKey) next();
      if (e.code === 'ArrowLeft' && e.shiftKey) prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, next, prev]);

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    const delta = a.currentTime - lastTime.current;
    if (delta > 0 && delta < 2 && !a.paused) listened.current += delta;
    lastTime.current = a.currentTime;
    setTime(a.currentTime);
    if (Number.isFinite(a.duration)) setDuration(a.duration);
  };

  const onEnded = () => {
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
    if (audioRef.current) {
      audioRef.current.currentTime = v;
      lastTime.current = v;
    }
  };

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

      <div className="pointer-events-none fixed bottom-28 right-4 z-50 flex flex-col items-end gap-2 md:bottom-24" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in rounded-full bg-mandacaru px-4 py-2 text-sm font-semibold text-noite">
            {t.text}
          </div>
        ))}
      </div>

      {track && (
        <div className="fixed inset-x-0 bottom-14 z-40 border-t border-palco bg-lona/95 backdrop-blur md:bottom-0">
          <input
            aria-label="Posição da música"
            type="range"
            min={0}
            max={duration || 0}
            step={0.5}
            value={Math.min(time, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            className="seek absolute -top-[7px] left-0 w-full md:hidden"
          />
          <div className="mx-auto flex h-20 max-w-[1400px] items-center gap-3 px-3 md:gap-6 md:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {track.cover ? (
                <img src={track.cover} alt="" className="h-12 w-12 shrink-0 rounded-[10px] object-cover" />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-[10px] bg-palco" />
              )}
              <div className="min-w-0">
                <Link href={`/${track.artistSlug}/${track.releaseSlug}`} className="block truncate font-semibold text-luar hover:underline">
                  {track.title}
                </Link>
                <Link href={`/${track.artistSlug}`} className="block truncate text-sm text-nevoa hover:text-luar">
                  {track.artistName}
                </Link>
              </div>
              <div className={`paredao ml-1 hidden sm:flex ${playing && !buffering ? 'is-on' : ''}`} aria-hidden>
                <span /><span /><span /><span /><span />
              </div>
            </div>

            <div className="flex flex-col items-center md:flex-[1.4]">
              <div className="flex items-center gap-1 md:gap-3">
                <button onClick={toggleShuffle} aria-pressed={shuffle} aria-label="Aleatório" className={`ctl hidden md:inline-flex ${shuffle ? 'text-sol' : ''}`}>
                  <ShuffleIcon className="h-[18px] w-[18px]" />
                </button>
                <button onClick={prev} aria-label="Anterior" className="ctl"><PrevIcon /></button>
                <button
                  onClick={toggle}
                  aria-label={playing ? 'Pausar' : 'Tocar'}
                  className="grid h-11 w-11 place-items-center rounded-full bg-sol text-noite transition-transform active:scale-95"
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button onClick={() => next()} aria-label="Próxima" className="ctl"><NextIcon /></button>
                <button onClick={cycleRepeat} aria-label={`Repetir: ${repeat}`} className={`ctl relative hidden md:inline-flex ${repeat !== 'off' ? 'text-sol' : ''}`}>
                  <RepeatIcon className="h-[18px] w-[18px]" />
                  {repeat === 'one' && <span className="absolute -right-0.5 -top-0.5 text-[10px] font-bold">1</span>}
                </button>
              </div>
              <div className="mt-1 hidden w-full max-w-[560px] items-center gap-2 text-xs tabular-nums text-nevoa md:flex">
                <span className="w-10 text-right">{formatDuration(time) || '0:00'}</span>
                <input
                  aria-label="Posição da música"
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.5}
                  value={Math.min(time, duration || 0)}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="seek flex-1"
                />
                <span className="w-10">{formatDuration(duration)}</span>
              </div>
            </div>

            <div className="hidden flex-1 items-center justify-end gap-3 md:flex">
              <button onClick={() => setShowQueue((v) => !v)} aria-label="Fila" aria-expanded={showQueue} className={`ctl ${showQueue ? 'text-sol' : ''}`}>
                <QueueIcon />
              </button>
              <VolumeIcon className="h-5 w-5 text-nevoa" />
              <input aria-label="Volume" type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="seek w-28" />
            </div>
          </div>

          {showQueue && (
            <div className="absolute bottom-full right-4 mb-2 max-h-[60vh] w-[360px] overflow-auto rounded-capa border border-palco bg-noite p-3">
              <p className="mb-2 px-2 font-display text-lg font-bold">Tocando a seguir</p>
              <ol>
                {queue.map((t, i) => (
                  <li key={`${t.id}-${i}`}>
                    <button
                      onClick={() => jump(i)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-lona ${i === index ? 'text-sol' : ''}`}
                    >
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
        </div>
      )}
    </>
  );
}
