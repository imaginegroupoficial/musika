'use client';
import { usePlayer } from '@/store/player';
import { ShareIcon } from './Icons';

export default function ShareButton({ path, title, username }: { path: string; title: string; username?: string | null }) {
  const toast = usePlayer((s) => s.toast);
  const share = async () => {
    const url = new URL(path, window.location.origin);
    if (username) url.searchParams.set('ref', username);
    url.searchParams.set('utm_source', 'compartilhado');
    const text = `Escuta ${title} no Musika`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: url.toString() });
        return;
      }
      await navigator.clipboard.writeText(url.toString());
      toast(username ? 'Link copiado. Você ganha pontos por quem ouvir.' : 'Link copiado');
    } catch {}
  };
  return (
    <button onClick={share} className="inline-flex h-12 items-center gap-2 rounded-full border border-luar/40 px-5 font-semibold hover:border-luar">
      <ShareIcon className="h-[18px] w-[18px]" /> Compartilhar
    </button>
  );
}
