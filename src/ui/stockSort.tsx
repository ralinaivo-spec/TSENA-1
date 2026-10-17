// Tri commun Stock / Articles : par défaut, l'argent immobilisé (stock × prix de revient) du plus grand au plus petit.
// Le choix est gardé sur l'appareil (même après fermeture) jusqu'à ce qu'on le change à la main ; les filtres
// (catégorie, recherche, état du stock) ne le modifient jamais.
import { getMeta, setMeta, useMeta } from '../lib/db';
import { SALES_DAYS } from '../lib/stockRank';
import { Button } from './kit';

export type SortKey = 'value' | 'qty' | 'slow' | 'new' | 'name';
export const SORT_LABEL: Record<SortKey, string> = {
  value: 'Valeur en stock (le plus d’argent d’abord)',
  qty: 'Quantité en stock (la plus grande d’abord)',
  slow: `Moins vendus (${SALES_DAYS} j)`,
  new: 'Plus récents',
  name: 'Nom (A → Z)',
};
const SHORT: Record<SortKey, string> = { value: 'Valeur en stock ↓', qty: 'Quantité en stock ↓', slow: 'Moins vendus ↑', new: 'Plus récents', name: 'Nom A → Z' };

/** Tri choisi (gardé sur l'appareil). Sans accès aux coûts, « Valeur » devient « Quantité ». */
export function useSortPref(screen: 'stock' | 'articles', showCost: boolean): [SortKey, (k: SortKey) => void, SortKey] {
  const def: SortKey = showCost ? 'value' : 'qty';
  const saved = useMeta<SortKey | null>(`sort.${screen}`, null);
  let cur = saved ?? def;
  if (cur === 'value' && !showCost) cur = 'qty';
  return [cur, (k) => { void setMeta(`sort.${screen}`, k === def ? null : k); }, def];
}
export const sortSaved = (screen: string) => getMeta<SortKey | null>(`sort.${screen}`, null);

export interface Sortable { value: number; qty: number; sold: number; createdAt?: string; name: string; code?: string }
export function compareBy(sort: SortKey) {
  return (a: Sortable, b: Sortable) => {
    const tie = (a.code ?? '').localeCompare(b.code ?? '', 'fr', { numeric: true });
    if (sort === 'value') return b.value - a.value || b.qty - a.qty || tie;
    if (sort === 'qty') return b.qty - a.qty || b.value - a.value || tie;
    if (sort === 'slow') return a.sold - b.sold || b.value - a.value || b.qty - a.qty || tie;
    if (sort === 'name') return a.name.localeCompare(b.name, 'fr') || tie;
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || tie;
  };
}

/** Liste « Trier par » + rappel du tri en cours + retour au tri par défaut. */
export function SortSelect({ value, onChange, def, showCost }: { value: SortKey; onChange: (k: SortKey) => void; def: SortKey; showCost: boolean }) {
  const keys = (Object.keys(SORT_LABEL) as SortKey[]).filter((k) => showCost || k !== 'value');
  return (
    <div className="sort-select row">
      <label className="field" style={{ flex: '0 1 340px' }}><span className="small muted">Trier par</span>
        <select aria-label="Trier par" value={value} onChange={(e) => onChange(e.target.value as SortKey)}>
          {keys.map((k) => <option key={k} value={k}>{SORT_LABEL[k]}{k === def ? ' — par défaut' : ''}</option>)}
        </select></label>
      <span className="small muted sort-now">Trié par : <strong>{SHORT[value]}</strong></span>
      {value !== def && <Button variant="quiet" className="btn-sm" onClick={() => onChange(def)}>Revenir au tri par défaut</Button>}
    </div>
  );
}
