'use client';
import { createContext, useContext } from 'react';
import { TEXTS, type TextKey, type Texts } from '@/lib/texts';

const Ctx = createContext<Texts | null>(null);

export function TextsProvider({ texts, children }: { texts: Texts; children: React.ReactNode }) {
  return <Ctx.Provider value={texts}>{children}</Ctx.Provider>;
}

export function useT() {
  const t = useContext(Ctx);
  return (k: TextKey) => t?.[k] ?? TEXTS[k].value;
}
