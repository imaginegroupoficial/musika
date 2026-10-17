'use client';
import { fill } from '@/lib/texts';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { qrDataUrl } from '@/components/studio/Forms';
import { useT } from '@/components/TextsProvider';

// Tela para projetar no telão do show. O código muda a cada 30 s, então print não vale.
export default function Telao() {
  const { eventId } = useParams<{ eventId: string }>();
  const [code, setCode] = useState<string | null>(null);
  const [host, setHost] = useState('');
  useEffect(() => setHost(window.location.host), []);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const t = useT();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data, error } = await createClient().rpc('event_checkin_code', { p_event: eventId });
      if (!alive) return;
      if (error || !data) return setError(true);
      setCode(data.code);
      setQr(await qrDataUrl(`${window.location.origin}/checkin/${eventId}?c=${data.code}`));
    };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [eventId]);

  if (error) return <p className="text-chita">Sem acesso a este show.</p>;
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="cartaz text-3xl md:text-6xl">{t('telao_title')}</p>
      {qr ? <img src={qr} alt="QR Code de check-in" className="mt-8 w-[min(70vw,460px)] rounded-3xl" /> : <div className="mt-8 h-[460px] w-[460px] max-w-[70vw] animate-pulse rounded-3xl bg-lona" />}
      <p className="mt-6 text-nevoa">{fill(t('telao_hint'), { site: host })}</p>
      <p className="font-display text-6xl font-extrabold tracking-[0.25em] text-sol md:text-8xl">{code || '······'}</p>
      <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="mt-8 h-11 rounded-full border border-palco px-5 text-sm font-semibold text-nevoa hover:border-sol hover:text-luar">Tela cheia</button>
    </div>
  );
}
