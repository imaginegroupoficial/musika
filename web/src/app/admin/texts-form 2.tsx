'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/store/player';
import { TEXTS, type TextKey } from '@/lib/texts';

export default function TextsForm({ overrides }: { overrides: Record<string, string> }) {
  const router = useRouter();
  const toast = usePlayer((s) => s.toast);
  const [vals, setVals] = useState<Record<string, string>>(overrides || {});
  const [busy, setBusy] = useState(false);
  const groups = Array.from(new Set(Object.values(TEXTS).map((t) => t.group)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const clean = Object.fromEntries(Object.entries(vals).filter(([k, v]) => v.trim() && v.trim() !== TEXTS[k as TextKey]?.value));
    const { error } = await createClient().rpc('admin_set_setting', { p_key: 'texts', p_value: clean });
    setBusy(false);
    toast(error ? 'Não foi possível salvar' : 'Textos salvos');
    if (!error) router.refresh();
  };

  return (
    <form onSubmit={save} className="max-w-3xl">
      <p className="mb-6 text-nevoa">Deixe em branco para usar o texto padrão. Onde aparecer {'{preco}'} ou {'{dias}'}, o site troca pelo valor certo.</p>
      {groups.map((g) => (
        <fieldset key={g} className="mb-10">
          <legend className="mb-4 font-display text-xl font-bold">{g}</legend>
          <div className="space-y-4">
            {(Object.keys(TEXTS) as TextKey[]).filter((k) => TEXTS[k].group === g).map((k) => {
              const def = TEXTS[k].value;
              const long = def.length > 70 || def.includes('\n');
              const changed = !!vals[k]?.trim() && vals[k] !== def;
              return (
                <label key={k} className="block">
                  <span className="mb-1 flex items-center justify-between text-sm font-medium">
                    {TEXTS[k].label}
                    {changed && <button type="button" onClick={() => setVals({ ...vals, [k]: '' })} className="text-xs font-semibold text-nevoa hover:text-luar">Voltar ao padrão</button>}
                  </span>
                  {long ? (
                    <textarea rows={def.includes('\n') ? 5 : 3} value={vals[k] ?? ''} placeholder={def} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} className="field" />
                  ) : (
                    <input value={vals[k] ?? ''} placeholder={def} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} className="field" />
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="sticky bottom-24 md:bottom-24">
        <button disabled={busy} className="h-12 rounded-full bg-sol px-8 font-semibold text-noite disabled:opacity-60">{busy ? 'Salvando…' : 'Salvar textos'}</button>
      </div>
    </form>
  );
}
