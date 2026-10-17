import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { DeleteRow, EventForm } from '@/components/studio/Forms';

export const revalidate = 0;

export default async function Agenda({ params }: { params: { artistId: string } }) {
  const supabase = createClient();
  const { data: events } = await supabase.from('events').select('id, title, venue, city, uf, starts_at, ticket_url').eq('artist_id', params.artistId).order('starts_at', { ascending: false }).limit(50);
  const { data: checks } = await supabase.from('checkins').select('event_id');
  const count = new Map<string, number>();
  (checks || []).forEach((c) => count.set(c.event_id, (count.get(c.event_id) || 0) + 1));
  return (
    <>
      <h1 className="titulo-sm">Agenda de shows</h1>
      <p className="mt-2 max-w-[60ch] text-nevoa">Os shows aparecem na sua página. No dia, abra o telão: o fã escaneia o QR, faz check-in e ganha 50 pontos com você.</p>
      <div className="mt-6"><EventForm artistId={params.artistId} /></div>
      <ul className="mt-8 divide-y divide-lona">
        {(events || []).map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{e.title}</p>
              <p className="text-sm text-nevoa">{new Date(e.starts_at).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bahia' })}{e.city ? `, ${e.city}` : ''}, {count.get(e.id) || 0} check-ins</p>
            </div>
            <Link href={`/studio/${params.artistId}/agenda/${e.id}/telao`} className="h-9 rounded-full bg-sol px-4 pt-1.5 text-sm font-semibold text-noite">Abrir telão</Link>
            <DeleteRow table="events" id={e.id} confirm="Excluir este show?" />
          </li>
        ))}
      </ul>
    </>
  );
}
