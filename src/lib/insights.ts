// Aides à la décision : objectifs de vente, fin de stock prévue, rentabilité des boosts par page,
// comparaison avec le même jour de la semaine dernière, anomalies à vérifier, transformation des clients à suivre.
import { all, get } from './db';
import { productVariants, stockOf, variantCost, type Category, type Product, type Variant } from './catalog';
import { kpis, salesLedger } from './analytics';
import { rootOf } from './scope';
import { addDays, dayOf, today } from './money';
import { grid, usdRate } from './payouts';
import { DEFAULT_COMPANY, type Company } from './settings';
import { isWalkIn, itemsTotal, keptTotal, sellingLines, type Order } from './orders';
import type { Payout } from './closed';
import type { Prospect } from './prospects';

const company = (): Company => ({ ...DEFAULT_COMPANY, ...(get<Company>('settings', 'company') ?? {}) });
const pageName = (id: string) => (id === '_' ? 'Sans page' : get<Category>('categories', id)?.name ?? 'Page supprimée');

// ---------- 1. Objectifs ----------
export interface Target { label: string; target: number; done: number; ratio: number; expected?: number; behind?: number }
export function targets(): Target[] {
  const c = company(); const t = today(); const out: Target[] = [];
  if (c.targetDay) { const done = kpis(salesLedger(t, t)).revenue; out.push({ label: "Objectif du jour", target: c.targetDay, done, ratio: done / c.targetDay }); }
  if (c.targetMonth) {
    const from = t.slice(0, 8) + '01';
    const done = kpis(salesLedger(from, t)).revenue;
    const d = new Date(`${t}T12:00:00`); const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const expected = (c.targetMonth * d.getDate()) / days;
    out.push({ label: 'Objectif du mois', target: c.targetMonth, done, ratio: done / c.targetMonth, expected, behind: Math.max(0, expected - done) });
  }
  return out;
}

// ---------- 2. Fin de stock prévue (au rythme des 30 derniers jours) ----------
export interface Coverage { product: Product; stock: number; perDay: number; days: number }
export function coverage(maxDays = 14): Coverage[] {
  const t = today(); const from = addDays(t, -29);
  const sold = new Map<string, number>();
  for (const l of salesLedger(from, t)) { const id = l.itemProductId ?? l.productId; sold.set(id, (sold.get(id) ?? 0) + l.qty); }
  const out: Coverage[] = [];
  for (const p of all<Product>('products')) {
    if (p.active === false || p.kind === 'lot') continue;
    const q = sold.get(p.id) ?? 0; if (q <= 0) continue;
    const stock = productVariants(p.id).reduce((s, v) => s + Math.max(0, stockOf(v.id)), 0);
    const perDay = q / 30; const days = stock / perDay;
    if (days <= maxDays) out.push({ product: p, stock, perDay, days });
  }
  return out.sort((a, b) => a.days - b.days);
}

// ---------- 3. Boosts : ce que rapporte 1 $ par page ----------
export interface BoostRoi { pageId: string; name: string; revenue: number; usd: number; ar: number; perUsd: number; profit: number }
export function boostRoi(from: string, to: string): BoostRoi[] {
  const g = grid(from, to); const rate = usdRate();
  const rev = new Map<string, number>(), cost = new Map<string, number>();
  for (const l of salesLedger(from, to)) { const id = rootOf(l.categoryId) || '_'; rev.set(id, (rev.get(id) ?? 0) + l.amount); cost.set(id, (cost.get(id) ?? 0) + l.cost); }
  return Object.entries(g.boostUsd).filter(([, usd]) => usd > 0).map(([pageId, usd]) => {
    const revenue = rev.get(pageId) ?? 0; const ar = usd * rate;
    return { pageId, name: pageName(pageId), revenue, usd, ar, perUsd: revenue / usd, profit: revenue - (cost.get(pageId) ?? 0) - ar };
  }).sort((a, b) => a.profit - b.profit);
}

// ---------- 4. Même jour la semaine dernière ----------
export function sameDayLastWeek(day = today()) { const d = addDays(day, -7); return { day: d, revenue: kpis(salesLedger(d, d)).revenue }; }

// ---------- 5. Anomalies à vérifier ----------
export interface Anomaly { kind: 'below_cost' | 'discount' | 'payout_gap'; text: string; href: string; amount?: number }
export function anomalies(from: string, to: string): Anomaly[] {
  const out: Anomaly[] = [];
  const seen = new Set<string>();
  for (const o of all<Order>('orders')) {
    if (o.status === 'cancelled' || o.internal) continue;
    const at = dayOf(isWalkIn(o) ? o.createdAt : o.dispatchedAt ?? o.createdAt);
    if (at < from || at > to) continue;
    for (const l of sellingLines(o)) {
      const v = get<Variant>('variants', l.variantId); const c = v ? variantCost(v) : 0;
      if (c > 0 && l.unitPrice > 0 && l.unitPrice < c && !seen.has(o.id)) {
        seen.add(o.id);
        const p = get<Product>('products', v!.productId);
        out.push({ kind: 'below_cost', text: `${o.number} : ${p?.name ?? '?'} vendu ${l.unitPrice.toLocaleString('fr-FR')} Ar, en dessous du prix de revient (${Math.round(c).toLocaleString('fr-FR')} Ar)`, href: `#/commandes/${o.id}` });
      }
    }
    const items = isWalkIn(o) ? keptTotal(o) : itemsTotal(o);
    if (o.discount && items > 0 && o.discount / items > 0.2) out.push({ kind: 'discount', text: `${o.number} : remise de ${Math.round((o.discount / items) * 100)} % (${o.discount.toLocaleString('fr-FR')} Ar)`, href: `#/commandes/${o.id}`, amount: o.discount });
  }
  for (const p of all<Payout>('payouts')) {
    if (p.status !== 'paid' || !p.gap || p.weekStart > to || p.weekEnd < from) continue;
    out.push({ kind: 'payout_gap', text: `Versement semaine du ${p.weekStart} : écart de ${p.gap.toLocaleString('fr-FR')} Ar${p.note ? ` (« ${p.note} »)` : ''}`, href: '#/recapitulatif', amount: p.gap });
  }
  return out;
}

// ---------- 6. Clients à suivre : taux de transformation ----------
export interface ConvRow { key: string; label: string; total: number; converted: number; abandoned: number; open: number; rate: number }
export function conversion(from: string, to: string, by: 'owner' | 'page'): ConvRow[] {
  const m = new Map<string, ConvRow>();
  for (const p of all<Prospect>('prospects')) {
    const d = dayOf(p.createdAt); if (d < from || d > to) continue;
    const key = by === 'owner' ? p.ownerId || p.ownerName || '?' : p.pageId || '_';
    const label = by === 'owner' ? p.ownerName || '—' : p.pageId ? pageName(p.pageId) : 'Sans page';
    const r = m.get(key) ?? { key, label, total: 0, converted: 0, abandoned: 0, open: 0, rate: 0 };
    r.total++; if (p.status === 'converted') r.converted++; else if (p.status === 'abandoned') r.abandoned++; else r.open++;
    m.set(key, r);
  }
  return [...m.values()].map((r) => ({ ...r, rate: r.converted + r.abandoned ? r.converted / (r.converted + r.abandoned) : 0 })).sort((a, b) => b.total - a.total);
}
export function abandonReasons(from: string, to: string) {
  const m = new Map<string, number>();
  for (const p of all<Prospect>('prospects')) { const d = dayOf(p.createdAt); if (p.status === 'abandoned' && d >= from && d <= to) m.set(p.abandonReason || 'Autre', (m.get(p.abandonReason || 'Autre') ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
