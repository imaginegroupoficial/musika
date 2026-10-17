// Tokens de cor do Musika. Os nomes antigos das classes (noite, lona, sol...) continuam valendo:
// noite = fundo, lona = superfície, palco = linha, luar = texto, nevoa = texto suave,
// sol = cor principal, chita = destaque, mandacaru = sucesso/pontos.
export type ThemeColors = { bg: string; surface: string; line: string; ink: string; muted: string; primary: string; accent: string; success: string };
export type ThemeSetting = { preset?: string; colors?: Partial<ThemeColors> };

export const PRESETS: Record<string, { label: string; dark: boolean; colors: ThemeColors }> = {
  cartaz: {
    label: 'Cartaz (claro)',
    dark: false,
    colors: { bg: '#F1F0F6', surface: '#FFFFFF', line: '#E2E0EC', ink: '#15112B', muted: '#5F5A7D', primary: '#3B2BFF', accent: '#FF4A8B', success: '#0E9F6E' },
  },
  noite: {
    label: 'Noite de São João (escuro)',
    dark: true,
    colors: { bg: '#1A1240', surface: '#241A57', line: '#30237A', ink: '#F3EEFF', muted: '#B9AEE0', primary: '#FFC531', accent: '#E8336D', success: '#2BB673' },
  },
  paredao: {
    label: 'Paredão (escuro, verde)',
    dark: true,
    colors: { bg: '#0D1B17', surface: '#14271F', line: '#21392F', ink: '#EEF8F2', muted: '#9DB8AB', primary: '#C8F23D', accent: '#FF6A3D', success: '#3DD68C' },
  },
};

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).split(' ').map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function resolveTheme(setting: ThemeSetting | null | undefined) {
  const preset = PRESETS[setting?.preset || 'cartaz'] || PRESETS.cartaz;
  const colors: ThemeColors = { ...preset.colors };
  for (const [k, v] of Object.entries(setting?.colors || {})) {
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) colors[k as keyof ThemeColors] = v;
  }
  const dark = luminance(colors.bg) < 0.2;
  const css = `:root{${(Object.keys(colors) as (keyof ThemeColors)[]).map((k) => `--c-${k}:${hexToRgb(colors[k])};`).join('')}color-scheme:${dark ? 'dark' : 'light'};}`;
  return { colors, dark, css };
}
