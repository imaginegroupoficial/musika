import { notFound, redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import StudioTabs from '@/components/studio/StudioTabs';

export default async function StudioArtistLayout({ children, params }: { children: React.ReactNode; params: { artistId: string } }) {
  const { supabase, user } = await getSessionProfile();
  if (!user) redirect('/entrar?voltar=/studio');
  const { data: member } = await supabase.from('artist_members').select('role, artists(name, slug)').eq('artist_id', params.artistId).eq('user_id', user.id).maybeSingle();
  if (!member) notFound();
  return (
    <>
      <StudioTabs artistId={params.artistId} />
      {children}
    </>
  );
}
