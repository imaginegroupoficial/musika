// Logo oficial do Paredão Play (arquivos em /public/brand). Se o admin enviar outra logo, ela tem prioridade.
const SIZES = { sm: 'h-8', md: 'h-10', lg: 'h-16 md:h-20', xl: 'h-28' } as const;

export function LogoMark({ className = 'h-9 w-auto' }: { className?: string }) {
  return <img src="/brand/marca.png" alt="" className={className} />;
}

export default function Logo({ name = 'Paredão Play', logoUrl, size = 'md', stacked = false }: { name?: string; logoUrl?: string | null; size?: keyof typeof SIZES; stacked?: boolean }) {
  const src = logoUrl || (stacked ? '/brand/logo.png' : '/brand/logo-horizontal.png');
  return <img src={src} alt={name} className={`${SIZES[size]} w-auto max-w-none select-none`} draggable={false} />;
}
