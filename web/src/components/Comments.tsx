import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDuration } from '@/lib/media';
import CommentForm from './CommentForm';
import { DeleteRow } from './studio/Forms';
import ReportButton from './ReportButton';

export default async function Comments({ releaseId, userId, canModerate, trackTitles }: { releaseId: string; userId: string | null; canModerate: boolean; trackTitles: Record<string, string> }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('comments')
    .select('id, body, at_second, track_id, created_at, user_id, profiles(username, display_name)')
    .eq('release_id', releaseId)
    .order('created_at', { ascending: false })
    .limit(100);
  type C = { id: string; body: string; at_second: number | null; track_id: string | null; created_at: string; user_id: string; profiles: { username: string; display_name: string | null } };
  const list = (data as unknown as C[]) || [];
  return (
    <section className="mt-12 max-w-3xl">
      <h2 className="mb-4 font-display text-2xl font-bold">Comentários{list.length ? ` (${list.length})` : ''}</h2>
      {userId ? <CommentForm releaseId={releaseId} trackIds={Object.keys(trackTitles)} /> : <p className="text-nevoa"><Link href="/entrar" className="font-semibold text-sol">Entre</Link> para comentar.</p>}
      <ul className="mt-6 space-y-4">
        {list.map((c) => (
          <li key={c.id} className="flex gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-palco font-display font-bold">{(c.profiles.display_name || c.profiles.username)[0].toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <Link href={`/perfil/${c.profiles.username}`} className="font-semibold hover:text-sol">{c.profiles.display_name || c.profiles.username}</Link>
                <span className="text-nevoa">
                  {c.track_id && trackTitles[c.track_id] ? ` em ${trackTitles[c.track_id]}` : ''}
                  {c.at_second != null ? ` aos ${formatDuration(c.at_second) || '0:00'}` : ''}
                </span>
              </p>
              <p className="mt-0.5 whitespace-pre-line">{c.body}</p>
              <div className="mt-1 flex gap-1">
                {(c.user_id === userId || canModerate) && <DeleteRow table="comments" id={c.id} label="Apagar" confirm="Apagar este comentário?" />}
                {userId && c.user_id !== userId && <ReportButton kind="comment" id={c.id} />}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
