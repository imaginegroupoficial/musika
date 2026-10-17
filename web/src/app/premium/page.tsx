import { getSessionProfile } from '@/lib/supabase/server';
import PixCheckout from '@/components/PixCheckout';
import { brl } from '@/lib/media';
import { getSite } from '@/lib/site';
import { fill } from '@/lib/texts';

export const metadata = { title: 'Paredão Play Premium' };
export const revalidate = 0;

export default async function PremiumPage() {
  const { supabase, user, profile } = await getSessionProfile();
  const { texts: t } = await getSite();
  const { data: rows } = await supabase.from('settings').select('key, value').in('key', ['premium_price_cents', 'premium_days']);
  const cfg = Object.fromEntries((rows || []).map((r) => [r.key, Number(r.value)]));
  const price = cfg.premium_price_cents || 990;
  const days = cfg.premium_days || 30;
  const until = profile?.premium_until ? new Date(profile.premium_until) : null;
  const active = until && until > new Date();

  const perks = t.premium_perks.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]);

  return (
    <div className="max-w-3xl">
      <h1 className="titulo-xl">{t.premium_title}</h1>
      <p className="mt-5 max-w-[56ch] text-lg text-nevoa">
        {fill(t.premium_intro, { preco: brl(price), dias: days })}
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {perks.map(([title, d]) => (
          <li key={title} className="rounded-capa border border-palco bg-lona p-5">
            <p className="font-display text-xl font-bold">{title}</p>
            {d && <p className="mt-1 text-nevoa">{d}</p>}
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
