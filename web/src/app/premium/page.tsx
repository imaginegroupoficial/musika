import { getSessionProfile } from '@/lib/supabase/server';
import PixCheckout from '@/components/PixCheckout';
import { brl } from '@/lib/media';

export const metadata = { title: 'Musika Premium' };
export const revalidate = 0;

export default async function PremiumPage() {
  const { supabase, user, profile } = await getSessionProfile();
  const { data: rows } = await supabase.from('settings').select('key, value').in('key', ['premium_price_cents', 'premium_days']);
  const cfg = Object.fromEntries((rows || []).map((r) => [r.key, Number(r.value)]));
  const price = cfg.premium_price_cents || 990;
  const days = cfg.premium_days || 30;
  const until = profile?.premium_until ? new Date(profile.premium_until) : null;
  const active = until && until > new Date();

  const perks = [
    ['Sem anúncios', 'Nada de áudio entre as faixas nem banner na tela.'],
    ['Pontos em dobro', 'Cada faixa ouvida até o fim vale 2 pontos no ranking do seu artista.'],
    ['Selo Premium', 'Aparece no seu perfil e no ranking de fãs.'],
    ['Apoio direto', 'Parte do valor sustenta o espaço gratuito dos artistas independentes.'],
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-[clamp(2.75rem,8vw,5.5rem)] font-extrabold leading-[0.9] tracking-tight">
        Ouça sem parar.
      </h1>
      <p className="mt-5 max-w-[56ch] text-lg text-nevoa">
        O Musika é grátis para sempre. O Premium tira os anúncios e dobra seus pontos por {brl(price)} a cada {days} dias, pago no Pix. Sem renovação automática e sem fidelidade.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {perks.map(([t, d]) => (
          <li key={t} className="rounded-capa bg-lona p-5">
            <p className="font-display text-xl font-bold">{t}</p>
            <p className="mt-1 text-nevoa">{d}</p>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <PixCheckout
          purpose="premium"
          label={active ? `Renovar por mais ${days} dias` : `Assinar por ${brl(price)}`}
          amountCents={price}
          loggedIn={!!user}
          defaultName={profile?.display_name}
        />
        {active && <p className="text-sol">Seu Premium vale até {until!.toLocaleDateString('pt-BR')}. Renovar agora soma os dias.</p>}
      </div>
    </div>
  );
}
