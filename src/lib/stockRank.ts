// Analyse du stock pour décider (promotion, arrêt d'achat) et choisir les publicités :
// valeur en stock (prix de revient), ventes des 30 derniers jours, durée pour écouler le stock, marque Dormant / À booster / OK.
import { all, get } from './db';
import { salesLedger } from './analytics';
import { rootOf } from './scope';
import { addDays, today } from './money';
import { stockOf, type Category, type Product, type Variant } from './catalog';
import { activeBoosts } from './boosts';

export const SALES_DAYS = 30;
/** Au-delà de ce nombre de jours pour écouler le stock au rythme actuel : « À booster ». */
export const BOOST_DAYS = 60;

export type Health = 'dormant' | 'boost' | 'ok';
export const HEALTH: Record<Health, { label: string; tone: 'danger' | 'warn' | 'ok'; hint: string }> = {
  dormant: { label: 'Dormant', tone: 'danger', hint: `En stock mais aucune vente depuis ${SALES_DAYS} jours : promotion, ou ne plus en racheter` },
  boost: { label: 'À booster', tone: 'warn', hint: `Se vend lentement : plus de ${BOOST_DAYS} jours pour écouler le stock au rythme actuel` },
  ok: { label: 'Rotation OK', tone: 'ok', hint: 'Se vend bien' },
};

/** Pièces vendues par variante sur les 30 derniers jours (retours déduits). */
export function soldByVariant(days = SALES_DAYS): Map<string, number> {
  const t = today();
  const m = new Map<string, number>();
  for (const l of salesLedger(addDays(t, -(days - 1)), t)) { if (!l.variantId) continue; m.set(l.variantId, (m.get(l.variantId) ?? 0) + l.qty); }
  for (const [k, v] of m) if (v < 0) m.set(k, 0);
  return m;
}

/** Jours pour écouler le stock au rythme des 30 derniers jours (Infinity si aucune vente). */
export function coverDays(stock: number, sold: number, days = SALES_DAYS) { return stock <= 0 ? 0 : sold <= 0 ? Infinity : Math.round(stock / (sold / days)); }

export function healthOf(stock: number, sold: number): Health | null {
  if (stock <= 0) return null;
  if (sold <= 0) return 'dormant';
  return coverDays(stock, sold) > BOOST_DAYS ? 'boost' : 'ok';
}

export interface PageStock { id: string; name: string; value: number; pieces: number; sold: number; cover: number; boosts: number; dormantValue: number; advice: 'boost' | 'promo' | 'ok' | 'empty' }

/** Résumé par page (catégorie principale) : valeur, ventes 30 j, boosts actifs aujourd'hui, conseil. */
export function stockByPage(keep: (p: Product) => boolean = () => true): PageStock[] {
  const sold = soldByVariant();
  const t = today();
  const by = new Map<string, PageStock>();
  for (const v of all<Variant>('variants')) {
    const p = get<Product>('products', v.productId);
    if (!p || p.active === false || v.active === false || p.kind === 'lot' || !keep(p)) continue;
    const id = rootOf(p.categoryId) || '_';
    let r = by.get(id);
    if (!r) { r = { id, name: id === '_' ? 'Sans page' : get<Category>('categories', id)?.name ?? 'Page supprimée', value: 0, pieces: 0, sold: 0, cover: 0, boosts: 0, dormantValue: 0, advice: 'ok' }; by.set(id, r); }
    const s = Math.max(0, stockOf(v.id)); const q = sold.get(v.id) ?? 0; const val = s * (v.costAvg ?? 0);
    r.pieces += s; r.value += val; r.sold += q;
    if (s > 0 && q <= 0) r.dormantValue += val;
  }
  const list = [...by.values()];
  for (const r of list) {
    r.cover = coverDays(r.pieces, r.sold);
    r.boosts = r.id === '_' ? 0 : activeBoosts(r.id, t).length;
    // Se vend lentement ou pas du tout : sans boost → mettre un boost ; déjà boosté → promotion à envisager.
    r.advice = r.pieces <= 0 ? 'empty' : r.cover > BOOST_DAYS ? (r.boosts ? 'promo' : 'boost') : 'ok';
  }
  return list.filter((r) => r.pieces > 0 || r.sold > 0).sort((a, b) => b.value - a.value);
}

export const ADVICE: Record<PageStock['advice'], { label: string; tone: 'danger' | 'warn' | 'ok' | 'neutral' }> = {
  boost: { label: 'Mettre un boost', tone: 'warn' },
  promo: { label: 'Promotion à envisager', tone: 'danger' },
  ok: { label: 'OK', tone: 'ok' },
  empty: { label: 'Stock vide', tone: 'neutral' },
};
