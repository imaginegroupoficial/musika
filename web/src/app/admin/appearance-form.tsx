'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';
import { PRESETS, type ThemeColors } from '@/lib/theme';

const labels: Record<keyof ThemeColors, string> = {
  bg: 'Fundo', surface: 'Cartões', line: 'Linhas', ink: 'Texto', muted: 'Texto suave', primary: 'Cor principal', accent: 'Destaque', success: 'Pontos e sucesso',
};

export default function AppearanceForm({ theme, brand, logoUrl }: { theme: { preset?: string; colors?: Partial<ThemeColors> }; brand: { name: string; logo_path: string | null }; logoUrl: string | null }) {
  const router = useRouter();
  const toast = usePlayer((s) => s.toast);
  const [preset, setPreset] = useState(theme.preset || 'play');
  const [custom, setCustom] = useState<Partial<ThemeColors>>(theme.colors || {});
  const [name, setName] = useState(brand.name);
  const [logo, setLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const colors: ThemeColors = { ...PRESETS[preset].colors, ...custom };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    let logo_path = removeLogo ? null : brand.logo_path;
    if (logo) {
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user!.id}/marca/logo-${Date.now()}.${logo.name.split('.').pop()?.toLowerCase() || 'png'}`;
      const up = await supabase.storage.from('ads').upload(path, logo, { contentType: logo.type });
      if (up.error) { setBusy(false); return toast('O logo não subiu. Use PNG, JPG ou WebP.'); }
      logo_path = path;
    }
    const r1 = await supabase.rpc('admin_set_setting', { p_key: 'theme', p_value: { preset, colors: custom } });
    const r2 = await supabase.rpc('admin_set_setting', { p_key: 'brand', p_value: { name: name.trim() || 'Paredão Play', logo_path } });
    setBusy(false);
    if (r1.error || r2.error) return toast('Não foi possível salvar');
    toast('Aparência salva');
    router.refresh();
  };

  return (
    <form onSubmit={save} className="max-w-3xl space-y-8">
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Tema</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(PRESETS).map(([k, p]) => (
            <button type="button" key={k} onClick={() => { setPreset(k); setCustom({}); }} className={`overflow-hidden rounded-capa border-2 text-left ${preset === k ? 'border-sol' : 'border-palco'}`}>
              <span className="flex h-16" style={{ background: p.colors.bg }}>
                <span className="m-3 w-12 rounded-md" style={{ background: p.colors.primary }} />
                <span className="my-3 w-6 rounded-md" style={{ background: p.colors.accent }} />
              </span>
              <span className="block px-3 py-2 text-sm font-semibold">{p.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl font-bold">Ajustar cores</h2>
        <p className="mb-3 text-sm text-nevoa">Parte do tema escolhido. Mexa só no que quiser mudar. Botões usam a cor de fundo como cor do texto, então mantenha contraste entre as duas.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(labels) as (keyof ThemeColors)[]).map((k) => (
            <label key={k} className="flex items-center gap-3 rounded-xl border border-palco bg-lona p-2">
              <input type="color" value={colors[k]} onChange={(e) => setCustom({ ...custom, [k]: e.target.value.toUpperCase() })} className="h-9 w-9 cursor-pointer rounded border-0 bg-transparent" />
              <span className="text-sm">{labels[k]}</span>
            </label>
          ))}
        </div>
        {Object.keys(custom).length > 0 && <button type="button" onClick={() => setCustom({})} className="mt-3 text-sm font-semibold text-nevoa hover:text-luar">Voltar às cores do tema</button>}
        <div className="mt-4 rounded-capa p-5" style={{ background: colors.bg, color: colors.ink }}>
          <p style={{ fontStretch: '125%', fontWeight: 900, textTransform: 'uppercase', fontSize: 28 }}>Prévia do tema</p>
          <p style={{ color: colors.muted }}>Texto suave para descrições.</p>
          <span className="mt-3 inline-block rounded-full px-5 py-2 font-semibold" style={{ background: colors.primary, color: colors.bg }}>Botão principal</span>{' '}
          <span className="mt-3 inline-block rounded-full px-4 py-2 font-semibold" style={{ background: colors.accent, color: colors.bg }}>Destaque</span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-medium">Nome da marca</span><input value={name} onChange={(e) => setName(e.target.value)} className="field" /></label>
        <div>
          <span className="mb-1 block text-sm font-medium">Logo (opcional, PNG com fundo transparente)</span>
          {logoUrl && !removeLogo && <img src={logoUrl} alt="Logo atual" className="mb-2 h-10 w-auto" />}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setLogo(e.target.files?.[0] || null)} className="block text-sm text-nevoa file:mr-3 file:rounded-full file:border-0 file:bg-palco file:px-4 file:py-2 file:font-semibold file:text-luar" />
          {brand.logo_path && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={removeLogo} onChange={(e) => setRemoveLogo(e.target.checked)} className="accent-sol" /> Remover logo e usar o nome</label>}
        </div>
      </section>

      <button disabled={busy} className="h-12 rounded-full bg-sol px-8 font-semibold text-noite disabled:opacity-60">{busy ? 'Salvando…' : 'Salvar aparência'}</button>
    </form>
  );
}
