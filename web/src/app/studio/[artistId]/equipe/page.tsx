import { getSessionProfile } from '@/lib/supabase/server';
import { InviteButton } from '@/components/studio/Forms';
import RpcButton from '@/components/RpcButton';

export const revalidate = 0;
const roleLabel: Record<string, string> = { owner: 'Dono', manager: 'Empresário', editor: 'Editor' };

export default async function Equipe({ params }: { params: { artistId: string } }) {
  const { supabase, user } = await getSessionProfile();
  const { data } = await supabase.from('artist_members').select('user_id, role, profiles(username, display_name)').eq('artist_id', params.artistId);
  type M = { user_id: string; role: string; profiles: { username: string; display_name: string | null } };
  const members = (data as unknown as M[]) || [];
  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  return (
    <>
      <h1 className="titulo-sm">Equipe</h1>
      <p className="mt-2 max-w-[60ch] text-nevoa">Chame empresário, social media e produtor para publicar e acompanhar o painel com você.</p>
      <ul className="mt-6 max-w-2xl divide-y divide-lona">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 py-3">
            <span className="min-w-0 flex-1 font-semibold">{m.profiles.display_name || m.profiles.username} <span className="font-normal text-nevoa">@{m.profiles.username}</span></span>
            <span className="text-sm text-nevoa">{roleLabel[m.role]}</span>
            {myRole === 'owner' && m.role !== 'owner' && (
              <RpcButton fn="remove_member" args={{ p_artist: params.artistId, p_user: m.user_id }} label="Remover" confirm="Remover da equipe?" done="Removido" className="h-9 rounded-full px-3 text-sm font-semibold text-nevoa hover:text-chita" />
            )}
          </li>
        ))}
      </ul>
      {(myRole === 'owner' || myRole === 'manager') && <div className="mt-8 max-w-2xl"><InviteButton artistId={params.artistId} /></div>}
    </>
  );
}
