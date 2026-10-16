import { MEDIA_URL, SUPABASE_URL } from './env';

export const coverUrl = (path?: string | null) =>
  path ? `${SUPABASE_URL}/storage/v1/object/public/covers/${path}` : null;

export const hlsUrl = (path?: string | null) => (path ? `${MEDIA_URL}/hls/${path}` : null);

export function formatDuration(sec?: number | null) {
  if (!sec || !Number.isFinite(Number(sec))) return '';
  const s = Math.round(Number(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export function formatCount(n?: number | null) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',')} mi`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace('.0', '').replace('.', ',')} mil`;
  return String(v);
}

export function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

export const kindLabel: Record<string, string> = { cd: 'CD', single: 'Single', ao_vivo: 'Ao vivo' };

export function levelInfo(xp: number) {
  if (xp >= 1500) return { level: 5, name: 'Lenda', floor: 1500, next: null as number | null };
  if (xp >= 600) return { level: 4, name: 'Paredão', floor: 600, next: 1500 };
  if (xp >= 200) return { level: 3, name: 'Fã de Carteirinha', floor: 200, next: 600 };
  if (xp >= 50) return { level: 2, name: 'Fã', floor: 50, next: 200 };
  return { level: 1, name: 'Ouvinte', floor: 0, next: 50 };
}
