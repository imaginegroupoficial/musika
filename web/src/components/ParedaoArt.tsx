// Ilustração do paredão: pilhas de caixas de som com luz vermelha de palco e a galera na frente.
// Desenhada em SVG para pesar quase nada e seguir a cor principal do tema.
const P = 'rgb(var(--c-primary))';

function Cabinet({ x, y, w, h, big }: { x: number; y: number; w: number; h: number; big?: boolean }) {
  const r = big ? Math.min(w, h) * 0.36 : Math.min(w / 2, h) * 0.34;
  const cones = big ? [[x + w / 2, y + h / 2]] : [[x + w * 0.27, y + h / 2], [x + w * 0.73, y + h / 2]];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="4" fill="#101016" stroke="#2A2A35" strokeWidth="2" />
      {cones.map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill="#07070A" stroke={P} strokeOpacity=".55" strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r={r * 0.62} fill="#14141B" stroke="#33333F" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r={r * 0.22} fill={P} fillOpacity=".75" />
        </g>
      ))}
    </g>
  );
}

export default function ParedaoArt({ className = '' }: { className?: string }) {
  const cols = [
    { x: 40, rows: [[60, 'big'], [60, 'big'], [52, ''], [52, '']] },
    { x: 150, rows: [[52, ''], [70, 'big'], [70, 'big'], [52, ''], [52, '']] },
    { x: 260, rows: [[52, ''], [52, ''], [70, 'big'], [70, 'big'], [52, ''], [52, '']] },
    { x: 370, rows: [[52, ''], [70, 'big'], [70, 'big'], [52, ''], [52, '']] },
    { x: 480, rows: [[60, 'big'], [60, 'big'], [52, ''], [52, '']] },
  ] as const;
  const floor = 400;
  return (
    <svg viewBox="0 0 600 460" className={className} aria-hidden preserveAspectRatio="xMidYMax slice">
      <defs>
        <radialGradient id="pp-glow" cx="50%" cy="38%" r="60%">
          <stop offset="0" stopColor={P} stopOpacity=".85" />
          <stop offset=".45" stopColor={P} stopOpacity=".28" />
          <stop offset="1" stopColor={P} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pp-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".55" stopColor="#0B0B0F" stopOpacity="0" />
          <stop offset="1" stopColor="#0B0B0F" stopOpacity=".95" />
        </linearGradient>
        <linearGradient id="pp-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P} stopOpacity=".5" />
          <stop offset="1" stopColor={P} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="600" height="460" fill="url(#pp-glow)" />
      <polygon points="120,0 160,0 300,400 250,400" fill="url(#pp-beam)" opacity=".35" />
      <polygon points="440,0 480,0 350,400 300,400" fill="url(#pp-beam)" opacity=".35" />
      {cols.map((c) => {
        let y = floor;
        return c.rows.map(([h, kind], i) => {
          y -= h + 4;
          return <Cabinet key={`${c.x}-${i}`} x={c.x} y={y} w={100} h={h} big={kind === 'big'} />;
        });
      })}
      {/* a galera */}
      <g fill="#050507">
        {Array.from({ length: 22 }).map((_, i) => {
          const x = i * 29 - 6 + (i % 3) * 4;
          const y = 412 + ((i * 7) % 3) * 8;
          return (
            <g key={i}>
              <circle cx={x + 14} cy={y} r="11" />
              <rect x={x} y={y + 8} width="28" height="60" rx="12" />
            </g>
          );
        })}
        <path d="M95 420 l-10 -46 6 -2 12 44z M342 412 l8 -50 6 1 -6 50z M520 418 l-12 -44 6 -2 14 42z" />
      </g>
      <rect width="600" height="460" fill="url(#pp-fade)" />
    </svg>
  );
}
