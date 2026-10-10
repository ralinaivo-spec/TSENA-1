// Lots, promotions et prix par quantité.
// - Un « lot » (ou une promotion) est un article sans stock propre : il regroupe des articles du catalogue
//   (ex. kitapo + kiraro, ou 3 pyjamas aux couleurs choisies à la vente, ou lampe + porte-clé offert).
//   Vendu, il sort du stock les articles qu'il contient ; son prix est un prix d'ensemble.
// - Un « prix par quantité » (ex. 1 pièce 20 000 Ar, 3 pièces 50 000 Ar) s'applique tout seul à la vente.
// Dans une commande, les articles gardent leur prix normal et une ligne « prix du lot » / « prix par quantité »
// donne la différence. Au retour, si le client ne garde pas le lot complet, il paie les articles gardés au prix
// normal (le prix du lot ne s'applique qu'aux lots complets).
import { get, newId } from './db';
import { productVariants, todayYmd, type Product, type Variant } from './catalog';
import type { OrderLine } from './orders';

export interface LotItem { id: string; productId: string; variantId?: string; qty: number; gift?: boolean }
export interface LotDef { items: LotItem[]; from?: string; to?: string }
export interface PriceTier { qty: number; price: number }

/** Différence de prix d'une commande : prix du lot ou prix par quantité. */
export interface Adjust {
  id: string;
  kind: 'lot' | 'tier';
  productId: string;        // le lot, ou l'article au prix par quantité
  qty: number;              // nombre de lots / de paquets
  unit: number;             // différence par lot (souvent négative)
  lotKey?: string;
  items?: { id: string; qty: number }[];
  tierQty?: number; tierPrice?: number;
  refVariantId?: string;    // une variante concernée (pour la page / catégorie)
  label?: string;
}

const retailOf = (variantId: string) => {
  const v = get<Variant>('variants', variantId);
  const p = v && get<Product>('products', v.productId);
  return v?.priceRetail ?? p?.priceRetail ?? 0;
};
const productOfVariant = (variantId: string) => get<Variant>('variants', variantId)?.productId;

export const isLot = (p?: Product | null) => !!p && p.kind === 'lot';
/** Lot proposé à la vente aujourd'hui (actif et dans ses dates de promotion). */
export function lotOpen(p: Product, day = todayYmd()) {
  if (!isLot(p) || p.active === false) return false;
  return (!p.lot?.from || day >= p.lot.from) && (!p.lot?.to || day <= p.lot.to);
}
export function lotStatus(p: Product, day = todayYmd()): 'open' | 'soon' | 'ended' | 'off' {
  if (p.active === false) return 'off';
  if (p.lot?.from && day < p.lot.from) return 'soon';
  if (p.lot?.to && day > p.lot.to) return 'ended';
  return 'open';
}
/** Variante imposée d'un élément du lot (ou la seule variante de l'article) ; sinon couleur/taille au choix. */
export function itemVariant(it: LotItem) {
  if (it.variantId) return it.variantId;
  const vs = productVariants(it.productId).filter((v) => v.active !== false);
  return vs.length === 1 ? vs[0].id : undefined;
}
export const itemChoices = (it: LotItem) => productVariants(it.productId).filter((v) => v.active !== false);
/** Valeur des articles du lot au prix normal (pour montrer ce que gagne le client). */
export function lotRegular(p: Product) {
  return (p.lot?.items ?? []).reduce((t, it) => {
    const v = itemVariant(it);
    const price = v ? retailOf(v) : get<Product>('products', it.productId)?.priceRetail ?? 0;
    return t + it.qty * price;
  }, 0);
}
/** Nombre de lots qu'on peut encore vendre avec le stock disponible. */
export function lotAvailable(p: Product, avail: (variantId: string) => number) {
  const items = p.lot?.items ?? [];
  if (!items.length) return 0;
  return Math.max(0, Math.min(...items.map((it) => {
    const v = itemVariant(it);
    const a = v ? Math.max(0, avail(v)) : itemChoices(it).reduce((t, x) => t + Math.max(0, avail(x.id)), 0);
    return Math.floor(a / Math.max(1, it.qty));
  })));
}
/** Coût du lot (prix de revient des articles, cadeaux compris). */
export function lotCost(p: Product) {
  return (p.lot?.items ?? []).reduce((t, it) => {
    const v = itemVariant(it) ?? itemChoices(it)[0]?.id;
    return t + it.qty * (get<Variant>('variants', v || '')?.costAvg ?? 0);
  }, 0);
}

/** Lignes de commande pour `n` lots. `picks` : pour chaque élément « au choix », quantité par variante. */
export function lotLines(p: Product, n: number, picks: Record<string, Record<string, number>> = {}): OrderLine[] {
  const key = newId();
  const out: OrderLine[] = [];
  for (const it of p.lot?.items ?? []) {
    const base = { lotKey: key, lotProductId: p.id, lotItem: it.id, lotPer: it.qty, lotN: n, lotPrice: p.priceRetail ?? 0, gift: it.gift || undefined };
    const fixed = itemVariant(it);
    if (fixed) out.push({ id: newId(), variantId: fixed, qty: it.qty * n, unitPrice: retailOf(fixed), ...base });
    else for (const [vid, q] of Object.entries(picks[it.id] ?? {})) if (q > 0) out.push({ id: newId(), variantId: vid, qty: q, unitPrice: retailOf(vid), ...base });
  }
  return out;
}

/** Lignes qui comptent pour le prix par quantité d'un article (ni lot, ni choix, ni prix de gros, ni prix modifié). */
export const tierLines = (lines: OrderLine[], productId: string) =>
  lines.filter((l) => !l.lotKey && !l.isChoice && !l.wholesale && !l.priceManual && productOfVariant(l.variantId) === productId);
export const productTiers = (p?: Product) => (p?.tiers ?? []).filter((t) => t.qty > 1 && t.price > 0).sort((a, b) => b.qty - a.qty);

/** Différences de prix d'une commande (lots et prix par quantité), recalculées à partir des lignes. */
export function computeAdjusts(lines: OrderLine[]): Adjust[] {
  const out: Adjust[] = [];
  const groups = new Map<string, OrderLine[]>();
  for (const l of lines) if (l.lotKey) { if (!groups.has(l.lotKey)) groups.set(l.lotKey, []); groups.get(l.lotKey)!.push(l); }
  for (const [key, ls] of groups) {
    const first = ls[0];
    const n = Math.max(1, first.lotN || 1);
    const items = [...new Map(ls.map((l) => [l.lotItem || l.id, { id: l.lotItem || l.id, qty: l.lotPer || 1 }])).values()];
    const value = ls.reduce((t, l) => t + l.qty * l.unitPrice, 0);
    const p = get<Product>('products', first.lotProductId || '');
    out.push({ id: `lot_${key}`, kind: 'lot', productId: first.lotProductId || '', lotKey: key, qty: n, unit: (first.lotPrice ?? p?.priceRetail ?? 0) - Math.round(value / n), items, refVariantId: first.variantId, label: p?.name });
  }
  const byProduct = new Map<string, true>();
  for (const l of lines) { if (l.lotKey || l.isChoice || l.wholesale || l.priceManual) continue; const pid = productOfVariant(l.variantId); if (pid) byProduct.set(pid, true); }
  for (const pid of byProduct.keys()) {
    const p = get<Product>('products', pid);
    const tiers = productTiers(p);
    if (!tiers.length) continue;
    const ls = tierLines(lines, pid);
    const qty = ls.reduce((t, l) => t + l.qty, 0);
    if (!qty) continue;
    const avg = ls.reduce((t, l) => t + l.qty * l.unitPrice, 0) / qty;
    let rem = qty;
    for (const t of tiers) {
      const c = Math.floor(rem / t.qty);
      if (!c) continue;
      const unit = t.price - Math.round(t.qty * avg);
      if (unit >= 0) continue;
      out.push({ id: `tier_${pid}_${t.qty}`, kind: 'tier', productId: pid, qty: c, unit, tierQty: t.qty, tierPrice: t.price, refVariantId: ls[0].variantId, label: p?.name });
      rem -= c * t.qty;
    }
  }
  return out;
}

/** Nombre de lots / paquets réellement gardés par le client (d'après les quantités gardées des lignes). */
export function adjustKept(a: Adjust, lines: OrderLine[], all: Adjust[]) {
  if (!lines.some((l) => l.qtyKept !== undefined)) return a.qty;
  const k = (l: OrderLine) => l.qtyKept ?? (l.isChoice ? 0 : l.qty);
  if (a.kind === 'lot') {
    let n = a.qty;
    for (const it of a.items ?? []) {
      const s = lines.filter((l) => l.lotKey === a.lotKey && (l.lotItem || l.id) === it.id).reduce((t, l) => t + k(l), 0);
      n = Math.min(n, Math.floor(s / Math.max(1, it.qty)));
    }
    return Math.max(0, n);
  }
  let rem = tierLines(lines, a.productId).reduce((t, l) => t + k(l), 0);
  for (const b of all.filter((x) => x.kind === 'tier' && x.productId === a.productId).sort((x, y) => (y.tierQty ?? 0) - (x.tierQty ?? 0))) {
    const c = Math.min(b.qty, Math.floor(rem / Math.max(1, b.tierQty ?? 1)));
    if (b.id === a.id) return c;
    rem -= c * (b.tierQty ?? 1);
  }
  return 0;
}
export const adjustsTotal = (o: { adjusts?: Adjust[] }) => (o.adjusts ?? []).reduce((t, a) => t + a.qty * a.unit, 0);
export const adjustsKeptTotal = (o: { adjusts?: Adjust[]; lines: OrderLine[] }) => (o.adjusts ?? []).reduce((t, a) => t + adjustKept(a, o.lines, o.adjusts ?? []) * a.unit, 0);

/** Libellé court : « Prix du lot Pack école (1 × 45 000 Ar) » ou « Prix par quantité : 3 pour 50 000 Ar ». */
export function adjustLabel(a: Adjust) {
  const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} Ar`;
  if (a.kind === 'lot') { const p = get<Product>('products', a.productId); return `Prix du lot « ${a.label ?? p?.name ?? 'lot'} »${a.qty > 1 ? ` × ${a.qty}` : ''}${p?.priceRetail ? ` (${fmt(p.priceRetail)} le lot)` : ''}`; }
  return `Prix par quantité « ${a.label ?? get<Product>('products', a.productId)?.name ?? ''} » : ${a.tierQty} pour ${fmt(a.tierPrice ?? 0)}${a.qty > 1 ? ` × ${a.qty}` : ''}`;
}
