import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import CheckinRunner from './runner';

export const metadata = { title: 'Check-in no show' };

export default async function Checkin({ params, searchParams }: { params: { id: string }; searchParams: { c?: string } }) {
  const { supabase, user } = await getSessionProfile();
  const { data: e } = await supabase.from('events').select('id, title, city, starts_at, artists(name, slug)').eq('id', params.id).maybeSingle();
  if (!e) notFound();
  const artist = (e as unknown as { artists: { name: string; slug: string } }).artists;
  const back = `/checkin/${e.id}?c=${encodeURIComponent(searchParams.c || '')}`;
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <p className="text-nevoa">{artist.name}</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold leading-tight">{e.title}</h1>
      {user ? (
        <CheckinRunner eventId={e.id} code={searchParams.c || ''} artistSlug={artist.slug} />
      ) : (
        <>
          <p className="mt-6 text-lg">Entre na sua conta para garantir os 50 pontos deste show.</p>
          <Link href={`/entrar?voltar=${encodeURIComponent(back)}`} className="mt-6 inline-flex h-12 items-center rounded-full bg-sol px-8 font-semibold text-noite">Entrar e fazer check-in</Link>
        </>
      )}
    </div>
  );
}
