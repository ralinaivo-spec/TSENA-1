// Trésorerie : comptes (caisse, mobile money, banque), mouvements, dépenses et revenus, règlements des
// livreurs, chiffres d'une journée et clôture (« Z de caisse »).
import { all, applyRemote, get, newId, nowIso, remove, save, type BaseRecord } from './db';
import { audit, currentUser } from './auth';
import { variantCost, type Variant } from './catalog';
import { isWalkIn, keptTotal, sellingLines, type Courier, type Order, type PayMethod } from './orders';

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
export interface Closing extends BaseRecord {
  date: string;
  cash: { notes: Record<string, number>; coins: number; counted: number; theoretical: number; gap: number; reason?: string };
  mobile: Partial<Record<AccountId, { theoretical: number; actual?: number; gap?: number }>>;
  stats: DayStats;
  courierDue: { courierId: string; name: string; due: number; outOrders: number; outPieces: number }[];
  gapMoveIds: string[];
  closedBy?: string;
  closedAt: string;
}

/** Billets et pièces de l'Ariary pour le comptage de la caisse. */
export const NOTES = [20000, 10000, 5000, 2000, 1000, 500, 200, 100];

// ---------- Dates (heure de Madagascar = heure de l'appareil) ----------
const pad = (n: number) => String(n).padStart(2, '0');
export const dayOf = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const today = () => dayOf(new Date().toISOString());
/** Fin de journée locale (pour les soldes « au soir du … »). */
export const endOf = (ymd: string) => new Date(`${ymd}T23:59:59.999`).toISOString();
/** Heure pour une opération saisie à une date : maintenant si c'est aujourd'hui, sinon midi ce jour-là. */
export const atFor = (ymd: string) => (ymd === today() ? nowIso() : new Date(`${ymd}T12:00:00`).toISOString());

// ---------- Catégories par défaut (identifiants fixes, identiques sur tous les appareils) ----------
const SEED = '2000-01-01T00:00:00.000Z';
const DEFAULT_CATS: [string, 'expense' | 'income', string][] = [
  ['fc-loyer', 'expense', 'Loyer'], ['fc-salaires', 'expense', 'Salaires'], ['fc-jirama', 'expense', 'Électricité et eau (JIRAMA)'],
  ['fc-internet', 'expense', 'Internet et crédit téléphone'], ['fc-transport', 'expense', 'Carburant et transport'], ['fc-pub', 'expense', 'Publicité Facebook'],
  ['fc-emballage', 'expense', 'Emballage'], ['fc-transit', 'expense', 'Transit et dédouanement'], ['fc-entretien', 'expense', 'Entretien et réparations'],
  ['fc-impots', 'expense', 'Impôts et taxes'], ['fc-frais-mm', 'expense', 'Frais Mobile Money'], ['fc-divers', 'expense', 'Dépenses diverses'],
  ['fc-location', 'income', 'Location'], ['fc-prestations', 'income', 'Prestations'], ['fc-commissions', 'income', 'Commissions'], ['fc-autres', 'income', 'Autres revenus'],
];
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
    list.push({ id: p.id, at: p.at, account: acc, amount: p.amount, label: p.amount < 0 ? `Remboursement ${o.number}` : `${isWalkIn(o) ? 'Vente' : 'Paiement'} ${o.number}`, detail: [o.name, p.ref, p.userName].filter(Boolean).join(' · '), orderId: o.id });
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

// ---------- Livreurs : solde et règlements ----------
/** Solde d'un livreur à une date : argent encaissé − frais gagnés − règlements (+ : il doit à la boutique). */
export function courierBalance(courierId: string, until?: string) {
  let collected = 0, fees = 0, settled = 0, outOrders = 0, outPieces = 0;
  const unsettled: Order[] = [];
  for (const o of all<Order>('orders')) {
    if (o.courierId !== courierId) continue;
    for (const p of o.payments || []) if (p.receivedBy === 'courier' && p.courierId === courierId && (!until || p.at <= until)) collected += p.amount;
    const closed = ['delivered', 'partial', 'refused'].includes(o.status);
    if (closed && o.returnedAt && (!until || o.returnedAt <= until)) fees += o.feeCharged ?? 0;
    if (o.status === 'out') { outOrders++; outPieces += o.lines.reduce((s, l) => s + l.qty, 0); }
    if (!o.courierSettledAt && (closed || (o.payments || []).some((p) => p.receivedBy === 'courier'))) unsettled.push(o);
  }
  for (const s of all<CourierSettlement>('courierSettlements')) if (s.courierId === courierId && (!until || s.at <= until)) settled += s.amount;
  return { collected, fees, settled, due: collected - fees - settled, outOrders, outPieces, unsettled };
}

/** Règlement : le livreur remet l'argent (montant +) ou la boutique lui verse ses frais (montant −). */
export async function settleCourier(c: Courier, amount: number, account: AccountId, note?: string) {
  const b = courierBalance(c.id);
  const at = nowIso();
  const orderIds = b.unsettled.filter((o) => ['delivered', 'partial', 'refused'].includes(o.status)).map((o) => o.id);
  const [s] = await save('courierSettlements', { courierId: c.id, at, amount, account, balanceBefore: b.due, orderIds, note, userName: who() });
  if (amount) await save('cashMoves', { at, account, amount, type: 'courier_settlement', label: `${amount > 0 ? 'Remise de' : 'Frais versés à'} ${c.name}`, note, refType: 'courierSettlements', refId: s.id, userName: who() });
  // Les commandes terminées et réglées ne peuvent plus changer de livreur.
  if (orderIds.length) await save('orders', orderIds.map((id) => ({ id, courierSettledAt: at })));
  await audit('Règlement livreur', `${c.name} : ${amount >= 0 ? 'remis ' + amount : 'versé ' + -amount} Ar (${ACCOUNTS[account]}) — solde avant ${b.due} Ar, ${orderIds.length} commande(s)`, 'courierSettlements', s.id);
  return s as CourierSettlement;
}

// ---------- Chiffres d'une journée ----------
export interface DayStats {
  date: string;
  sales: { count: number; amount: number; shopCount: number; shopAmount: number; onlineCount: number; onlineAmount: number };
  returns: { count: number; amount: number };
  netSales: number;
  cost: number;
  grossProfit: number;
  expenses: number;
  expensesByCat: { name: string; amount: number }[];
  incomes: number;
  receipts: Record<AccountId, number>;        // encaissé directement par la boutique (ventes, acomptes…)
  fromCouriers: Record<AccountId, number>;    // remis par les livreurs (règlements)
  collectedByCouriers: number;                 // encaissé par les livreurs ce jour (pas encore forcément remis)
  courierFees: number;                         // frais de livraison gagnés par les livreurs (hors chiffre d'affaires)
  courierDue: number;                          // reste à recevoir des livreurs en fin de journée
  balancesEnd: Record<AccountId, number>;
}

const costOf = (variantId: string) => { const v = get<Variant>('variants', variantId); return v ? variantCost(v) : 0; };

/**
 * Règle de clôture : les articles partis avec un livreur (hors « choix ») sont vendus le jour du départ.
 * Ce qui revient ensuite est un « retour » le jour du retour ; les choix gardés sont vendus le jour du retour.
 */
export function dayStats(date: string): DayStats {
  const z = () => Object.fromEntries(ACCOUNT_IDS.map((a) => [a, 0])) as Record<AccountId, number>;
  const s: DayStats = {
    date, sales: { count: 0, amount: 0, shopCount: 0, shopAmount: 0, onlineCount: 0, onlineAmount: 0 }, returns: { count: 0, amount: 0 },
    netSales: 0, cost: 0, grossProfit: 0, expenses: 0, expensesByCat: [], incomes: 0, receipts: z(), fromCouriers: z(), collectedByCouriers: 0, courierFees: 0, courierDue: 0, balancesEnd: z(),
  };
  const addSale = (o: Order, amount: number, cost: number, count: boolean) => {
    s.sales.amount += amount; s.cost += cost;
    if (isWalkIn(o)) { s.sales.shopAmount += amount; if (count) s.sales.shopCount++; } else { s.sales.onlineAmount += amount; if (count) s.sales.onlineCount++; }
    if (count) s.sales.count++;
  };
  let returnedOrders = 0;
  for (const o of all<Order>('orders')) {
    if (isWalkIn(o)) {
      if (o.status !== 'cancelled' && dayOf(o.createdAt) === date) addSale(o, keptTotal(o) - (o.discount || 0), o.lines.reduce((t, l) => t + (l.qtyKept ?? l.qty) * costOf(l.variantId), 0), true);
      continue;
    }
    if (!o.dispatchedAt) continue;
    const nonChoice = sellingLines(o);
    if (dayOf(o.dispatchedAt) === date) addSale(o, nonChoice.reduce((t, l) => t + l.qty * l.unitPrice, 0) - (o.discount || 0), nonChoice.reduce((t, l) => t + l.qty * costOf(l.variantId), 0), true);
    const back = o.status === 'cancelled' ? o.statusDates?.cancelled : o.returnedAt;
    if (back && dayOf(back) === date) {
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
      if (ret) { s.returns.amount += ret; s.cost -= retCost; returnedOrders++; }
    }
  }
  s.returns.count = returnedOrders;
  s.netSales = s.sales.amount - s.returns.amount;
  s.grossProfit = s.netSales - s.cost;

  for (const o of all<Order>('orders')) for (const p of o.payments || []) {
    if (dayOf(p.at) !== date) continue;
    if (p.receivedBy === 'shop') s.receipts[ACCOUNT_OF_METHOD[p.method]] += p.amount;
    else s.collectedByCouriers += p.amount;
  }
  const cats = new Map(all<FinanceCategory>('financeCategories').map((c) => [c.id, c.name]));
  const byCat = new Map<string, number>();
  for (const m of all<CashMove>('cashMoves')) {
    if (dayOf(m.at) !== date) continue;
    if (m.type === 'expense') { s.expenses += -m.amount; const n = (m.categoryId && cats.get(m.categoryId)) || 'Sans catégorie'; byCat.set(n, (byCat.get(n) ?? 0) - m.amount); }
    if (m.type === 'income') s.incomes += m.amount;
    if (m.type === 'courier_settlement' && m.amount > 0) s.fromCouriers[m.account] += m.amount;
  }
  s.expensesByCat = [...byCat.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const end = endOf(date);
  for (const c of all<Courier>('couriers')) s.courierDue += Math.max(0, courierBalance(c.id, end).due);
  s.balancesEnd = balances(end);
  return s;
}

// ---------- Clôture ----------
export const closingId = (date: string) => `closing-${date}`;
export const getClosing = (date: string) => get<Closing>('closings', closingId(date));
export const isClosedDay = (date: string) => !!getClosing(date);

export async function closeDay(date: string, d: { notes: Record<string, number>; coins: number; reason?: string; mobileActual: Partial<Record<AccountId, number | undefined>> }) {
  const at = date === today() ? nowIso() : endOf(date);
  const before = dayStats(date);
  const counted = NOTES.reduce((t, n) => t + n * (d.notes[n] || 0), 0) + (d.coins || 0);
  const theoretical = before.balancesEnd.cash;
  const gap = counted - theoretical;
  const gapMoveIds: string[] = [];
  if (gap) gapMoveIds.push((await addMove({ at, account: 'cash', amount: gap, type: 'gap', label: `Écart de caisse du ${date.split('-').reverse().join('/')}`, note: d.reason })).id);
  const mobile: Closing['mobile'] = {};
  for (const a of ['mvola', 'orange', 'airtel', 'bank'] as AccountId[]) {
    const th = before.balancesEnd[a];
    const actual = d.mobileActual[a];
    const g = actual == null ? undefined : actual - th;
    if (g) gapMoveIds.push((await addMove({ at, account: a, amount: g, type: 'gap', label: `Écart ${ACCOUNTS[a]} du ${date.split('-').reverse().join('/')}`, note: d.reason })).id);
    if (th || actual != null) mobile[a] = { theoretical: th, actual, gap: g };
  }
  const courierDue = all<Courier>('couriers').map((c) => { const b = courierBalance(c.id, endOf(date)); return { courierId: c.id, name: c.name, due: b.due, outOrders: b.outOrders, outPieces: b.outPieces }; }).filter((x) => x.due || x.outOrders);
  const stats = dayStats(date);
  await save('closings', { id: closingId(date), date, cash: { notes: d.notes, coins: d.coins, counted, theoretical, gap, reason: d.reason }, mobile, stats, courierDue, gapMoveIds, closedBy: who(), closedAt: nowIso() });
  await audit('Clôture de journée', `${date} : caisse comptée ${counted} Ar (écart ${gap} Ar)`, 'closings', closingId(date));
}
export async function reopenDay(date: string, reason: string) {
  const c = getClosing(date);
  if (!c) return;
  for (const id of c.gapMoveIds || []) await remove('cashMoves', id);
  await remove('closings', c.id);
  await audit('Journée rouverte', `${date} : ${reason}`, 'closings', c.id);
}
