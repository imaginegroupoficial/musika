import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';

export const metadata = { title: 'Studio do artista' };
export const revalidate = 0;

export default async function Studio() {
  const { supabase, user } = await getSessionProfile();
  if (!user) redirect('/entrar?voltar=/studio');
  const { data } = await supabase.from('artist_members').select('role, artists(id, slug, name, genre)').eq('user_id', user.id);
  const artists = ((data as unknown as { role: string; artists: { id: string; slug: string; name: string; genre: string | null } }[]) || []).filter((m) => m.artists);

  if (artists.length === 1) redirect(`/studio/${artists[0].artists.id}`);

  return (
    <>
      <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-6xl">Studio</h1>
      {artists.length === 0 ? (
        <div className="mt-6 max-w-xl">
          <p className="text-lg text-nevoa">
            Crie o perfil do seu artista ou banda para publicar CDs, ver quem ouve, de onde vem cada play e quem são seus maiores fãs.
          </p>
          <Link href="/studio/novo-artista" className="mt-8 inline-flex h-12 items-center rounded-full bg-sol px-6 font-semibold text-noite">
            Criar perfil de artista
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-8 max-w-xl divide-y divide-lona">
            {artists.map((m) => (
              <li key={m.artists.id}>
                <Link href={`/studio/${m.artists.id}`} className="flex items-center justify-between py-4 hover:text-sol">
                  <span className="font-display text-2xl font-bold">{m.artists.name}</span>
                  <span className="text-sm text-nevoa">{m.role === 'owner' ? 'dono' : m.role}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/studio/novo-artista" className="mt-6 inline-block font-semibold text-nevoa hover:text-luar">Criar outro perfil</Link>
        </>
      )}
    </>
  );
}
