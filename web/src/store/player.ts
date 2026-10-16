'use client';
import { create } from 'zustand';
import type { PlayerTrack } from '@/lib/types';

type Toast = { id: number; text: string };

type PlayerState = {
  queue: PlayerTrack[];
  index: number;
  playing: boolean;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  source: string | null;
  toasts: Toast[];
  ctl: { time: () => number; seek: (t: number) => void } | null;
  setCtl: (c: PlayerState['ctl']) => void;
  current: () => PlayerTrack | null;
  playQueue: (tracks: PlayerTrack[], start?: number, source?: string | null) => void;
  addNext: (track: PlayerTrack) => void;
  toggle: () => void;
  setPlaying: (v: boolean) => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  jump: (i: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toast: (text: string) => void;
};

let toastSeq = 0;

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  index: 0,
  playing: false,
  shuffle: false,
  repeat: 'off',
  source: null,
  toasts: [],
  ctl: null,
  setCtl: (c) => set({ ctl: c }),
  current: () => get().queue[get().index] ?? null,
  playQueue: (tracks, start = 0, source = null) => set({ queue: tracks, index: start, playing: true, source }),
  addNext: (track) =>
    set((s) => {
      if (!s.queue.length) return { queue: [track], index: 0, playing: true };
      const q = [...s.queue];
      q.splice(s.index + 1, 0, track);
      return { queue: q };
    }),
  toggle: () => set((s) => ({ playing: s.queue.length ? !s.playing : false })),
  setPlaying: (v) => set({ playing: v }),
  next: (auto = false) =>
    set((s) => {
      if (!s.queue.length) return {};
      if (auto && s.repeat === 'one') return { index: s.index, playing: true };
      if (s.shuffle && s.queue.length > 1) {
        let i = s.index;
        while (i === s.index) i = Math.floor(Math.random() * s.queue.length);
        return { index: i, playing: true };
      }
      if (s.index + 1 < s.queue.length) return { index: s.index + 1, playing: true };
      if (s.repeat === 'all') return { index: 0, playing: true };
      return { playing: false };
    }),
  prev: () => set((s) => ({ index: Math.max(0, s.index - 1), playing: true })),
  jump: (i) => set({ index: i, playing: true }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
  toast: (text) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
}));
