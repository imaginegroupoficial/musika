'use client';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';

export default function ReportButton({ kind, id, label = 'Denunciar' }: { kind: 'release' | 'track' | 'comment' | 'artist' | 'campaign'; id: string; label?: string }) {
  const toast = usePlayer((s) => s.toast);
  const report = async () => {
    const reason = window.prompt('Conte o motivo da denúncia (ex.: música de outro artista, conteúdo ofensivo):');
    if (!reason || reason.trim().length < 3) return;
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('reports').insert({ user_id: u.user?.id, target_kind: kind, target_id: id, reason: reason.trim().slice(0, 1000) });
    toast(error ? 'Entre na sua conta para denunciar' : 'Denúncia enviada para a equipe do Paredão Play');
  };
  return <button onClick={report} className="h-9 rounded-full px-3 text-sm font-semibold text-nevoa hover:text-chita">{label}</button>;
}
