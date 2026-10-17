import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import AccountForms from './forms';
import { readPrefs } from '@/lib/prefs';

export const metadata = { title: 'Minha conta' };
export const revalidate = 0;

export default async function Conta({ searchParams }: { searchParams: { email?: string } }) {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile) redirect('/entrar?voltar=/conta');
  return (
    <div className="max-w-2xl">
      <h1 className="titulo">Minha conta</h1>
      <nav className="scroll-row -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {[['perfil', 'Perfil'], ['notificacoes', 'Notificações'], ['reproducao', 'Reprodução'], ['acesso', 'E-mail e senha'], ['assinatura', 'Assinatura'], ['excluir', 'Excluir conta']].map(([id, l]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-palco px-4 py-1.5 text-sm font-semibold hover:border-sol">{l}</a>
        ))}
      </nav>
      {searchParams.email === 'ok' && <p className="mt-4 rounded-lg bg-mandacaru/15 px-4 py-3">E-mail confirmado.</p>}
      <AccountForms
        email={user.email || ''}
        pendingEmail={(user as { new_email?: string }).new_email || null}
        profile={{ username: profile.username, display_name: profile.display_name || '', city: profile.city || '', uf: profile.uf || '', bio: profile.bio || '', avatar_url: profile.avatar_url || null }}
        prefs={readPrefs(profile.prefs)}
        vapidKey={process.env.VAPID_PUBLIC_KEY || null}
        premiumUntil={profile.premium_until}
      />
    </div>
  );
}
