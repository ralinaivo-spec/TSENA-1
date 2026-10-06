// Achats en Chine : totaux d'une commande, paiements, calcul du coût de revient à la réception.
import { all, get, save, type BaseRecord } from './db';
import { audit } from './auth';
import { receiveIntoStock, type Purchase, type PurchaseLine, type PurchaseStatus } from './catalog';

export interface Supplier extends BaseRecord { name: string; shop?: string; contact?: string; city?: string; notes?: string }

export interface TransitInvoice {
  mode: 'sea' | 'air';
  billedQty: number;        // m³ (maritime) ou kg (aérien)
  tariff: number;           // prix par m³ ou par kg
  tariffCurrency: 'USD' | 'RMB' | 'MGA';
  fx: number;               // Ariary pour 1 unité de la devise du tarif
  invoiceRef?: string;
  forwarder?: string;
  otherFees: { label: string; amount: number }[]; // en Ariary
}
export type Allocation = 'quantity' | 'value';

export interface ReceptionItem {
  purchaseId: string;
  lineId: string;
  variantId: string;
  qty: number;
  goodsUnitAr: number;   // prix + frais Chine − remise, converti en Ariary
  transitUnitAr: number; // part du transit et des autres frais
  unitCost: number;
}
export interface Reception extends BaseRecord {
  number: string;
  date: string;
  purchaseIds: string[];
  invoice: TransitInvoice;
  allocation: Allocation;
  transitTotalAr: number;
  items: ReceptionItem[];
  notes?: string;
  userName?: string;
}

export const MODE_LABEL = { sea: 'Maritime (au m³)', air: 'Aérien (au kg)' };
export const UNIT_LABEL = { sea: 'm³', air: 'kg' };

export const lineTotal = (l: PurchaseLine) => l.qtyOrdered * l.unitPrice;
export function purchaseGoods(p: Purchase) { return p.lines.reduce((s, l) => s + lineTotal(l), 0); }
/** Total dû au fournisseur dans la devise de la commande. */
export function purchaseTotal(p: Purchase) { return purchaseGoods(p) + (p.chinaFees || 0) - (p.discount || 0); }
export function toAr(amount: number, currency: 'RMB' | 'MGA', rate: number) { return currency === 'RMB' ? amount * rate : amount; }
export function purchaseTotalAr(p: Purchase) { return toAr(purchaseTotal(p), p.currency, p.rate); }
export function purchasePaid(p: Purchase) {
  return (p.payments || []).reduce((s, x) => s + (x.currency === p.currency ? x.amount : p.currency === 'RMB' ? x.amount / (p.rate || 1) : x.amount * (p.rate || 1)), 0);
}
export const purchaseQty = (p: Purchase) => p.lines.reduce((s, l) => s + l.qtyOrdered, 0);
export const purchaseReceivedQty = (p: Purchase) => p.lines.reduce((s, l) => s + (l.qtyReceived || 0), 0);

/** Prix unitaire en Ariary d'une ligne, frais Chine et remise répartis par pièce commandée. */
export function goodsUnitAr(p: Purchase, l: PurchaseLine) {
  const q = purchaseQty(p) || 1;
  const unit = l.unitPrice + (p.chinaFees || 0) / q - (p.discount || 0) / q;
  return toAr(unit, p.currency, p.rate);
}

export function transitTotalAr(inv: TransitInvoice) {
  const fx = inv.tariffCurrency === 'MGA' ? 1 : inv.fx || 0;
  return (inv.billedQty || 0) * (inv.tariff || 0) * fx + inv.otherFees.reduce((s, f) => s + (f.amount || 0), 0);
}

/** Calcule le coût de revient de chaque ligne reçue. */
export function computeReception(entries: { purchase: Purchase; line: PurchaseLine; qty: number }[], inv: TransitInvoice, allocation: Allocation): { items: ReceptionItem[]; total: number } {
  const total = transitTotalAr(inv);
  const base = entries.filter((e) => e.qty > 0).map((e) => ({ ...e, g: goodsUnitAr(e.purchase, e.line) }));
  const totalQty = base.reduce((s, e) => s + e.qty, 0) || 1;
  const totalValue = base.reduce((s, e) => s + e.qty * e.g, 0) || 1;
  const items = base.map((e) => {
    const share = allocation === 'value' ? (total * e.g) / totalValue : total / totalQty;
    return { purchaseId: e.purchase.id, lineId: e.line.id, variantId: e.line.variantId, qty: e.qty, goodsUnitAr: round2(e.g), transitUnitAr: round2(share), unitCost: round2(e.g + share) };
  });
  return { items, total };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

export function statusAfterReception(p: Purchase): PurchaseStatus {
  const done = p.lines.every((l) => (l.qtyReceived || 0) >= l.qtyOrdered);
  return done ? 'received' : 'partial';
}

/** Valide une réception : entrées en stock, coût moyen, quantités reçues et statut des commandes. */
export async function validateReception(rec: Omit<Reception, 'id' | 'createdAt' | 'updatedAt'>) {
  const [saved] = await save('receptions', rec);
  await receiveIntoStock(rec.items.map((i) => ({ variantId: i.variantId, qty: i.qty, unitCost: i.unitCost })), { refType: 'reception', refId: saved.id, at: new Date(rec.date + 'T12:00:00').toISOString() });
  for (const pid of rec.purchaseIds) {
    const p = get<Purchase>('purchases', pid);
    if (!p) continue;
    const lines = p.lines.map((l) => {
      const got = rec.items.filter((i) => i.purchaseId === pid && i.lineId === l.id).reduce((s, i) => s + i.qty, 0);
      return got ? { ...l, qtyReceived: (l.qtyReceived || 0) + got } : l;
    });
    const next = { ...p, lines };
    const status = statusAfterReception(next);
    await save('purchases', { id: p.id, lines, status, statusDates: { ...(p.statusDates || {}), [status]: rec.date } });
  }
  await audit('Réception', `${rec.number} : ${rec.items.reduce((s, i) => s + i.qty, 0)} pièce(s) entrées en stock`, 'receptions', saved.id);
  return saved as Reception;
}

export function lastRate(field: 'rmb' | 'usd'): number | undefined {
  if (field === 'rmb') {
    const p = all<Purchase>('purchases').filter((x) => x.currency === 'RMB' && x.rate).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return p?.rate;
  }
  const r = all<Reception>('receptions').filter((x) => x.invoice?.tariffCurrency === 'USD').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return r?.invoice.fx;
}
