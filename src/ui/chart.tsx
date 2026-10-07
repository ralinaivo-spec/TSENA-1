// Graphique en barres simple (une série, couleur de la marque) avec info-bulle au survol et vue tableau.
import { useEffect, useRef, useState } from 'react';

export interface Bar { key: string; label: string; long: string; value: number; extra?: string }

const short = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Md';
  if (a >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
  if (a >= 1e3) return Math.round(n / 1e3).toLocaleString('fr-FR') + ' k';
  return Math.round(n).toLocaleString('fr-FR');
};
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export function BarChart({ bars, format, title, height = 220 }: { bars: Bar[]; format: (n: number) => string; title: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600));
    ro.observe(el); setW(el.clientWidth || 600);
    return () => ro.disconnect();
  }, []);
  const left = 52, right = 8, top = 10, bottom = 26;
  // Graduations rondes (pas de 1, 2, 2,5 ou 5 × 10ⁿ) qui passent par zéro.
  const vmin = Math.min(0, ...bars.map((b) => b.value)), vmax = Math.max(0, ...bars.map((b) => b.value));
  const step = niceMax((vmax - vmin || 1) / 4);
  const lo = Math.floor(vmin / step) * step;
  const max = Math.max(lo + step, Math.ceil(vmax / step) * step);
  const ih = height - top - bottom, iw = Math.max(10, w - left - right);
  const y = (v: number) => top + ih - ((v - lo) / (max - lo)) * ih;
  const slot = iw / Math.max(1, bars.length);
  const bw = Math.max(2, Math.min(36, slot - 2));
  const ticks = Array.from({ length: Math.round((max - lo) / step) + 1 }, (_, i) => lo + i * step);
  const every = Math.ceil(bars.length / Math.max(1, Math.floor(iw / 46)));
  const h = hover != null ? bars[hover] : null;
  return (
    <div className="chart" ref={ref}>
      <svg width={w} height={height} role="img" aria-label={title}>
        {ticks.map((t) => <g key={t}><line x1={left} x2={w - right} y1={y(t)} y2={y(t)} className="chart-grid" /><text x={left - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">{short(t)}</text></g>)}
        <line x1={left} x2={w - right} y1={y(0)} y2={y(0)} className="chart-base" />
        {bars.map((b, i) => {
          const x = left + i * slot + (slot - bw) / 2;
          const y0 = y(0), y1 = y(b.value);
          const hgt = Math.abs(y0 - y1);
          const r = Math.min(4, bw / 2, hgt);
          const up = b.value >= 0;
          // Barre ancrée sur la ligne de base, coins arrondis seulement au bout.
          const d = !hgt ? '' : up
            ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0} Z`
            : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 - r} V${y0} Z`;
          return (
            <g key={b.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}>
              <rect x={left + i * slot} y={top} width={slot} height={ih} fill="transparent" />
              {d && <path d={d} className={`chart-bar ${b.value < 0 ? 'is-neg' : ''} ${hover === i ? 'is-hover' : ''}`} />}
              {i % every === 0 && <text x={left + i * slot + slot / 2} y={height - 8} textAnchor="middle" className="chart-axis">{b.label}</text>}
            </g>
          );
        })}
      </svg>
      {h && (
        <div className="chart-tip" style={{ left: Math.min(w - 170, Math.max(0, left + hover! * slot + slot / 2 - 85)) }}>
          <strong>{h.long}</strong><span className="num">{format(h.value)}</span>{h.extra && <span className="small muted">{h.extra}</span>}
        </div>
      )}
    </div>
  );
}
