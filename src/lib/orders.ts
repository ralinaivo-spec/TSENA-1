// Commandes clients, livraisons, livreurs, zones : règles de calcul et actions.
import { all, applyRemote, get, newId, nowIso, save, type BaseRecord } from './db';
import { audit, currentUser } from './auth';
import { addMoves, stockOf, type Product, type Variant } from './catalog';
import { DEFAULT_COMPANY, type Company } from './settings';

export interface Zone extends BaseRecord { name: string; fee: number; order?: number; active: boolean; pickup?: boolean }
/** Zone « Sur boutique » : le client vient chercher, pas de frais ni de livreur. */
export const isPickupZone = (z?: Zone | string) => { const zone = typeof z === 'string' ? get<Zone>('zones', z) : z; return !!zone && (zone.pickup || zone.id === 'zone-retrait'); };
export interface Courier extends BaseRecord { name: string; phone?: string; zoneIds?: string[]; active: boolean; notes?: string }
export interface Customer extends BaseRecord { phone: string; phone2?: string; name?: string; facebook?: string; place?: string; zoneId?: string; notes?: string }

export type OrderStatus = 'new' | 'confirmed' | 'ready' | 'out' | 'delivered' | 'partial' | 'refused' | 'cancelled';
export type PayMethod = 'cash' | 'mvola' | 'orange' | 'airtel';
export const PAY_METHODS: Record<PayMethod, string> = { cash: 'Espèces', mvola: 'MVola', orange: 'Orange Money', airtel: 'Airtel Money' };

export interface OrderLine {
  id: string;
  variantId: string;
  qty: number;
  unitPrice: number;
  priceManual?: boolean;
  isChoice?: boolean;       // envoyé en choix (taille…), pas encore vendu
  qtyKept?: number;         // renseigné au retour du livreur
  qtyReturned?: number;
}
export interface Payment {
  id: string;
  at: string;
  amount: number;
  method: PayMethod;
  ref?: string;
  receivedBy: 'shop' | 'courier';
  courierId?: string;
  note?: string;
  userName?: string;
}
export interface Order extends BaseRecord {
  number: string;
  kind: 'order' | 'exchange';
  parentId?: string;              // commande d'origine (échange)
  channel: 'facebook' | 'phone' | 'shop' | 'other';
  customerId?: string;
  phone: string;
  name?: string;
  zoneId?: string;
  place?: string;
  placeToConfirm?: boolean;
  deliveryFee: number;
  feeCharged?: number;            // frais réellement facturés (au retour)
  wholesale?: 'auto' | 'yes' | 'no';
  wantedDate?: string;
  lines: OrderLine[];
  returnLines?: { variantId: string; qty: number; unitPrice: number }[]; // échange : articles repris au client
  credit?: number;                // échange : valeur des articles repris
  discount: number;
  payments: Payment[];
  notes?: string;
  status: OrderStatus;
  statusDates?: Partial<Record<OrderStatus, string>>;
  outsideHours?: boolean;
  courierId?: string;
  dispatchedAt?: string;
  returnedAt?: string;
  createdBy?: string;
  createdByName?: string;
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: 'neutral' | 'brand' | 'warn' | 'ok' | 'danger' }> = {
  new: { label: 'À confirmer', tone: 'warn' },
  confirmed: { label: 'À préparer', tone: 'brand' },
  ready: { label: 'Prête', tone: 'brand' },
  out: { label: 'En livraison', tone: 'warn' },
  delivered: { label: 'Livrée', tone: 'ok' },
  partial: { label: 'Livrée en partie', tone: 'ok' },
  refused: { label: 'Refusée', tone: 'danger' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};
export const CHANNELS = { facebook: 'Facebook', phone: 'Téléphone', shop: 'Vente sur place (boutique)', other: 'Autre' };
export const isWalkIn = (o: Pick<Order, 'channel'>) => o.channel === 'shop';
/** Nom affiché : client, sinon téléphone, sinon « Vente sur place ». */
export const orderLabel = (o: Pick<Order, 'name' | 'phone' | 'channel'>) => o.name || (o.phone ? fmtPhone(o.phone) : o.channel === 'shop' ? 'Vente sur place' : '—');

// ---------- Téléphones ----------
export function normPhone(p: string) {
  let d = (p || '').replace(/\D/g, '');
  if (d.startsWith('261')) d = '0' + d.slice(3);
  if (d.length === 9 && !d.startsWith('0')) d = '0' + d;
  return d;
}
export function fmtPhone(p?: string) {
  const d = normPhone(p || '');
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : p || '';
}
export function findCustomer(phone: string) {
  const n = normPhone(phone);
  if (n.length < 6) return undefined;
  return all<Customer>('customers').find((c) => normPhone(c.phone) === n || (c.phone2 && normPhone(c.phone2) === n));
}

// ---------- Zones par défaut (identifiants fixes : identiques sur tous les appareils) ----------
const SEED = '2000-01-01T00:00:00.000Z';
const DEFAULT_ZONES = [
  ['zone-retrait', 'Sur boutique (retrait par le client)', 0], ['zone-centre', 'Tana centre-ville', 3000], ['zone-proche', 'Tana périphérie proche', 4000],
  ['zone-peripherie', 'Tana périphérie', 5000], ['zone-loin', 'Tana grande périphérie', 7000], ['zone-province', 'Province (envoi taxi-brousse / coopérative)', 5000],
] as const;
export async function seedZones() {
  await applyRemote(DEFAULT_ZONES.map(([id, name, fee], i) => ({ tbl: 'zones', id, data: { id, name, fee, order: i, active: true, pickup: id === 'zone-retrait' || undefined, createdAt: SEED, updatedAt: SEED } as BaseRecord })));
}

// ---------- Horaires ----------
export function isOutsideHours(d: Date, c: Company) {
  const hours = c.hours ?? DEFAULT_COMPANY.hours!;
  const h = hours[String(d.getDay())];
  if (!h) return true;
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return t < h.open || t >= h.close;
}

// ---------- Montants ----------
export const sellingLines = (o: Order) => o.lines.filter((l) => !l.isChoice);
export function itemsTotal(o: Order) { return sellingLines(o).reduce((s, l) => s + l.qty * l.unitPrice, 0); }
export function keptTotal(o: Order) { return o.lines.reduce((s, l) => s + (l.qtyKept ?? (l.isChoice ? 0 : l.qty)) * l.unitPrice, 0); }
export const paidTotal = (o: Order) => (o.payments || []).reduce((s, p) => s + p.amount, 0);
const isClosed = (o: Order) => ['delivered', 'partial', 'refused'].includes(o.status);
/** Montant total à payer par le client (articles − remise − reprise + frais). */
export function orderTotal(o: Order) {
  const items = isClosed(o) ? keptTotal(o) : itemsTotal(o);
  const fee = isClosed(o) ? (o.feeCharged ?? o.deliveryFee) : o.deliveryFee;
  return Math.max(0, items - (o.discount || 0)) + (fee || 0);
}
/** Différence pour un échange (positive : le client paie ; négative : on lui rend). */
export function exchangeBalance(o: Order) {
  const items = isClosed(o) ? keptTotal(o) : itemsTotal(o);
  return items - (o.discount || 0) - (o.credit || 0) + (isClosed(o) ? (o.feeCharged ?? o.deliveryFee) : o.deliveryFee);
}
export function remaining(o: Order) {
  const due = o.kind === 'exchange' ? exchangeBalance(o) : orderTotal(o);
  return due - paidTotal(o);
}
export const totalQty = (o: Order) => sellingLines(o).reduce((s, l) => s + l.qty, 0);

/** Prix de gros : automatique à partir du seuil (3 pièces), ou forcé par le vendeur. */
export function useWholesale(o: Pick<Order, 'lines' | 'wholesale'>, minQty: number) {
  if (o.wholesale === 'yes') return true;
  if (o.wholesale === 'no') return false;
  return o.lines.filter((l) => !l.isChoice).reduce((s, l) => s + l.qty, 0) >= minQty;
}
export function linePrice(variantId: string, wholesale: boolean) {
  const v = get<Variant>('variants', variantId);
  const p = v && get<Product>('products', v.productId);
  const retail = v?.priceRetail ?? p?.priceRetail ?? 0;
  const gros = v?.priceWholesale ?? p?.priceWholesale;
  return wholesale && gros ? gros : retail;
}
export function repriceLines(lines: OrderLine[], wholesale: boolean) {
  return lines.map((l) => (l.priceManual ? l : { ...l, unitPrice: linePrice(l.variantId, wholesale) }));
}

// ---------- Réservations : pièces promises à des commandes pas encore parties ----------
export function reservedIndex(excludeOrderId?: string) {
  const m = new Map<string, number>();
  for (const o of all<Order>('orders')) {
    if (o.id === excludeOrderId || !['new', 'confirmed', 'ready'].includes(o.status)) continue;
    for (const l of o.lines) m.set(l.variantId, (m.get(l.variantId) ?? 0) + l.qty);
  }
  return m;
}
export function availableOf(variantId: string, reserved: Map<string, number>) {
  return stockOf(variantId) - (reserved.get(variantId) ?? 0);
}

// ---------- Actions ----------
async function setStatus(o: Order, status: OrderStatus, extra: Partial<Order> = {}) {
  await save('orders', { id: o.id, status, statusDates: { ...(o.statusDates || {}), [status]: nowIso() }, ...extra });
  await audit('Commande', `${o.number} : ${ORDER_STATUS[status].label}`, 'orders', o.id);
}
export const confirmOrder = (o: Order) => setStatus(o, 'confirmed');
export const markReady = (o: Order) => setStatus(o, 'ready');
export const backToPrepare = (o: Order) => setStatus(o, 'confirmed');

/** Remise au livreur : les articles (y compris les choix) quittent la boutique. */
export async function dispatchOrder(o: Order, courierId: string) {
  const at = nowIso();
  await addMoves(o.lines.map((l) => ({ variantId: l.variantId, qty: -l.qty, type: 'dispatch' as const, refType: 'order', refId: o.id, reason: `${o.number}${l.isChoice ? ' (choix)' : ''}`, at })));
  await setStatus(o, 'out', { courierId, dispatchedAt: at });
}

/** Retour du livreur : ce qui est gardé, rendu, l'argent encaissé. */
export async function recordReturn(o: Order, r: { kept: Record<string, number>; feeCharged: number; collected: { amount: number; method: PayMethod; ref?: string }[]; note?: string }) {
  const at = nowIso();
  const lines = o.lines.map((l) => {
    const kept = Math.max(0, Math.min(l.qty, r.kept[l.id] ?? 0));
    return { ...l, qtyKept: kept, qtyReturned: l.qty - kept };
  });
  await addMoves(lines.filter((l) => l.qtyReturned > 0).map((l) => ({
    variantId: l.variantId, qty: l.qtyReturned!, type: 'delivery_return' as const, refType: 'order', refId: o.id,
    reason: `${o.number} — ${l.isChoice ? 'choix non retenu' : 'refusé par le client'}`, at,
  })));
  const u = currentUser();
  const pays: Payment[] = r.collected.filter((c) => c.amount).map((c) => ({ id: newId(), at, amount: c.amount, method: c.method, ref: c.ref, receivedBy: 'courier', courierId: o.courierId, userName: u?.fullName }));
  const keptAny = lines.some((l) => (l.qtyKept ?? 0) > 0);
  const allKept = lines.filter((l) => !l.isChoice).every((l) => (l.qtyKept ?? 0) >= l.qty);
  const status: OrderStatus = !keptAny && !(o.kind === 'exchange' && !o.lines.length) ? 'refused' : allKept ? 'delivered' : 'partial';
  if (o.kind === 'exchange' && o.returnLines?.length && status !== 'refused') {
    await addMoves(o.returnLines.map((rl) => ({ variantId: rl.variantId, qty: rl.qty, type: 'exchange_in' as const, refType: 'order', refId: o.id, reason: `${o.number} — article repris (échange)`, at })));
  }
  await setStatus(o, status, { lines, feeCharged: r.feeCharged, payments: [...(o.payments || []), ...pays], returnedAt: at, notes: r.note ? [o.notes, `Retour : ${r.note}`].filter(Boolean).join('\n') : o.notes });
}

/** Échange traité directement en boutique (sans livraison). */
export async function completeAtShop(o: Order, pay?: { amount: number; method: PayMethod; ref?: string }) {
  const at = nowIso();
  await addMoves([
    ...o.lines.map((l) => ({ variantId: l.variantId, qty: -l.qty, type: 'dispatch' as const, refType: 'order', refId: o.id, reason: `${o.number} — remis en boutique`, at })),
    ...(o.returnLines || []).map((rl) => ({ variantId: rl.variantId, qty: rl.qty, type: 'exchange_in' as const, refType: 'order', refId: o.id, reason: `${o.number} — article repris (échange)`, at })),
  ]);
  const u = currentUser();
  const pays = pay?.amount ? [{ id: newId(), at, amount: pay.amount, method: pay.method, ref: pay.ref, receivedBy: 'shop' as const, userName: u?.fullName }] : [];
  await setStatus(o, 'delivered', { lines: o.lines.map((l) => ({ ...l, qtyKept: l.qty, qtyReturned: 0 })), feeCharged: 0, deliveryFee: 0, payments: [...(o.payments || []), ...pays], returnedAt: at, dispatchedAt: at });
}

/** Retrait en boutique : le client repart avec ses articles et paie sur place. */
export async function handOverAtShop(o: Order, pay?: { amount: number; method: PayMethod; ref?: string }) {
  const at = nowIso();
  await addMoves(o.lines.filter((l) => !l.isChoice).map((l) => ({ variantId: l.variantId, qty: -l.qty, type: 'dispatch' as const, refType: 'order', refId: o.id, reason: `${o.number} — retiré en boutique`, at })));
  const u = currentUser();
  const pays = pay?.amount ? [{ id: newId(), at, amount: pay.amount, method: pay.method, ref: pay.ref, receivedBy: 'shop' as const, userName: u?.fullName }] : [];
  if (o.kind === 'exchange' && o.returnLines?.length) {
    await addMoves(o.returnLines.map((rl) => ({ variantId: rl.variantId, qty: rl.qty, type: 'exchange_in' as const, refType: 'order', refId: o.id, reason: `${o.number} — article repris (échange)`, at })));
  }
  await setStatus(o, 'delivered', { lines: o.lines.map((l) => ({ ...l, qtyKept: l.isChoice ? 0 : l.qty, qtyReturned: 0 })), feeCharged: 0, payments: [...(o.payments || []), ...pays], returnedAt: at, dispatchedAt: at });
}

/** Vente sur place (comptoir) : enregistrée et terminée immédiatement. */
export async function createWalkInSale(d: { lines: OrderLine[]; discount: number; wholesale: Order['wholesale']; phone?: string; name?: string; notes?: string; payments: { amount: number; method: PayMethod; ref?: string }[]; outsideHours: boolean }) {
  const at = nowIso();
  const u = currentUser();
  const pickup = all<Zone>('zones').find((z) => isPickupZone(z));
  const phone = d.phone ? normPhone(d.phone) : '';
  let customerId: string | undefined;
  if (phone.length >= 9) {
    const c = findCustomer(phone);
    if (c) customerId = c.id;
    else { const [nc] = await save('customers', { phone, name: d.name || undefined }); customerId = nc.id; }
  }
  const number = nextOrderNumber('V');
  const [o] = await save('orders', {
    number, kind: 'order', channel: 'shop', customerId, phone, name: d.name || undefined, zoneId: pickup?.id, deliveryFee: 0, feeCharged: 0,
    wholesale: d.wholesale, lines: d.lines.map((l) => ({ ...l, qtyKept: l.qty, qtyReturned: 0 })), discount: d.discount, notes: d.notes,
    payments: d.payments.filter((p) => p.amount).map((p) => ({ id: newId(), at, amount: p.amount, method: p.method, ref: p.ref, receivedBy: 'shop' as const, userName: u?.fullName })),
    status: 'delivered', statusDates: { delivered: at }, dispatchedAt: at, returnedAt: at, outsideHours: d.outsideHours, createdBy: u?.id, createdByName: u?.fullName,
  });
  await addMoves(d.lines.map((l) => ({ variantId: l.variantId, qty: -l.qty, type: 'sale' as const, refType: 'order', refId: o.id, reason: `${number} — vente sur place`, at })));
  await audit('Vente sur place', `${number} — ${d.lines.reduce((s, l) => s + l.qty, 0)} article(s)`, 'orders', o.id);
  return o as Order;
}
function nextOrderNumber(prefix: string) {
  const nums = all<Order>('orders').filter((o) => o.number.startsWith(prefix + '-')).map((o) => parseInt(o.number.slice(prefix.length + 1), 10)).filter((n) => !isNaN(n));
  return `${prefix}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}

export async function cancelOrder(o: Order, reason: string) {
  if (o.status === 'out') {
    await addMoves(o.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, type: 'delivery_return' as const, refType: 'order', refId: o.id, reason: `${o.number} annulée — retour en boutique` })));
  }
  await setStatus(o, 'cancelled', { notes: [o.notes, `Annulée : ${reason}`].filter(Boolean).join('\n') });
}

export async function addPayment(o: Order, p: Omit<Payment, 'id' | 'at' | 'userName'>) {
  const pay: Payment = { ...p, id: newId(), at: nowIso(), userName: currentUser()?.fullName };
  await save('orders', { id: o.id, payments: [...(o.payments || []), pay] });
  await audit('Paiement client', `${o.number} : ${pay.amount} Ar (${PAY_METHODS[pay.method]}, ${pay.receivedBy === 'shop' ? 'boutique' : 'livreur'})`, 'orders', o.id);
}

// ---------- Comptes des livreurs ----------
/**
 * Ce que le livreur doit à la boutique = argent encaissé auprès des clients − frais de livraison qu'il a gagnés.
 * (Positif : il doit rendre de l'argent. Négatif : la boutique lui doit ses frais, ex. frais payés par MVola à la boutique.)
 * Les règlements (remises d'argent) arriveront avec la trésorerie (étape 6).
 */
export function courierAccount(courierId: string, from?: string, to?: string) {
  const inRange = (iso?: string) => !!iso && (!from || iso.slice(0, 10) >= from) && (!to || iso.slice(0, 10) <= to);
  let collected = 0, fees = 0, deliveries = 0, out = 0, outValue = 0;
  const orders = all<Order>('orders').filter((o) => o.courierId === courierId);
  for (const o of orders) {
    if (o.status === 'out') { out++; outValue += remaining(o); }
    for (const p of o.payments || []) if (p.receivedBy === 'courier' && p.courierId === courierId && inRange(p.at)) collected += p.amount;
    if (['delivered', 'partial', 'refused'].includes(o.status) && inRange(o.returnedAt)) {
      fees += o.feeCharged ?? 0;
      if (o.status !== 'refused') deliveries++;
    }
  }
  return { collected, fees, due: collected - fees, deliveries, out, outValue };
}

