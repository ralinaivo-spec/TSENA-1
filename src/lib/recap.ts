// Récapitulatifs pour le responsable : journée et semaine (lundi → samedi).
// Le même contenu sert à l'écran, au message (WhatsApp, SMS, e-mail) et au ticket imprimé.
import { fmtAr, fmtNum } from './catalog';
import { ACCOUNTS, MOVE_TYPES, addDays, report, type AccountId, type Report } from './money';
import type { Company } from './settings';
import type { Block, PrintDoc } from './print/doc';

export interface Line { label: string; value: string; strong?: boolean; sub?: boolean }
export interface Section { title: string; lines: Line[] }

const MM: AccountId[] = ['mvola', 'orange', 'airtel'];
export const longDate = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const neg = (n: number) => (n ? '− ' + fmtAr(n) : fmtAr(0));
const sum = (r: Record<AccountId, number>, ids: AccountId[]) => ids.reduce((t, a) => t + (r[a] || 0), 0);

/** Les grands totaux d'une période. */
export function totals(r: Report) {
  const delivValue = r.deliveries.reduce((t, d) => t + d.value, 0);
  return {
    walkIn: r.sales.shopAmount, walkInCount: r.sales.shopCount,
    deliv: delivValue, delivCount: r.deliveries.length,
    delivNet: r.deliveries.filter((d) => d.courierId).reduce((t, d) => t + d.net, 0),
    totalSales: r.sales.amount,
    cashIn: r.receipts.cash, mmIn: sum(r.receipts, MM), bankIn: r.receipts.bank,
    fromCouriers: sum(r.fromCouriers, ['cash', 'mvola', 'orange', 'airtel', 'bank']),
    expenses: r.expenses,
  };
}

function common(r: Report, withProfit: boolean): Section[] {
  const t = totals(r);
  const out: Section[] = [];
  out.push({ title: 'Ventes', lines: [
    { label: `Ventes sur place (${t.walkInCount})`, value: fmtAr(t.walkIn) },
    { label: `Livraisons (${t.delivCount})`, value: fmtAr(t.deliv) },
    ...(r.returns.amount ? [{ label: `Retours (${r.returns.count})`, value: neg(r.returns.amount) }] : []),
    { label: 'Total des ventes', value: fmtAr(r.netSales), strong: true },
    { label: 'Info : frais des livreurs (non compris)', value: fmtAr(r.deliveries.reduce((a, d) => a + d.fee, 0)), sub: true },
    { label: 'Info : total payé par les clients livrés (frais compris)', value: fmtAr(r.deliveries.reduce((a, d) => a + d.clientPays, 0)), sub: true },
  ] });
  out.push({ title: 'Comptes livreurs', lines: r.couriers.length ? [
    ...r.couriers.map((c) => ({ label: `${c.name} : ${c.count} livraison(s)${c.out ? `, ${c.out} pas encore confirmée(s)` : ''}`, value: `à encaisser ${fmtAr(c.collect)}` })),
    ...r.couriers.filter((c) => c.feeOwed).map((c) => ({ label: `Frais à reverser à ${c.name} (payés par Mobile Money)`, value: fmtAr(c.feeOwed), sub: true })),
    ...r.couriers.filter((c) => c.paidIn).map((c) => ({ label: `Versé par ${c.name}`, value: fmtAr(c.paidIn), sub: true })),
    { label: 'Total à verser par les livreurs (compte à ce jour)', value: fmtAr(r.courierDue), strong: true },
  ] : [{ label: 'Aucune livraison', value: '—' }] });
  out.push({ title: 'Paiements reçus', lines: [
    { label: 'Espèces (boutique)', value: fmtAr(r.receipts.cash), sub: true },
    ...MM.map((a) => ({ label: ACCOUNTS[a], value: fmtAr(r.receipts[a]), sub: true })),
    ...(r.receipts.bank ? [{ label: 'Banque', value: fmtAr(r.receipts.bank), sub: true }] : []),
    { label: 'Versements des livreurs', value: fmtAr(t.fromCouriers), sub: true },
    { label: 'Total reçu', value: fmtAr(t.cashIn + t.mmIn + t.bankIn + t.fromCouriers), strong: true },
  ] });
  out.push({ title: 'Dépenses et autres mouvements', lines: [
    ...r.expensesByCat.map((e) => ({ label: e.name, value: neg(e.amount), sub: true })),
    { label: 'Total dépenses', value: neg(r.expenses), strong: true },
    ...r.otherMoves.map((m) => ({ label: `${m.label || MOVE_TYPES[m.type]} (${ACCOUNTS[m.account]})`, value: (m.amount > 0 ? '+ ' : '− ') + fmtAr(Math.abs(m.amount)), sub: true })),
  ] });
  if (withProfit) out.push({ title: 'Bénéfice', lines: [
    { label: 'Bénéfice brut (ventes − coût des articles)', value: fmtAr(r.grossProfit) },
    { label: 'Résultat (bénéfice − dépenses + autres revenus)', value: fmtAr(r.grossProfit - r.expenses + r.incomes), strong: true },
  ] });
  out.push({ title: 'Soldes en fin de période', lines: [
    { label: 'Caisse espèces', value: fmtAr(r.balancesEnd.cash), strong: true },
    ...MM.filter((a) => r.balancesEnd[a]).map((a) => ({ label: ACCOUNTS[a], value: fmtAr(r.balancesEnd[a]), sub: true })),
    ...(r.balancesEnd.bank ? [{ label: 'Banque', value: fmtAr(r.balancesEnd.bank), sub: true }] : []),
    { label: 'Espèces attendues (caisse + à verser par les livreurs)', value: fmtAr(r.balancesEnd.cash + r.courierDue), strong: true },
  ] });
  return out;
}

export const daySections = (r: Report, withProfit: boolean) => common(r, withProfit);

/** Semaine : une ligne par jour, puis les totaux de la semaine. */
export interface WeekDay { date: string; r: Report; t: ReturnType<typeof totals> }
export function weekDays(monday: string): WeekDay[] {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return days.map((d) => { const r = report(d, d); return { date: d, r, t: totals(r) }; })
    .filter((x, i) => i < 6 || x.t.walkInCount || x.t.delivCount || x.r.expenses || x.t.cashIn || x.t.mmIn); // dimanche seulement s'il y a eu de l'activité
}
export function weekSections(r: Report, days: WeekDay[], withProfit: boolean): Section[] {
  const perDay: Section = { title: 'Jour par jour', lines: days.map((d) => ({ label: `${shortDay(d.date)} : sur place ${fmtAr(d.t.walkIn)} · livraisons ${fmtAr(d.t.deliv)} · dépenses ${fmtAr(d.t.expenses)}`, value: fmtAr(d.r.netSales) })) };
  return [perDay, ...common(r, withProfit)];
}

// ---------- Texte à envoyer ----------
function toText(head: string[], sections: Section[]) {
  const out = [...head, ''];
  for (const s of sections) {
    out.push(`*${s.title}*`);
    for (const l of s.lines) out.push(`${l.sub ? '   • ' : '• '}${l.label} : ${l.strong ? '*' + l.value + '*' : l.value}`);
    out.push('');
  }
  return out.join('\n').replace(/[  ]/g, ' ').replace(/\*\*/g, '').trim();
}
export function dayText(r: Report, company: Company, withProfit: boolean) {
  return toText([`*${company.name} — Récapitulatif du ${longDate(r.from)}*`], daySections(r, withProfit));
}
export function weekText(r: Report, days: WeekDay[], company: Company, withProfit: boolean) {
  return toText([`*${company.name} — Récapitulatif de la semaine*`, `du ${longDate(r.from)} au ${longDate(r.to)}`], weekSections(r, days, withProfit));
}

// ---------- Ticket imprimé ----------
export function sectionsDoc(title: string, sub: string, sections: Section[], company: Company): PrintDoc {
  const b: Block[] = [
    { k: 'text', s: company.name, align: 'center', bold: true, big: true },
    { k: 'text', s: title.toUpperCase(), align: 'center', bold: true },
    { k: 'text', s: sub, align: 'center' },
  ];
  for (const s of sections) {
    b.push({ k: 'line' }, { k: 'text', s: s.title.toUpperCase(), bold: true });
    for (const l of s.lines) b.push({ k: 'pair', l: (l.sub ? '  ' : '') + l.label, r: l.value, bold: l.strong });
  }
  b.push({ k: 'line', ch: '=' }, { k: 'feed', n: 2 });
  return { title: `${title} ${sub}`, blocks: b };
}
export { fmtNum };
