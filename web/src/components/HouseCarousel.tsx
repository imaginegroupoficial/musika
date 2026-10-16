'use client';
import { useEffect, useState } from 'react';

export type HouseBanner = { id: string; title: string; subtitle: string | null; cta: string | null; image_url: string | null; link_url: string | null };

// Carrossel de banners da casa no topo da página inicial (cadastrados no /admin)
export default function HouseCarousel({ banners }: { banners: HouseBanner[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (banners.length < 2 || paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length, paused]);
  if (!banners.length) return null;
  const b = banners[i];
  const Wrap = ({ children }: { children: React.ReactNode }) =>
    b.link_url ? <a href={b.link_url} className="block">{children}</a> : <div>{children}</div>;

  return (
    <section className="mb-10" aria-roledescription="carrossel" aria-label="Destaques" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-[22px]">
        <Wrap>
          {b.image_url ? (
            <div className="relative">
              <img src={b.image_url} alt={b.title} className="aspect-[4/3] w-full object-cover sm:aspect-[16/7] md:aspect-[16/5]" />
              {(b.subtitle || b.cta) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 text-white md:p-8">
                  <p className="font-display text-2xl font-extrabold md:text-4xl">{b.title}</p>
                  {b.subtitle && <p className="mt-1 max-w-[60ch] text-white/85">{b.subtitle}</p>}
                  {b.cta && <span className="mt-3 inline-flex h-10 items-center rounded-full bg-white px-5 font-semibold text-black">{b.cta}</span>}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[220px] flex-col justify-end bg-chita p-6 text-noite md:min-h-[260px] md:p-10">
              <p className="cartaz text-[clamp(2rem,6vw,4.5rem)]">{b.title}</p>
              {b.subtitle && <p className="mt-3 max-w-[56ch] text-lg font-medium">{b.subtitle}</p>}
              {b.cta && <span className="mt-5 inline-flex h-11 w-max items-center rounded-full bg-luar px-6 font-semibold text-noite">{b.cta}</span>}
            </div>
          )}
        </Wrap>
      </div>
      {banners.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {banners.map((x, n) => (
            <button key={x.id} onClick={() => setI(n)} aria-label={`Destaque ${n + 1}`} aria-current={n === i} className={`h-2 rounded-full transition-all ${n === i ? 'w-8 bg-sol' : 'w-2 bg-palco'}`} />
          ))}
        </div>
      )}
    </section>
  );
}
