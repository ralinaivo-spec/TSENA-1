// Sélecteur de période réutilisé par tous les tableaux de bord et rapports.
export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'year' | '7d' | '30d' | 'all' | 'custom';
export interface Period { key: PeriodKey; from?: string; to?: string } // dates AAAA-MM-JJ incluses

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function rangeOf(key: PeriodKey): { from?: string; to?: string } {
  const now = new Date();
  const d = (y: number, m: number, day: number) => ymd(new Date(y, m, day));
  const y = now.getFullYear(), m = now.getMonth(), day = now.getDate();
  switch (key) {
    case 'today': return { from: ymd(now), to: ymd(now) };
    case 'yesterday': return { from: d(y, m, day - 1), to: d(y, m, day - 1) };
    case 'week': { const dow = (now.getDay() + 6) % 7; return { from: d(y, m, day - dow), to: ymd(now) }; }
    case 'month': return { from: d(y, m, 1), to: ymd(now) };
    case 'year': return { from: d(y, 0, 1), to: ymd(now) };
    case '7d': return { from: d(y, m, day - 6), to: ymd(now) };
    case '30d': return { from: d(y, m, day - 29), to: ymd(now) };
    default: return {};
  }
}
export function defaultPeriod(key: PeriodKey): Period { return { key, ...rangeOf(key) }; }

/** Vrai si la date ISO tombe dans la période (en heure locale). */
export function inPeriod(iso: string | undefined, p: Period) {
  if (!iso) return false;
  if (p.key === 'all') return true;
  const local = ymd(new Date(iso));
  return (!p.from || local >= p.from) && (!p.to || local <= p.to);
}

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'yesterday', label: 'Hier' },
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'year', label: 'Cette année' },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: 'all', label: 'Tout' },
  { key: 'custom', label: 'Dates…' },
];

/** Période précédente / suivante de même longueur (jour, semaine, mois, année ou dates libres). */
export function shiftPeriod(p: Period, dir: -1 | 1): Period {
  const r = p.from ? { from: p.from, to: p.to ?? ymd(new Date()) } : rangeOf(p.key);
  if (!r.from || !r.to) return p;
  const d = (s: string) => new Date(`${s}T12:00:00`);
  if (p.key === 'month' || (p.from?.endsWith('-01') && d(r.to).getDate() === new Date(d(r.to).getFullYear(), d(r.to).getMonth() + 1, 0).getDate() && r.from.slice(0, 7) === r.to.slice(0, 7))) {
    const f = d(r.from); f.setMonth(f.getMonth() + dir); const l = new Date(f.getFullYear(), f.getMonth() + 1, 0);
    return { key: 'custom', from: ymd(f), to: ymd(l) };
  }
  if (p.key === 'year') { const y = Number(r.from.slice(0, 4)) + dir; return { key: 'custom', from: `${y}-01-01`, to: `${y}-12-31` }; }
  const len = p.key === 'week' ? 7 : Math.round((d(r.to).getTime() - d(r.from).getTime()) / 86400_000) + 1;
  const f = d(r.from); f.setDate(f.getDate() + len * dir); const t = new Date(f); t.setDate(f.getDate() + len - 1);
  return { key: 'custom', from: ymd(f), to: ymd(t) };
}

/** Période : une seule liste déroulante (compacte sur téléphone), et les deux dates si « Dates… ». */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="period-picker">
      <div className="field">
        <label htmlFor="p-key">Période</label>
        <select id="p-key" aria-label="Période" value={value.key} onChange={(e) => { const k = e.target.value as PeriodKey; onChange(k === 'custom' ? { key: 'custom', from: value.from ?? ymd(new Date()), to: value.to ?? ymd(new Date()) } : defaultPeriod(k)); }}>
          {OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
      <div className="period-arrows">
        <button type="button" className="icon-btn" aria-label="Période précédente" onClick={() => onChange(shiftPeriod(value, -1))}>‹</button>
        <button type="button" className="icon-btn" aria-label="Période suivante" disabled={!!value.to && value.to >= ymd(new Date())} onClick={() => onChange(shiftPeriod(value, 1))}>›</button>
      </div>
      {value.key === 'custom' && <>
        <div className="field"><label htmlFor="p-from">Du</label><input id="p-from" type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} /></div>
        <div className="field"><label htmlFor="p-to">Au</label><input id="p-to" type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} /></div>
      </>}
    </div>
  );
}
