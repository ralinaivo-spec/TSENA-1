// Articles, variantes (couleur/taille), mouvements de stock, coût moyen, quantités en arrivage.
import { useMemo } from 'react';
import { all, get, newId, nowIso, save, useTable, type BaseRecord , bizNow, workDate } from './db';
import { audit, currentUser } from './auth';

export interface Category extends BaseRecord { name: string; parentId?: string; order?: number }
export interface Product extends BaseRecord {
  code: string;
  name: string;
  categoryId?: string;
  photo?: string;
  priceRetail?: number;
  priceWholesale?: number;
  alertQty?: number;
  link?: string;
  notes?: string;
  active: boolean;
}
export interface Variant extends BaseRecord {
  productId: string;
  sku: string;
  color?: string;
  size?: string;
  costAvg?: number;
  priceRetail?: number;   // si différent du prix de l'article
  priceWholesale?: number;
  active: boolean;
}
export type MoveType = 'initial' | 'reception' | 'sale' | 'return' | 'adjust' | 'inventory' | 'dispatch' | 'delivery_return' | 'exchange_in';
export interface StockMove extends BaseRecord {
  variantId: string;
  qty: number;          // + entrée, − sortie
  type: MoveType;
  unitCost?: number;
  refType?: string;
  refId?: string;
  reason?: string;
  at: string;
  userId?: string;
  userName?: string;
}

export const MOVE_LABELS: Record<MoveType, string> = {
  initial: 'Stock initial', reception: 'Réception', sale: 'Vente', return: 'Retour client', adjust: 'Ajustement', inventory: 'Inventaire',
  dispatch: 'Sortie livraison', delivery_return: 'Retour de livraison', exchange_in: 'Retour échange',
};
export const ADJUST_REASONS = ['Correction de saisie', 'Casse / abîmé', 'Perte', 'Vol', 'Cadeau / échantillon', 'Usage interne', 'Retour fournisseur', 'Autre'];

// ---------- Formats ----------
export const fmtAr = (n?: number | null) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('fr-FR') + ' Ar');
export const fmtNum = (n?: number | null, d = 0) => (n == null || isNaN(n) ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: d }));
export const parseNum = (s: string | number | null | undefined): number | undefined => {
  if (s == null) return undefined;
  if (typeof s === 'number') return isNaN(s) ? undefined : s;
  const t = s.replace(/\s/g, '').replace(/ /g, '').replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return isNaN(n) ? undefined : n;
};

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
export function sizeRank(s?: string) {
  if (!s) return 999;
  const u = s.toUpperCase().replace('XXXL', '3XL').replace('XXL', '2XL');
  const i = SIZE_ORDER.indexOf(u);
  if (i >= 0) return i;
  const n = /^T?(\d+)/.exec(u);
  return n ? 100 + parseInt(n[1], 10) : 500;
}
export function normSize(s?: string) {
  if (!s) return '';
  const u = s.trim().toUpperCase();
  return u === 'XXL' ? '2XL' : u === 'XXXL' ? '3XL' : u === 'XXXXL' ? '4XL' : u;
}
export function variantLabel(v?: Variant) {
  if (!v) return '';
  return [v.color, v.size].filter(Boolean).join(' · ') || 'Unique';
}

// ---------- Index calculés (mis en cache tant que les données ne changent pas) ----------
function memoBy<T>(fn: () => T, deps: () => unknown[]) {
  let last: unknown[] | null = null;
  let val: T;
  return () => {
    const d = deps();
    if (!last || d.some((x, i) => x !== last![i])) { val = fn(); last = d; }
    return val;
  };
}

export const stockIndex = memoBy(() => {
  const m = new Map<string, number>();
  for (const mv of all<StockMove>('stockMoves')) m.set(mv.variantId, (m.get(mv.variantId) ?? 0) + mv.qty);
  return m;
}, () => [all('stockMoves')]);

export interface PurchaseLine { id: string; variantId: string; qtyOrdered: number; qtyReceived: number; unitPrice: number }
export interface Purchase extends BaseRecord {
  number: string;
  supplierId?: string;
  orderRef?: string;
  trackingNo?: string;
  link?: string;
  date: string;
  currency: 'RMB' | 'MGA';
  rate: number;
  chinaFees: number;
  discount: number;
  status: PurchaseStatus;
  statusDates?: Partial<Record<PurchaseStatus, string>>;
  lines: PurchaseLine[];
  payments: { id: string; date: string; amount: number; currency: 'RMB' | 'MGA'; method: string; note?: string }[];
  forwarder?: string;
  notes?: string;
}
export type PurchaseStatus = 'ordered' | 'shipped' | 'arrived' | 'partial' | 'received' | 'cancelled';
export const PURCHASE_STATUS: Record<PurchaseStatus, { label: string; tone: 'neutral' | 'brand' | 'warn' | 'ok' | 'danger' }> = {
  ordered: { label: 'Commandée', tone: 'neutral' },
  shipped: { label: 'Expédiée de Chine', tone: 'brand' },
  arrived: { label: 'Arrivée à Madagascar', tone: 'warn' },
  partial: { label: 'Reçue en partie', tone: 'warn' },
  received: { label: 'Reçue', tone: 'ok' },
  cancelled: { label: 'Annulée', tone: 'danger' },
};

/** Quantités commandées et pas encore reçues, par variante. */
export const incomingIndex = memoBy(() => {
  const m = new Map<string, number>();
  for (const p of all<Purchase>('purchases')) {
    if (p.status === 'received' || p.status === 'cancelled') continue;
    for (const l of p.lines) {
      const rest = l.qtyOrdered - (l.qtyReceived || 0);
      if (rest > 0) m.set(l.variantId, (m.get(l.variantId) ?? 0) + rest);
    }
  }
  return m;
}, () => [all('purchases')]);

export const variantsByProduct = memoBy(() => {
  const m = new Map<string, Variant[]>();
  for (const v of all<Variant>('variants')) {
    if (!m.has(v.productId)) m.set(v.productId, []);
    m.get(v.productId)!.push(v);
  }
  for (const list of m.values()) list.sort((a, b) => (a.color || '').localeCompare(b.color || '') || sizeRank(a.size) - sizeRank(b.size) || a.sku.localeCompare(b.sku));
  return m;
}, () => [all('variants')]);

export const stockOf = (variantId: string) => stockIndex().get(variantId) ?? 0;
export const incomingOf = (variantId: string) => incomingIndex().get(variantId) ?? 0;
export const productVariants = (productId: string) => variantsByProduct().get(productId) ?? [];
export function productStock(productId: string) {
  return productVariants(productId).reduce((s, v) => s + stockOf(v.id), 0);
}
export function productIncoming(productId: string) {
  return productVariants(productId).reduce((s, v) => s + incomingOf(v.id), 0);
}
export function variantCost(v: Variant) { return v.costAvg ?? 0; }
export function variantPrice(v: Variant, p?: Product) { return v.priceRetail ?? p?.priceRetail; }
export function variantWholesale(v: Variant, p?: Product) { return v.priceWholesale ?? p?.priceWholesale; }

/** Hook : rafraîchit le composant quand le catalogue ou le stock change. */
export function useCatalog() {
  const products = useTable<Product>('products');
  const variants = useTable<Variant>('variants');
  const moves = useTable<StockMove>('stockMoves');
  const categories = useTable<Category>('categories');
  const purchases = useTable<Purchase>('purchases');
  return useMemo(() => ({ products, variants, moves, categories, purchases }), [products, variants, moves, categories, purchases]);
}

export function categoryPath(id?: string): string {
  if (!id) return 'Sans catégorie';
  const c = get<Category>('categories', id);
  if (!c) return 'Sans catégorie';
  return c.parentId ? `${categoryPath(c.parentId)} › ${c.name}` : c.name;
}

// ---------- Écritures ----------
export async function addMoves(moves: Omit<StockMove, 'id' | 'createdAt' | 'updatedAt' | 'at'> & { at?: string } | (Omit<StockMove, 'id' | 'createdAt' | 'updatedAt' | 'at'> & { at?: string })[]) {
  const u = currentUser();
  const list = (Array.isArray(moves) ? moves : [moves]).filter((m) => m.qty !== 0);
  if (!list.length) return [];
  return save('stockMoves', list.map((m) => ({ ...m, at: m.at ?? bizNow(), userId: u?.id, userName: u?.fullName })));
}

/** Entrée en stock avec mise à jour du coût moyen pondéré. */
export async function receiveIntoStock(entries: { variantId: string; qty: number; unitCost: number }[], ref: { refType: string; refId: string; at?: string }) {
  const updates: Partial<Variant>[] = [];
  for (const e of entries) {
    if (e.qty <= 0) continue;
    const v = get<Variant>('variants', e.variantId);
    if (!v) continue;
    const before = Math.max(0, stockOf(v.id));
    const old = v.costAvg ?? e.unitCost;
    const avg = before + e.qty > 0 ? (before * old + e.qty * e.unitCost) / (before + e.qty) : e.unitCost;
    updates.push({ id: v.id, costAvg: Math.round(avg * 100) / 100 });
  }
  await addMoves(entries.filter((e) => e.qty > 0).map((e) => ({ variantId: e.variantId, qty: e.qty, type: 'reception' as const, unitCost: e.unitCost, refType: ref.refType, refId: ref.refId, at: ref.at })));
  if (updates.length) await save('variants', updates);
}

/** Trouve ou crée une catégorie par son nom (et sa catégorie parente). */
export async function ensureCategory(name: string, parentId?: string): Promise<string> {
  const clean = name.trim();
  const found = all<Category>('categories').find((c) => c.name.toLowerCase() === clean.toLowerCase() && (c.parentId || undefined) === (parentId || undefined));
  if (found) return found.id;
  const [c] = await save('categories', { name: clean, parentId });
  return c.id;
}

export function findProductByCode(code: string) {
  const n = code.trim().toUpperCase().replace(/\s+/g, '');
  return all<Product>('products').find((p) => p.code.toUpperCase().replace(/\s+/g, '') === n);
}
export function findVariantBySku(sku: string) {
  const n = sku.trim().toUpperCase().replace(/\s+/g, '');
  return all<Variant>('variants').find((v) => v.sku.toUpperCase().replace(/\s+/g, '') === n);
}
export function makeSku(code: string, color?: string, size?: string) {
  return [code, color, size].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** Crée un article et ses variantes (couleurs × tailles). */
export async function createProduct(data: Partial<Product> & { code: string; name: string }, combos: { color?: string; size?: string }[]) {
  const [p] = await save('products', { active: true, ...data });
  const list = combos.length ? combos : [{}];
  await save('variants', list.map((c) => ({ productId: p.id, sku: makeSku(data.code, c.color, c.size), color: c.color || undefined, size: normSize(c.size) || undefined, active: true })));
  await audit('Article créé', `${data.code} — ${data.name}`, 'products', p.id);
  return p as Product;
}

export function nextNumber(prefix: string, table: 'purchases' | 'receptions' | 'orders') {
  const nums = all(table).filter((r: any) => String(r.number || '').startsWith(prefix + '-')).map((r: any) => parseInt(String(r.number).slice(prefix.length + 1), 10)).filter((n) => !isNaN(n));
  return `${prefix}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}

export const todayYmd = () => {
  const wd = workDate();
  if (wd) return wd;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export { newId };
