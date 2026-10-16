'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';
import { formatDuration } from '@/lib/media';

export default function CommentForm({ releaseId, trackIds }: { releaseId: string; trackIds: string[] }) {
  const router = useRouter();
  const { queue, index, ctl } = usePlayer();
  const current = queue[index];
  const onThisRelease = current && trackIds.includes(current.id);
  const [body, setBody] = useState('');
  const [mark, setMark] = useState(true);
  const [busy, setBusy] = useState(false);
  const at = onThisRelease && ctl ? Math.floor(ctl.time()) : null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    const useMark = mark && onThisRelease;
    await supabase.from('comments').insert({
      release_id: releaseId,
      user_id: u.user?.id,
      body: body.trim(),
      track_id: useMark ? current!.id : null,
      at_second: useMark ? Math.floor(ctl?.time() || 0) : null,
    });
    setBusy(false);
    setBody('');
    router.refresh();
  };

  return (
    <form onSubmit={send}>
      <textarea required rows={2} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="O que achou desse CD?" className="field" aria-label="Comentário" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        {onThisRelease ? (
          <label className="flex items-center gap-2 text-sm text-nevoa">
            <input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} className="h-4 w-4 accent-[#FFC531]" />
            Marcar o momento: {current.title} aos {formatDuration(at) || '0:00'}
          </label>
        ) : <span />}
        <button disabled={busy || !body.trim()} className="h-10 rounded-full bg-sol px-5 text-sm font-semibold text-noite disabled:opacity-50">Comentar</button>
      </div>
    </form>
  );
}
