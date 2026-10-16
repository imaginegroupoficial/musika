'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// enquanto houver faixa convertendo, atualiza a página a cada 5 s
export default function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}
