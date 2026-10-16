'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function FollowButton({ artistId, initial, loggedIn }: { artistId: string; initial: boolean; loggedIn: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const click = async () => {
    if (!loggedIn) return router.push('/entrar');
    setBusy(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return router.push('/entrar');
    const res = following
      ? await supabase.from('follows').delete().eq('artist_id', artistId).eq('user_id', data.user.id)
      : await supabase.from('follows').insert({ artist_id: artistId, user_id: data.user.id });
    if (!res.error) setFollowing(!following);
    setBusy(false);
    router.refresh();
  };
  return (
    <button
      onClick={click}
      disabled={busy}
      className={`h-12 rounded-full border px-6 font-semibold ${following ? 'border-palco bg-palco text-luar' : 'border-luar/40 text-luar hover:border-luar'}`}
    >
      {following ? 'Seguindo' : 'Seguir'}
    </button>
  );
}
