import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { adMediaUrl } from '@/lib/media';
import { getSite } from '@/lib/site';

// Espaço de banner: 1) anúncio pago da rede; 2) banner da casa (faixa) do /admin; 3) convite padrão.
// Quem é Premium não vê nada.
export default async function AdBanner({ context, genre }: { context: string; genre?: string | null }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: p } = await supabase.from('profiles').select('premium_until').eq('id', user.id).maybeSingle();
    if (p?.premium_until && new Date(p.premium_until) > new Date()) return null;
  }
  const { data: ad } = await supabase.rpc('serve_ad', { p_kind: 'banner', p_anon: null, p_genre: genre || null, p_context: context });

  if (ad) {
    const img = adMediaUrl(ad.media_path);
    return (
      <aside className="mt-10" aria-label="Anúncio">
        <p className="mb-2 text-xs text-nevoa">Patrocinado por {ad.advertiser}</p>
        <a href={`/api/ads/click?c=${ad.id}`} target="_blank" rel="noopener sponsored" className="block overflow-hidden rounded-capa border border-palco hover:border-sol">
          {img && <img src={img} alt={ad.headline || `Anúncio de ${ad.advertiser}`} className="aspect-[4/1] w-full object-cover" />}
          {ad.headline && <span className="block bg-lona px-4 py-2 text-sm font-semibold">{ad.headline}</span>}
        </a>
      </aside>
    );
  }

  const { data: house } = await supabase.from('house_banners').select('id, title, subtitle, cta, image_path, link_url').eq('placement', 'faixa').eq('active', true).limit(10);
  const pick = (house || [])[Math.floor(Math.random() * (house || []).length)];
  if (pick) {
    const img = adMediaUrl(pick.image_path);
    const inner = img ? (
      <img src={img} alt={pick.title} className="aspect-[4/1] w-full object-cover" />
    ) : (
      <span className="flex flex-col gap-1 bg-sol px-6 py-5 text-noite sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="block font-display text-xl font-extrabold">{pick.title}</span>
          {pick.subtitle && <span className="block opacity-90">{pick.subtitle}</span>}
        </span>
        {pick.cta && <span className="mt-2 inline-flex h-10 w-max items-center rounded-full bg-noite px-5 font-semibold text-sol sm:mt-0">{pick.cta}</span>}
      </span>
    );
    return (
      <aside className="mt-10" aria-label="Destaque">
        {pick.link_url ? <a href={pick.link_url} className="block overflow-hidden rounded-capa">{inner}</a> : <div className="overflow-hidden rounded-capa">{inner}</div>}
      </aside>
    );
  }

  const { texts } = await getSite();
  return (
    <aside className="mt-10" aria-label="Espaço publicitário">
      <Link href="/anunciar" className="flex flex-col gap-1 rounded-capa border-2 border-dashed border-palco px-6 py-5 hover:border-sol sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="block font-display text-lg font-extrabold">{texts.ads_slot_title}</span>
          <span className="block text-sm text-nevoa">{texts.ads_slot_text}</span>
        </span>
        <span className="mt-2 inline-flex h-10 w-max items-center rounded-full bg-sol px-5 text-sm font-semibold text-noite sm:mt-0">Anunciar</span>
      </Link>
    </aside>
  );
}
