'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// abrir a página marca tudo como lido (as bolinhas continuam até a próxima visita)
export default function MarkRead() {
  useEffect(() => {
    createClient()
      .rpc('mark_notifications_read', { p_ids: null })
      .then(() => window.dispatchEvent(new Event('mk:notificacoes-lidas')));
  }, []);
  return null;
}
