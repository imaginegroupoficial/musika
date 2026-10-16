import { createClient } from '@/lib/supabase/server';
import { DeleteRow, MissionForm, ToggleActive } from '@/components/studio/Forms';

export const revalidate = 0;
const kindLabel: Record<string, string> = { listen_release: 'Ouvir lançamento', listen_tracks: 'Ouvir faixas', share: 'Indicar amigos', checkin: 'Check-in em show' };

export default async function Missoes({ params }: { params: { artistId: string } }) {
  const supabase = createClient();
  const [{ data: missions }, { data: releases }, { data: events }] = await Promise.all([
    supabase.from('missions').select('*').eq('artist_id', params.artistId).order('created_at', { ascending: false }),
    supabase.from('releases').select('id, title').eq('artist_id', params.artistId).order('publish_at', { ascending: false }),
    supabase.from('events').select('id, title').eq('artist_id', params.artistId).gte('starts_at', new Date(Date.now() - 864e5).toISOString()).order('starts_at'),
  ]);
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Missões</h1>
      <p className="mt-2 max-w-[60ch] text-nevoa">Desafios que dão pontos aos seus fãs. Os pontos sobem o fã no seu ranking e podem ser trocados pelas suas recompensas.</p>
      <div className="mt-6"><MissionForm artistId={params.artistId} releases={releases || []} events={events || []} /></div>
      <ul className="mt-8 divide-y divide-lona">
        {(missions || []).map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${m.active ? '' : 'text-nevoa line-through'}`}>{m.title}</p>
              <p className="text-sm text-nevoa">{kindLabel[m.kind]}, meta {m.goal}, vale {m.points} pontos{m.ends_at ? `, até ${new Date(m.ends_at).toLocaleDateString('pt-BR')}` : ''}</p>
            </div>
            <ToggleActive table="missions" id={m.id} active={m.active} />
            <DeleteRow table="missions" id={m.id} />
          </li>
        ))}
      </ul>
    </>
  );
}
