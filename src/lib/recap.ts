// Récapitulatif de la journée pour le patron : texte court à envoyer (WhatsApp, SMS, e-mail) ou à imprimer.
import { fmtAr } from './catalog';
import { ACCOUNTS, type AccountId, type Closing, type DayStats } from './money';
import type { Company } from './settings';
import type { PrintDoc, Block } from './print/doc';

const longDate = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const MAIN: AccountId[] = ['cash', 'mvola', 'orange', 'airtel', 'bank'];

interface Line { label: string; value: string; strong?: boolean; sub?: boolean }
function recapLines(s: DayStats, c: Closing | undefined, withProfit: boolean): { title: string; lines: Line[] }[] {
  const recv = (a: AccountId) => s.receipts[a] + s.fromCouriers[a];
  const sections: { title: string; lines: Line[] }[] = [
    { title: 'Ventes', lines: [
      { label: `Ventes (${s.sales.count})`, value: fmtAr(s.sales.amount), strong: true },
      { label: `Boutique (${s.sales.shopCount})`, value: fmtAr(s.sales.shopAmount), sub: true },
      { label: `En ligne (${s.sales.onlineCount})`, value: fmtAr(s.sales.onlineAmount), sub: true },
      { label: `Retours (${s.returns.count})`, value: s.returns.amount ? '− ' + fmtAr(s.returns.amount) : fmtAr(0) },
      { label: 'Ventes nettes', value: fmtAr(s.netSales), strong: true },
    ] },
    { title: 'Argent', lines: [
      { label: 'Dépenses', value: s.expenses ? '− ' + fmtAr(s.expenses) : fmtAr(0) },
      ...(s.incomes ? [{ label: 'Autres revenus', value: fmtAr(s.incomes) }] : []),
      ...(withProfit ? [{ label: 'Bénéfice brut (ventes − coût des articles)', value: fmtAr(s.grossProfit), strong: true }, { label: 'Résultat du jour (bénéfice − dépenses + revenus)', value: fmtAr(s.grossProfit - s.expenses + s.incomes), strong: true }] : []),
    ] },
    { title: 'Encaissements', lines: [
      ...MAIN.filter((a) => a !== 'bank' || recv(a)).map((a) => ({ label: ACCOUNTS[a], value: fmtAr(recv(a)), sub: true })),
      { label: 'Total encaissé', value: fmtAr(MAIN.reduce((t, a) => t + recv(a), 0)), strong: true },
      { label: 'Encaissé par les livreurs ce jour', value: fmtAr(s.collectedByCouriers) },
      { label: 'Reste à recevoir des livreurs', value: fmtAr(s.courierDue), strong: true },
    ] },
    { title: 'Soldes en fin de journée', lines: [
      { label: c ? `Caisse (comptée${c.cash.gap ? `, écart ${c.cash.gap > 0 ? '+' : '−'}${fmtAr(Math.abs(c.cash.gap))}` : ''})` : 'Caisse (théorique)', value: fmtAr(c ? c.cash.counted : s.balancesEnd.cash), strong: true },
      ...(['mvola', 'orange', 'airtel', 'bank'] as AccountId[]).filter((a) => s.balancesEnd[a] || c?.mobile[a]).map((a) => ({ label: ACCOUNTS[a], value: fmtAr(c?.mobile[a]?.actual ?? s.balancesEnd[a]), sub: true })),
    ] },
  ];
  return sections;
}

export function recapText(s: DayStats, c: Closing | undefined, company: Company, withProfit: boolean) {
  const out = [`*${company.name} — Récap du ${longDate(s.date)}*`, c ? `Journée clôturée par ${c.closedBy ?? '—'}` : 'Journée non clôturée (chiffres provisoires)', ''];
  for (const sec of recapLines(s, c, withProfit)) {
    out.push(`*${sec.title}*`);
    for (const l of sec.lines) out.push(`${l.sub ? '   • ' : '• '}${l.label} : ${l.value}`);
    out.push('');
  }
  if (c?.courierDue.length) {
    out.push('*Chez les livreurs*');
    for (const x of c.courierDue) out.push(`• ${x.name} : ${x.due > 0 ? 'doit ' + fmtAr(x.due) : x.due < 0 ? 'à lui verser ' + fmtAr(-x.due) : '0 Ar'}${x.outOrders ? ` · ${x.outOrders} commande(s) dehors` : ''}`);
    out.push('');
  }
  if (c?.cash.reason) out.push(`Écart de caisse : ${c.cash.reason}`);
  return out.join('\n').replace(/[  ]/g, ' ').trim();
}

export function recapDoc(s: DayStats, c: Closing | undefined, company: Company, withProfit: boolean): PrintDoc {
  const b: Block[] = [
    { k: 'text', s: company.name, align: 'center', bold: true, big: true },
    { k: 'text', s: 'RÉCAPITULATIF DU JOUR', align: 'center', bold: true },
    { k: 'text', s: longDate(s.date), align: 'center' },
    { k: 'text', s: c ? `Clôturée par ${c.closedBy ?? '-'}` : 'Non clôturée (provisoire)', align: 'center' },
  ];
  for (const sec of recapLines(s, c, withProfit)) {
    b.push({ k: 'line' }, { k: 'text', s: sec.title.toUpperCase(), bold: true });
    for (const l of sec.lines) b.push({ k: 'pair', l: (l.sub ? '  ' : '') + l.label, r: l.value, bold: l.strong });
  }
  if (c?.courierDue.length) {
    b.push({ k: 'line' }, { k: 'text', s: 'CHEZ LES LIVREURS', bold: true });
    for (const x of c.courierDue) b.push({ k: 'pair', l: `${x.name}${x.outOrders ? ` (${x.outOrders} dehors)` : ''}`, r: fmtAr(x.due) });
  }
  if (c) {
    b.push({ k: 'line' }, { k: 'text', s: 'CAISSE', bold: true }, { k: 'pair', l: 'Théorique', r: fmtAr(c.cash.theoretical) }, { k: 'pair', l: 'Comptée', r: fmtAr(c.cash.counted) }, { k: 'pair', l: 'Écart', r: fmtAr(c.cash.gap), bold: true });
    if (c.cash.reason) b.push({ k: 'text', s: `Motif : ${c.cash.reason}` });
  }
  b.push({ k: 'line', ch: '=' }, { k: 'feed', n: 2 });
  return { title: `Récap ${s.date}`, blocks: b };
}

export { recapLines };
