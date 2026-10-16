import { cache } from 'react';
import { createClient } from './supabase/server';
import { resolveTheme, type ThemeSetting } from './theme';
import { mergeTexts } from './texts';
import { adMediaUrl } from './media';

export type Brand = { name: string; logo_path: string | null };

// Lido uma vez por requisição: tema, textos e marca configurados no /admin
export const getSite = cache(async () => {
  const supabase = createClient();
  const { data } = await supabase.from('settings').select('key, value').in('key', ['theme', 'texts', 'brand', 'ad_every_n_tracks']);
  const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  const brand: Brand = { name: 'Musika', logo_path: null, ...((map.brand as Partial<Brand>) || {}) };
  return {
    theme: resolveTheme(map.theme as ThemeSetting),
    texts: mergeTexts(map.texts as Record<string, unknown>),
    brand,
    logoUrl: adMediaUrl(brand.logo_path),
    adEvery: Number(map.ad_every_n_tracks ?? 3),
  };
});
