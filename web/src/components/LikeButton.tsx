'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { HeartIcon } from './Icons';

export default function LikeButton({ trackId, initial, loggedIn }: { trackId: string; initial: boolean; loggedIn: boolean }) {
  const [liked, setLiked] = useState(initial);
  const router = useRouter();
  const click = async () => {
    if (!loggedIn) return router.push('/entrar');
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return router.push('/entrar');
    setLiked(!liked);
    const res = liked
      ? await supabase.from('likes').delete().eq('track_id', trackId).eq('user_id', data.user.id)
      : await supabase.from('likes').insert({ track_id: trackId, user_id: data.user.id });
    if (res.error) setLiked(liked);
  };
  return (
    <button onClick={click} aria-pressed={liked} aria-label={liked ? 'Remover das curtidas' : 'Curtir'} className={`ctl ${liked ? 'text-chita' : ''}`}>
      <HeartIcon className="h-[18px] w-[18px]" filled={liked} />
    </button>
  );
}
