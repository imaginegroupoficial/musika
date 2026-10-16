import { createClient } from '@/lib/supabase/server';
import { adMediaUrl } from '@/lib/media';

// Banner da rede própria. Quem é Premium não recebe nada (o banco decide).
export default async function AdBanner({ context, genre }: { context: string; genre?: string | null }) {
  const supabase = createClient();
  const { data: ad } = await supabase.rpc('serve_ad', { p_kind: 'banner', p_anon: null, p_genre: genre || null, p_context: context });
  if (!ad) return null;
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
