import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import { mapRelease, releaseSelect } from '@/lib/queries';
import ReleaseCard from '@/components/ReleaseCard';
import FollowButton from '@/components/FollowButton';
import { CheckBadge } from '@/components/Icons';
import { coverUrl, formatCount, levelInfo } from '@/lib/media';

type Props = { params: { artist: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { supabase } = await getSessionProfile();
  const { data } = await supabase.from('artists').select('name, genre, city, uf, bio').eq('slug', params.artist).maybeSingle();
  if (!data) return { title: 'Artista não encontrado' };
  return {
    title: data.name,
    description: data.bio || `Ouça e baixe os CDs de ${data.name}${data.genre ? `, ${data.genre}` : ''} no Musika.`,
  };
}

export default async function ArtistPage({ params }: Props) {
  const { supabase, user } = await getSessionProfile();
  const { data: artist } = await supabase.from('artists').select('*').eq('slug', params.artist).maybeSingle();
  if (!artist) notFound();

  const [releases, fans, followers, following, stats] = await Promise.all([
    supabase.from('releases').select(releaseSelect).eq('artist_id', artist.id).eq('status', 'ready').lte('publish_at', new Date().toISOString()).order('publish_at', { ascending: false }),
    supabase.rpc('top_fans', { p_artist: artist.id, p_limit: 10 }),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('artist_id', artist.id),
    user ? supabase.from('follows').select('artist_id').eq('artist_id', artist.id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('track_stats_daily').select('plays').eq('artist_id', artist.id),
  ]);
  const totalPlays = (stats.data || []).reduce((s, r) => s + (r.plays || 0), 0);
  const list = ((releases.data as never[]) || []).map(mapRelease);
  const avatar = coverUrl(artist.avatar_path);
  const topFans = (fans.data || []) as { user_id: string; username: string; display_name: string | null; xp: number }[];
  const myRank = user ? topFans.findIndex((f) => f.user_id === user.id) : -1;

  return (
    <>
      <header className="flex flex-col gap-6 md:flex-row md:items-end">
        {avatar ? (
          <img src={avatar} alt={artist.name} className="h-40 w-40 rounded-full object-cover md:h-52 md:w-52" />
        ) : (
          <div className="grid h-40 w-40 place-items-center rounded-full bg-chita font-display text-6xl font-extrabold text-noite md:h-52 md:w-52">
            {artist.name[0]}
          </div>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-nevoa">
            {artist.verified && <CheckBadge className="h-4 w-4 text-sol" />}
            {[artist.genre, artist.city && `${artist.city}${artist.uf ? `/${artist.uf}` : ''}`].filter(Boolean).join(', ')}
          </p>
          <h1 className="mt-1 font-display text-[clamp(2.75rem,9vw,7rem)] font-extrabold leading-[0.88] tracking-tight">{artist.name}</h1>
          <p className="mt-3 text-nevoa">
            {formatCount(totalPlays)} plays, {formatCount(followers.count || 0)} seguidores
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <FollowButton artistId={artist.id} initial={!!following.data} loggedIn={!!user} />
            {artist.booking_whatsapp && (
              <a
                href={`https://wa.me/${artist.booking_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Vi o ${artist.name} no Musika e quero contratar um show.`)}`}
                target="_blank"
                rel="noopener"
                className="inline-flex h-12 items-center rounded-full bg-mandacaru px-6 font-semibold text-noite"
              >
                Contratar show
              </a>
            )}
            {artist.instagram && (
              <a href={`https://instagram.com/${artist.instagram.replace('@', '')}`} target="_blank" rel="noopener" className="inline-flex h-12 items-center px-2 font-semibold text-nevoa hover:text-luar">
                Instagram
              </a>
            )}
          </div>
        </div>
      </header>

      {artist.bio && <p className="mt-8 max-w-[68ch] text-lg leading-relaxed text-nevoa">{artist.bio}</p>}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">Lançamentos</h2>
          {list.length ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
              {list.map((r) => <ReleaseCard key={r.id} r={r} />)}
            </div>
          ) : (
            <p className="text-nevoa">Nenhum lançamento publicado ainda.</p>
          )}
        </section>

        <aside className="self-start rounded-capa bg-lona p-5">
          <h2 className="font-display text-xl font-bold">Top fãs</h2>
          <p className="mt-1 text-sm text-nevoa">Quem mais ouve e divulga {artist.name}. Ouça até o fim e compartilhe para subir.</p>
          {topFans.length ? (
            <ol className="mt-4 space-y-2">
              {topFans.map((f, i) => (
                <li key={f.user_id}>
                  <Link href={`/perfil/${f.username}`} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-palco ${user?.id === f.user_id ? 'bg-palco' : ''}`}>
                    <span className={`w-6 text-right font-display text-lg font-extrabold ${i < 3 ? 'text-sol' : 'text-nevoa'}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.display_name || f.username}</span>
                      <span className="block text-xs text-nevoa">{levelInfo(f.xp).name}</span>
                    </span>
                    <span className="text-sm tabular-nums text-nevoa">{f.xp}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm">Ninguém no ranking ainda. O primeiro lugar está livre.</p>
          )}
          {user && myRank === -1 && topFans.length >= 10 && <p className="mt-4 text-sm text-sol">Você ainda não está no top 10.</p>}
        </aside>
      </div>
    </>
  );
}
