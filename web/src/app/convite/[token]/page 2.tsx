'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Convite() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const accept = async () => {
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.push(`/entrar?voltar=/convite/${token}`);
    const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
    if (error) return setError('Convite inválido ou expirado. Peça um link novo ao dono do perfil.');
    router.push(`/studio/${data}`);
    router.refresh();
  };
  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="font-display text-5xl font-extrabold leading-[0.95]">Você foi chamado para a equipe.</h1>
      <p className="mt-4 text-nevoa">Aceite para publicar lançamentos e ver o painel do artista no Studio.</p>
      {error && <p className="mt-6 rounded-lg bg-chita/15 px-3 py-2" role="alert">{error}</p>}
      <button onClick={accept} className="mt-8 h-12 rounded-full bg-sol px-8 font-semibold text-noite">Aceitar convite</button>
    </div>
  );
}
