'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';
import { BellIcon } from './Icons';

const announced = new Set<number>();

// Sino com contador de não lidas. Atualiza ao trocar de página e na hora em que chega notificação nova (Realtime).
export default function NotificationBell({ userId, initial, className = '' }: { userId: string; initial: number; className?: string }) {
  const [count, setCount] = useState(initial);
  const path = usePathname();
  const toast = usePlayer((s) => s.toast);

  useEffect(() => {
    if (path === '/notificacoes') return setCount(0);
    createClient()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
      .then(({ count: c }) => typeof c === 'number' && setCount(c));
  }, [path]);

  useEffect(() => {
    const zero = () => setCount(0);
    window.addEventListener('mk:notificacoes-lidas', zero);
    const supabase = createClient();
    const ch = supabase
      .channel(`notif-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (msg) => {
        const n = msg.new as { id: number; title: string; deliver_at: string };
        if (new Date(n.deliver_at).getTime() > Date.now() + 5000) return;
        setCount((c) => c + 1);
        // o sino aparece duas vezes (menu lateral e topo do celular): avisa uma vez só
        if (!announced.has(n.id)) { announced.add(n.id); toast(n.title); }
      })
      .subscribe();
    return () => {
      window.removeEventListener('mk:notificacoes-lidas', zero);
      supabase.removeChannel(ch);
    };
  }, [userId, toast]);

  return (
    <Link href="/notificacoes" aria-label={count ? `Notificações, ${count} novas` : 'Notificações'} className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-palco ${path === '/notificacoes' ? 'bg-luar text-noite hover:bg-luar' : ''} ${className}`}>
      <BellIcon className="h-[22px] w-[22px]" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[20px] rounded-full bg-chita px-1.5 text-center text-[11px] font-bold leading-5 text-white ring-2 ring-noite">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
