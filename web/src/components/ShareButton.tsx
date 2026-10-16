'use client';
import { usePlayer } from '@/store/player';
import { ShareIcon } from './Icons';

export default function ShareButton({ path, title, username, storyHref }: { path: string; title: string; username?: string | null; storyHref?: string }) {
  const toast = usePlayer((s) => s.toast);
  const share = async () => {
    const url = new URL(path, window.location.origin);
    if (username) url.searchParams.set('ref', username);
    url.searchParams.set('utm_source', 'compartilhado');
    const text = `Escuta ${title} no Paredão Play`;
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
    <>
      <button onClick={share} className="inline-flex h-12 items-center gap-2 rounded-full border border-luar/40 px-5 font-semibold hover:border-luar">
        <ShareIcon className="h-[18px] w-[18px]" /> Compartilhar
      </button>
      {storyHref && (
        <a href={storyHref} download={`musika-${title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.png`} className="inline-flex h-12 items-center rounded-full px-4 font-semibold text-nevoa hover:text-luar">
          Card para story
        </a>
      )}
    </>
  );
}
