'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';

type State = 'carregando' | 'sem-suporte' | 'ios' | 'bloqueado' | 'desligado' | 'ligado' | 'sem-chave';

function keyBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Liga e desliga as notificações deste aparelho (celular ou computador)
export default function PushToggle({ vapidKey, compact = false }: { vapidKey: string | null; compact?: boolean }) {
  const [state, setState] = useState<State>('carregando');
  const [busy, setBusy] = useState(false);
  const toast = usePlayer((s) => s.toast);

  useEffect(() => {
    (async () => {
      if (!vapidKey) return setState('sem-chave');
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState(ios && !standalone ? 'ios' : 'sem-suporte');
      if (Notification.permission === 'denied') return setState('bloqueado');
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'ligado' : 'desligado');
    })().catch(() => setState('sem-suporte'));
  }, [vapidKey]);

  const ligar = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'bloqueado' : 'desligado'); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey!) });
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: j.endpoint, user_id: u.user!.id, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) });
      if (error) throw error;
      setState('ligado');
      toast('Pronto: você vai receber os avisos neste aparelho');
    } catch {
      toast('Não foi possível ativar neste navegador');
    } finally {
      setBusy(false);
    }
  };

  const desligar = async () => {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await createClient().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    setState('desligado');
    setBusy(false);
  };

  if (state === 'carregando' || state === 'sem-chave') return null;
  if (compact && state !== 'desligado') return null;

  const msg: Record<string, string> = {
    'sem-suporte': 'Este navegador não recebe notificações. No celular, use o Chrome (Android) ou instale o Paredão Play na tela inicial (iPhone).',
    ios: 'No iPhone, toque em Compartilhar e depois em "Adicionar à Tela de Início". Abra o Paredão Play por lá e ative os avisos.',
    bloqueado: 'As notificações estão bloqueadas para o Paredão Play. Libere nas configurações do navegador (cadeado ao lado do endereço) e volte aqui.',
  };

  return (
    <div className={compact ? 'flex flex-wrap items-center justify-between gap-4 rounded-capa bg-sol p-5 text-noite' : 'flex flex-wrap items-center justify-between gap-4'}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{state === 'ligado' ? 'Avisos ativos neste aparelho' : 'Receber avisos neste aparelho'}</p>
        <p className={`text-sm ${compact ? 'opacity-80' : 'text-nevoa'}`}>
          {msg[state] || 'Saiba na hora quando um artista que você segue lançar música ou marcar show, mesmo com o site fechado.'}
        </p>
      </div>
      {state === 'desligado' && (
        <button onClick={ligar} disabled={busy} className={`h-11 shrink-0 rounded-full px-5 font-semibold disabled:opacity-60 ${compact ? 'bg-noite text-sol' : 'bg-sol text-noite'}`}>
          {busy ? 'Ativando…' : 'Ativar avisos'}
        </button>
      )}
      {state === 'ligado' && (
        <button onClick={desligar} disabled={busy} className="h-11 shrink-0 rounded-full border border-luar/40 px-5 font-semibold disabled:opacity-60">
          Desativar
        </button>
      )}
    </div>
  );
}
