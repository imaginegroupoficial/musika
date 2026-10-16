import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import AccountForms from './forms';

export const metadata = { title: 'Minha conta' };
export const revalidate = 0;

export default async function Conta({ searchParams }: { searchParams: { email?: string } }) {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile) redirect('/entrar?voltar=/conta');
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Minha conta</h1>
      {searchParams.email === 'ok' && <p className="mt-4 rounded-lg bg-mandacaru/15 px-4 py-3">E-mail confirmado.</p>}
      <AccountForms
        email={user.email || ''}
        pendingEmail={(user as { new_email?: string }).new_email || null}
        profile={{ username: profile.username, display_name: profile.display_name || '', city: profile.city || '', uf: profile.uf || '' }}
        premiumUntil={profile.premium_until}
      />
    </div>
  );
}
