// Tableau triable (clic sur l'en-tête) avec ligne de total et export Excel.
import { useMemo, useState, type ReactNode } from 'react';
import { downloadBlob, writeXlsx, type Cell } from '../lib/xlsx';
import { Button } from './kit';

export interface Col<T> {
  key: string;
  label: string;
  value: (r: T) => number | string;          // valeur pour le tri et l'export
  render?: (r: T) => ReactNode;               // affichage (sinon la valeur)
  num?: boolean;                              // nombre aligné à droite
  money?: boolean;                            // montant en Ariary
  total?: boolean | ((rows: T[]) => number | string);
  hide?: boolean;
  width?: number;                             // largeur Excel
}

const fmt = (v: number | string, money?: boolean) => (typeof v === 'number' ? (money ? Math.round(v).toLocaleString('fr-FR') + ' Ar' : v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })) : v);

export function SortTable<T>({ cols, rows, empty = 'Aucune donnée sur la période', initialSort, limit, rowKey }: { cols: Col<T>[]; rows: T[]; empty?: string; initialSort?: { key: string; desc?: boolean }; limit?: number; rowKey: (r: T) => string }) {
  const shown = cols.filter((c) => !c.hide);
  const [sort, setSort] = useState(initialSort ?? { key: '', desc: true });
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    const c = shown.find((x) => x.key === sort.key);
    if (!c) return rows;
    return [...rows].sort((a, b) => {
      const va = c.value(a), vb = c.value(b);
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr', { numeric: true });
      return sort.desc ? -r : r;
    });
  }, [rows, sort, cols]);
  const visible = limit && !all ? sorted.slice(0, limit) : sorted;
  const hasTotal = shown.some((c) => c.total);
  if (!rows.length) return <p className="card-pad small muted">{empty}</p>;
  return (
    <>
      <div className="table-wrap">
        <table className="table table-report">
          <thead><tr>{shown.map((c) => (
            <th key={c.key} className={`th-sort ${c.num || c.money ? 't-num' : ''}`} onClick={() => setSort({ key: c.key, desc: sort.key === c.key ? !sort.desc : true })} aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
              {c.label}{sort.key === c.key ? (sort.desc ? ' ▾' : ' ▴') : ''}
            </th>
          ))}</tr></thead>
          <tbody>
            {visible.map((r) => <tr key={rowKey(r)}>{shown.map((c) => <td key={c.key} className={c.num || c.money ? 't-num' : ''}>{c.render ? c.render(r) : fmt(c.value(r), c.money)}</td>)}</tr>)}
            {hasTotal && (
              <tr className="t-total">{shown.map((c, i) => (
                <td key={c.key} className={c.num || c.money ? 't-num' : ''}>{i === 0 && !c.total ? `Total (${rows.length})` : c.total ? fmt(typeof c.total === 'function' ? c.total(rows) : rows.reduce((t, r) => t + (Number(c.value(r)) || 0), 0), c.money) : ''}</td>
              ))}</tr>
            )}
          </tbody>
        </table>
      </div>
      {limit && rows.length > limit && <div className="card-pad"><Button variant="quiet" onClick={() => setAll(!all)}>{all ? 'Afficher moins' : `Afficher tout (${rows.length})`}</Button></div>}
    </>
  );
}

/** Exporte un ou plusieurs tableaux dans un fichier Excel. */
export async function exportTables(filename: string, sheets: { name: string; cols: Col<any>[]; rows: any[]; notes?: string[] }[]) {
  const blob = await writeXlsx(sheets.map((s) => {
    const cols = s.cols.filter((c) => !c.hide);
    return {
      name: s.name,
      columns: cols.map((c) => ({ header: c.label + (c.money ? ' (Ar)' : ''), width: c.width ?? (c.num || c.money ? 14 : 24), number: c.num || c.money })),
      rows: s.rows.map((r) => cols.map((c) => { const v = c.value(r); return (typeof v === 'number' ? Math.round(v * 100) / 100 : v) as Cell; })),
      notes: s.notes,
    };
  }));
  downloadBlob(blob, filename);
}
