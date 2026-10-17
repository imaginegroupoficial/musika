import { MEDIA_URL, SUPABASE_URL } from './env';

// capa: caminho no bucket de capas, ou endereço completo (imagens enviadas pelo admin)
export const coverUrl = (path?: string | null) =>
  !path ? null : /^https?:\/\//.test(path) ? path : `${SUPABASE_URL}/storage/v1/object/public/covers/${path}`;

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

export const adMediaUrl = (path?: string | null) => (path ? `${SUPABASE_URL}/storage/v1/object/public/ads/${path}` : null);

export const brl = (cents: number) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// foto de perfil: aceita caminho no bucket avatars ou endereço completo
export const avatarUrl = (path?: string | null) =>
  !path ? null : /^https?:\/\//.test(path) ? path : `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) { const d = Math.floor(s / 86400); return `há ${d} ${d === 1 ? 'dia' : 'dias'}`; }
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
