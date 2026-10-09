// Trésorerie : comptes (caisse, mobile money, banque), mouvements, dépenses et revenus, règlements des
// livreurs, chiffres d'une journée et clôture (« Z de caisse »).
import { all, applyRemote, bizNow, get, newId, nowIso, remove, save, workDate, type BaseRecord } from './db';
import { audit, currentUser } from './auth';
import { assertOpenAt } from './closed';
import { variantCost, type Variant } from './catalog';
import { courierSplit, isPickupZone, isWalkIn, keptTotal, recordReturn, remaining, sellingLines, type Courier, type Order, type PayMethod } from './orders';

// ---------- Comptes ----------
export type AccountId = PayMethod | 'bank';
export const ACCOUNTS: Record<AccountId, string> = { cash: 'Caisse espèces', mvola: 'MVola', orange: 'Orange Money', airtel: 'Airtel Money', bank: 'Banque' };
export const ACCOUNT_IDS = Object.keys(ACCOUNTS) as AccountId[];

export type MoveType = 'opening' | 'expense' | 'income' | 'transfer' | 'owner_in' | 'owner_out' | 'courier_settlement' | 'purchase' | 'gap';
export const MOVE_TYPES: Record<MoveType, string> = {
  opening: 'Solde de départ', expense: 'Dépense', income: 'Autre revenu', transfer: 'Virement entre comptes', owner_in: 'Apport du gérant',
  owner_out: 'Retrait du gérant', courier_settlement: 'Règlement livreur', purchase: 'Paiement fournisseur (Chine)', gap: 'Écart de clôture',
};
export interface CashMove extends BaseRecord {
  at: string;            // date et heure de l'opération
  account: AccountId;
  amount: number;        // + entrée, − sortie
  type: MoveType;
  categoryId?: string;
  label?: string;
  note?: string;
  photo?: string;        // photo du reçu
  transferId?: string;   // les deux lignes d'un virement
  recurringId?: string;
  period?: string;       // AAAA-MM (opération récurrente)
  refType?: string;
  refId?: string;
  userName?: string;
}
export interface FinanceCategory extends BaseRecord { kind: 'expense' | 'income'; name: string; order?: number; active: boolean }
export interface Recurring extends BaseRecord { kind: 'expense' | 'income'; label: string; categoryId: string; account: AccountId; amount: number; day: number; startMonth: string; active: boolean; skipped?: string[] }
export interface CourierSettlement extends BaseRecord { courierId: string; at: string; amount: number; account: AccountId; balanceBefore: number; orderIds: string[]; note?: string; userName?: string }
// ---------- Dates (heure de Madagascar = heure de l'appareil) ----------
const pad = (n: number) => String(n).padStart(2, '0');
export const dayOf = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const today = () => workDate() ?? dayOf(new Date().toISOString());
/** Fin de journée locale (pour les soldes « au soir du … »). */
export const endOf = (ymd: string) => new Date(`${ymd}T23:59:59.999`).toISOString();
/** Heure pour une opération saisie à une date : maintenant si c'est aujourd'hui, sinon midi ce jour-là. */
export const atFor = (ymd: string) => (ymd === today() ? bizNow() : new Date(`${ymd}T12:00:00`).toISOString());

// ---------- Catégories par défaut (identifiants fixes, identiques sur tous les appareils) ----------
const SEED = '2000-01-01T00:00:00.000Z';
const DEFAULT_CATS: [string, 'expense' | 'income', string][] = [
  ['fc-loyer', 'expense', 'Loyer'], ['fc-salaires', 'expense', 'Salaires'], ['fc-jirama', 'expense', 'Électricité et eau (JIRAMA)'],
  ['fc-internet', 'expense', 'Internet et crédit téléphone'], ['fc-transport', 'expense', 'Carburant et transport'], ['fc-pub', 'expense', 'Publicité Facebook'],
  ['fc-emballage', 'expense', 'Emballage'], ['fc-transit', 'expense', 'Transit et dédouanement'], ['fc-entretien', 'expense', 'Entretien et réparations'],
  ['fc-impots', 'expense', 'Impôts et taxes'], ['fc-frais-mm', 'expense', 'Frais Mobile Money'], ['fc-divers', 'expense', 'Dépenses diverses'],
  ['fc-location', 'income', 'Location'], ['fc-prestations', 'income', 'Prestations'], ['fc-commissions', 'income', 'Commissions'], ['fc-autres', 'income', 'Autres revenus'],
];
/** Remet les catégories de dépenses et revenus par défaut (après une remise à l'état d'origine). */
export async function restoreDefaultFinance() {
  await save('financeCategories', DEFAULT_CATS.map(([id, kind, name], i) => ({ id, kind, name, order: i, active: true, deleted: false })));
}
export async function seedFinance() {
  await applyRemote(DEFAULT_CATS.map(([id, kind, name], i) => ({ tbl: 'financeCategories', id, data: { id, kind, name, order: i, active: true, createdAt: SEED, updatedAt: SEED } as BaseRecord })));
}

// ---------- Soldes ----------
const ACCOUNT_OF_METHOD: Record<PayMethod, AccountId> = { cash: 'cash', mvola: 'mvola', orange: 'orange', airtel: 'airtel' };
/** Argent reçu (ou rendu) directement par la boutique, compte par compte. */
function shopPayments(until?: string) {
  const out: { at: string; account: AccountId; amount: number; order: Order }[] = [];
  for (const o of all<Order>('orders')) for (const p of o.payments || []) {
    if (p.receivedBy !== 'shop' || (until && p.at > until)) continue;
    out.push({ at: p.at, account: ACCOUNT_OF_METHOD[p.method], amount: p.amount, order: o });
  }
  return out;
}
export function balances(until?: string): Record<AccountId, number> {
  const b = Object.fromEntries(ACCOUNT_IDS.map((a) => [a, 0])) as Record<AccountId, number>;
  for (const p of shopPayments(until)) b[p.account] += p.amount;
  for (const m of all<CashMove>('cashMoves')) if (!until || m.at <= until) b[m.account] = (b[m.account] || 0) + m.amount;
  return b;
}

/** Toutes les entrées et sorties d'argent (ventes comprises) pour l'historique d'un compte. */
export interface Flow { id: string; at: string; account: AccountId; amount: number; label: string; detail?: string; move?: CashMove; orderId?: string }
export function flows(from?: string, to?: string, account?: AccountId): Flow[] {
  const inR = (iso: string) => (!from || dayOf(iso) >= from) && (!to || dayOf(iso) <= to);
  const list: Flow[] = [];
  for (const o of all<Order>('orders')) for (const p of o.payments || []) {
    if (p.receivedBy !== 'shop' || !inR(p.at)) continue;
    const acc = ACCOUNT_OF_METHOD[p.method];
    if (account && acc !== account) continue;
    list.push({ id: p.id, at: p.at, account: acc, amount: p.amount, label: p.amount < 0 ? `Remboursement ${o.number}` : `${o.internal ? 'Vente interne' : isWalkIn(o) ? 'Vente' : 'Paiement'} ${o.number}`, detail: [o.name, p.ref, p.userName].filter(Boolean).join(' · '), orderId: o.id });
  }
  const cats = new Map(all<FinanceCategory>('financeCategories').map((c) => [c.id, c.name]));
  for (const m of all<CashMove>('cashMoves')) {
    if (!inR(m.at) || (account && m.account !== account)) continue;
    list.push({ id: m.id, at: m.at, account: m.account, amount: m.amount, label: m.label || (m.categoryId && cats.get(m.categoryId)) || MOVE_TYPES[m.type], detail: [m.categoryId && m.label ? cats.get(m.categoryId) : MOVE_TYPES[m.type], m.note, m.userName].filter(Boolean).join(' · '), move: m });
  }
  return list.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------- Opérations ----------
const who = () => currentUser()?.fullName;
export async function addMove(m: Omit<CashMove, 'id' | 'createdAt' | 'updatedAt' | 'userName'>) {
  if (m.type === 'expense' || m.type === 'income') assertOpenAt(m.at, m.type === 'expense' ? 'Dépense' : 'Revenu');
  const [r] = await save('cashMoves', { ...m, userName: who() });
  await audit(MOVE_TYPES[m.type], `${ACCOUNTS[m.account]} : ${m.amount > 0 ? '+' : ''}${m.amount} Ar${m.label ? ' — ' + m.label : ''}`, 'cashMoves', r.id);
  return r as CashMove;
}
export async function addTransfer(from: AccountId, to: AccountId, amount: number, at: string, note?: string, fee = 0) {
  const transferId = newId();
  const label = `${ACCOUNTS[from]} → ${ACCOUNTS[to]}`;
  await save('cashMoves', [
    { at, account: from, amount: -amount, type: 'transfer', transferId, label, note, userName: who() },
    { at, account: to, amount, type: 'transfer', transferId, label, note, userName: who() },
    ...(fee ? [{ at, account: from, amount: -fee, type: 'expense', categoryId: 'fc-frais-mm', label: `Frais de retrait ${ACCOUNTS[from]}`, transferId, userName: who() }] : []),
  ]);
  await audit('Virement entre comptes', `${label} : ${amount} Ar${fee ? ` (frais ${fee} Ar)` : ''}`, 'cashMoves', transferId);
}
export async function deleteMove(m: CashMove) {
  if (m.refType === 'payouts') throw new Error('Ce mouvement est un versement de la semaine : annulez-le depuis Récapitulatif → Semaine → Historique des versements.');
  if (m.type === 'expense' || m.type === 'income') assertOpenAt(m.at, 'Suppression');
  const linked = m.transferId ? all<CashMove>('cashMoves').filter((x) => x.transferId === m.transferId) : [m];
  for (const x of linked) await remove('cashMoves', x.id);
  await audit('Opération supprimée', `${MOVE_TYPES[m.type]} ${m.amount} Ar (${ACCOUNTS[m.account]})${m.label ? ' — ' + m.label : ''}`, 'cashMoves', m.id);
}

// ---------- Opérations récurrentes (loyer, salaires…) ----------
const monthsBetween = (start: string, end: string) => {
  const out: string[] = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) { out.push(`${y}-${pad(m)}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
};
/** Échéances arrivées et pas encore confirmées. */
export function dueRecurring(): { r: Recurring; period: string; date: string }[] {
  const t = today();
  const moves = all<CashMove>('cashMoves');
  const out: { r: Recurring; period: string; date: string }[] = [];
  for (const r of all<Recurring>('recurring')) {
    if (!r.active) continue;
    for (const period of monthsBetween(r.startMonth, t.slice(0, 7))) {
      const [y, m] = period.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      const date = `${period}-${pad(Math.min(r.day, last))}`;
      if (date > t || r.skipped?.includes(period)) continue;
      if (moves.some((x) => x.recurringId === r.id && x.period === period)) continue;
      out.push({ r, period, date });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export async function confirmRecurring(d: { r: Recurring; period: string; date: string }, amount: number, account: AccountId) {
  await addMove({ at: atFor(d.date), account, amount: d.r.kind === 'expense' ? -amount : amount, type: d.r.kind, categoryId: d.r.categoryId, label: d.r.label, recurringId: d.r.id, period: d.period });
}
export async function skipRecurring(d: { r: Recurring; period: string }) {
  await save('recurring', { id: d.r.id, skipped: [...(d.r.skipped || []), d.period] });
}

// ---------- Livreurs : compte et versements ----------
const CLOSED = ['delivered', 'partial', 'refused'];
/**
 * Ce qu'une livraison doit rapporter à la boutique par le livreur : argent encaissé auprès du client − frais du livreur.
 * Commande encore dehors : ce qu'il doit encaisser (reste à payer, frais compris) − ses frais prévus.
 */
export function deliveryNet(o: Order) {
  const x = courierSplit(o);
  return { collect: x.toCollect, clientPays: x.clientPays, fee: x.fee, feeOwed: x.feeOwed, net: x.net, done: x.closed };
}

/**
 * Compte d'un livreur. Seules les livraisons cochées au moment du versement sont réglées ;
 * les autres restent « en attente » et passent automatiquement au versement suivant.
 * carry = reste dû sur les versements précédents (+ : le livreur doit encore, − : la boutique lui doit).
 */
export function courierBalance(courierId: string, until?: string) {
  let carry = 0, pendingNet = 0, pendingCollect = 0, pendingFeeOwed = 0, outOrders = 0, outPieces = 0, collected = 0, fees = 0, settled = 0;
  const pending: Order[] = [];
  for (const o of all<Order>('orders')) {
    if (o.courierId !== courierId || o.status === 'cancelled' || !o.dispatchedAt || isPickupZone(o.zoneId)) continue;
    if (until && o.dispatchedAt > until) continue;
    const d = deliveryNet(o);
    const settledThen = o.courierSettledAt && (!until || o.courierSettledAt <= until);
    if (settledThen) carry += d.net;
    else { pending.push(o); pendingNet += d.net; pendingCollect += d.collect; pendingFeeOwed += d.feeOwed; }
    if (o.status === 'out') { outOrders++; outPieces += o.lines.reduce((t, l) => t + l.qty, 0); }
    if (d.done) { collected += d.collect; fees += d.fee; }
  }
  for (const s of all<CourierSettlement>('courierSettlements')) if (s.courierId === courierId && (!until || s.at <= until)) settled += s.amount;
  carry -= settled;
  return { carry, pendingNet, pendingCollect, pendingFeeOwed, due: carry + pendingNet, pending: pending.sort((a, b) => (a.dispatchedAt || '').localeCompare(b.dispatchedAt || '')), outOrders, outPieces, collected, fees, settled };
}

/**
 * Versement d'un livreur : seules les livraisons cochées sont réglées. Une commande cochée encore « en livraison »
 * (sans articles en choix) est marquée livrée : le client a payé au livreur tout ce qui restait.
 * amount + : le livreur remet l'argent ; − : la boutique lui verse ses frais.
 */
export async function settleCourier(c: Courier, orderIds: string[], amount: number, account: AccountId, note?: string) {
  const blocked = orderIds.map((id) => get<Order>('orders', id)).filter((o): o is Order => !!o && o.status === 'out' && o.lines.some((l) => l.isChoice));
  if (blocked.length) throw new Error(`Choix du client à préciser avant le versement : ${blocked.map((o) => o.number).join(', ')}`);
  for (const id of orderIds) {
    const o = get<Order>('orders', id);
    if (o && o.status === 'out' && !o.lines.some((l) => l.isChoice)) {
      await recordReturn(o, { kept: Object.fromEntries(o.lines.map((l) => [l.id, l.qty])), feeCharged: o.deliveryFee || 0, collected: remaining(o) > 0 ? [{ amount: remaining(o), method: 'cash' }] : [], note: 'Livrée (cochée au versement)' });
    }
  }
  const before = courierBalance(c.id);
  const checked = orderIds.map((id) => get<Order>('orders', id)!).filter(Boolean);
  const expected = before.carry + checked.reduce((t, o) => t + deliveryNet(o).net, 0);
  const at = bizNow();
  const [s] = await save('courierSettlements', { courierId: c.id, at, amount, account, balanceBefore: expected, orderIds, note, userName: who() });
  if (amount) await save('cashMoves', { at, account, amount, type: 'courier_settlement', label: `${amount > 0 ? 'Versement de' : 'Frais versés à'} ${c.name}`, note, refType: 'courierSettlements', refId: s.id, userName: who() });
  // Les commandes réglées ne peuvent plus changer de livreur.
  if (orderIds.length) await save('orders', orderIds.map((id) => ({ id, courierSettledAt: at })));
  await audit('Versement livreur', `${c.name} : ${amount >= 0 ? 'remis ' + amount : 'versé ' + -amount} Ar (${ACCOUNTS[account]}) — attendu ${expected} Ar, ${orderIds.length} livraison(s) cochée(s)`, 'courierSettlements', s.id);
  return s as CourierSettlement;
}

// ---------- Récapitulatif d'une journée ou d'une semaine ----------
export interface DeliveryRow { o: Order; courierId: string; value: number; collect: number; clientPays: number; fee: number; feeOwed: number; net: number; done: boolean; settled: boolean }
export interface CourierRow { courierId: string; name: string; count: number; value: number; collect: number; clientPays: number; fees: number; feeOwed: number; net: number; delivered: number; refused: number; out: number; paidIn: number; carry: number; pending: number; balance: number }
export interface Report {
  from: string; to: string;
  sales: { count: number; amount: number; shopCount: number; shopAmount: number; onlineCount: number; onlineAmount: number; internalCount: number; internalAmount: number };
  returns: { count: number; amount: number };
  netSales: number; cost: number; grossProfit: number;
  walkIns: Order[];
  deliveries: DeliveryRow[];
  couriers: CourierRow[];
  expenses: number; expensesByCat: { name: string; amount: number }[]; expenseMoves: CashMove[];
  incomes: number; otherMoves: CashMove[];
  receipts: Record<AccountId, number>;        // reçu directement par la boutique (ventes sur place, acomptes, mobile money…)
  fromCouriers: Record<AccountId, number>;    // versements des livreurs
  collectedByCouriers: number;
  courierFees: number;
  courierDue: number;                          // total à verser par les livreurs en fin de période
  balancesEnd: Record<AccountId, number>;
}
/** Compatibilité : ancien nom. */
export type DayStats = Report;

const costOf = (variantId: string) => { const v = get<Variant>('variants', variantId); return v ? variantCost(v) : 0; };

/**
 * Règle de comptage : les articles partis avec un livreur (hors « choix ») sont vendus le jour du départ.
 * Ce qui revient ensuite est un « retour » le jour du retour ; les choix gardés sont vendus le jour du retour.
 */
export function report(from: string, to: string): Report {
  const z = () => Object.fromEntries(ACCOUNT_IDS.map((a) => [a, 0])) as Record<AccountId, number>;
  const inR = (iso?: string) => { if (!iso) return false; const d = dayOf(iso); return d >= from && d <= to; };
  const s: Report = {
    from, to, sales: { count: 0, amount: 0, shopCount: 0, shopAmount: 0, onlineCount: 0, onlineAmount: 0, internalCount: 0, internalAmount: 0 }, returns: { count: 0, amount: 0 },
    netSales: 0, cost: 0, grossProfit: 0, walkIns: [], deliveries: [], couriers: [], expenses: 0, expensesByCat: [], expenseMoves: [], incomes: 0, otherMoves: [],
    receipts: z(), fromCouriers: z(), collectedByCouriers: 0, courierFees: 0, courierDue: 0, balancesEnd: z(),
  };
  const addSale = (o: Order, amount: number, cost: number, count: boolean) => {
    s.sales.amount += amount; s.cost += cost;
    if (o.internal) { s.sales.internalAmount += amount; if (count) s.sales.internalCount++; }
    if (isWalkIn(o) || o.pickedUp) { s.sales.shopAmount += amount; if (count) s.sales.shopCount++; } else { s.sales.onlineAmount += amount; if (count) s.sales.onlineCount++; }
    if (count) s.sales.count++;
  };
  for (const o of all<Order>('orders')) {
    if (isWalkIn(o)) {
      if (o.status !== 'cancelled' && inR(o.createdAt)) { addSale(o, keptTotal(o) - (o.discount || 0), o.lines.reduce((t, l) => t + (l.qtyKept ?? l.qty) * costOf(l.variantId), 0), true); s.walkIns.push(o); }
      continue;
    }
    if (!o.dispatchedAt) continue;
    const nonChoice = sellingLines(o);
    if (inR(o.dispatchedAt)) {
      const value = nonChoice.reduce((t, l) => t + l.qty * l.unitPrice, 0) - (o.discount || 0);
      addSale(o, value, nonChoice.reduce((t, l) => t + l.qty * costOf(l.variantId), 0), true);
      if (o.pickedUp && o.status !== 'cancelled') s.walkIns.push(o);
      else if (o.status !== 'cancelled') { const d = deliveryNet(o); s.deliveries.push({ o, courierId: isPickupZone(o.zoneId) ? '' : o.courierId || '', value, ...d, settled: !!o.courierSettledAt }); }
    }
    const back = o.status === 'cancelled' ? o.statusDates?.cancelled : o.returnedAt;
    if (inR(back)) {
      let ret = 0, retCost = 0;
      if (o.status === 'cancelled') { ret = nonChoice.reduce((t, l) => t + l.qty * l.unitPrice, 0) - (o.discount || 0); retCost = nonChoice.reduce((t, l) => t + l.qty * costOf(l.variantId), 0); }
      else {
        for (const l of o.lines) {
          if (l.isChoice) { const k = l.qtyKept ?? 0; if (k) addSale(o, k * l.unitPrice, k * costOf(l.variantId), false); }
          else { const r = l.qtyReturned ?? 0; ret += r * l.unitPrice; retCost += r * costOf(l.variantId); }
        }
        for (const rl of o.returnLines || []) { ret += rl.qty * rl.unitPrice; retCost += rl.qty * costOf(rl.variantId); }
        if (o.credit && !(o.returnLines || []).length) ret += o.credit;
        s.courierFees += o.feeCharged ?? 0;
      }
      if (ret) { s.returns.amount += ret; s.cost -= retCost; s.returns.count++; }
    }
  }
  s.netSales = s.sales.amount - s.returns.amount;
  s.grossProfit = s.netSales - s.cost;

  for (const o of all<Order>('orders')) for (const p of o.payments || []) {
    if (!inR(p.at)) continue;
    if (p.receivedBy === 'shop') s.receipts[ACCOUNT_OF_METHOD[p.method]] += p.amount;
    else s.collectedByCouriers += p.amount;
  }
  const cats = new Map(all<FinanceCategory>('financeCategories').map((c) => [c.id, c.name]));
  const byCat = new Map<string, number>();
  const paidIn = new Map<string, number>();
  for (const st of all<CourierSettlement>('courierSettlements')) if (inR(st.at)) paidIn.set(st.courierId, (paidIn.get(st.courierId) ?? 0) + st.amount);
  for (const m of all<CashMove>('cashMoves').sort((a, b) => a.at.localeCompare(b.at))) {
    if (!inR(m.at)) continue;
    if (m.type === 'expense') { s.expenses += -m.amount; s.expenseMoves.push(m); const n = (m.categoryId && cats.get(m.categoryId)) || 'Sans catégorie'; byCat.set(n, (byCat.get(n) ?? 0) - m.amount); }
    else if (m.type === 'courier_settlement') { if (m.amount > 0) s.fromCouriers[m.account] += m.amount; }
    else { if (m.type === 'income') s.incomes += m.amount; if (!(m.type === 'transfer' && m.amount > 0)) s.otherMoves.push(m); }
  }
  s.expensesByCat = [...byCat.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const end = endOf(to);
  for (const c of all<Courier>('couriers')) {
    const mine = s.deliveries.filter((d) => d.courierId === c.id);
    const b = courierBalance(c.id, end);
    if (!mine.length && !b.due && !paidIn.get(c.id) && !b.outOrders) continue;
    s.couriers.push({
      courierId: c.id, name: c.name, count: mine.length, value: mine.reduce((t, d) => t + d.value, 0), collect: mine.reduce((t, d) => t + d.collect, 0),
      clientPays: mine.reduce((t, d) => t + d.clientPays, 0), fees: mine.reduce((t, d) => t + d.fee, 0), feeOwed: mine.reduce((t, d) => t + d.feeOwed, 0), net: mine.reduce((t, d) => t + d.net, 0),
      delivered: mine.filter((d) => ['delivered', 'partial'].includes(d.o.status)).length, refused: mine.filter((d) => d.o.status === 'refused').length, out: mine.filter((d) => d.o.status === 'out').length,
      paidIn: paidIn.get(c.id) ?? 0, carry: b.carry, pending: b.pendingNet, balance: b.due,
    });
    s.courierDue += Math.max(0, b.due);
  }
  s.couriers.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  s.balancesEnd = balances(end);
  return s;
}
export const dayStats = (date: string) => report(date, date);

/** Lundi de la semaine d'une date (AAAA-MM-JJ). */
export function mondayOf(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayOf(d.toISOString());
}
export function addDays(ymd: string, n: number) { const d = new Date(`${ymd}T12:00:00`); d.setDate(d.getDate() + n); return dayOf(d.toISOString()); }
