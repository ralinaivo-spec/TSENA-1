// Documents imprimables (ticket de caisse, bon de livraison, feuille de route, page de test).
// Un document est une suite de blocs indépendants de l'imprimante : la mise en page (32 colonnes
// pour le 58 mm, 48 pour le 80 mm) est faite au moment d'imprimer.
import { get } from '../db';
import { fmtAr, fmtNum, variantLabel, type Product, type Variant } from '../catalog';
import {
  CHANNELS, exchangeBalance, fmtPhone, isPickupZone, isWalkIn, keptTotal, orderTotal, PAY_METHODS, paidTotal, remaining, sellingLines,
  type Courier, type Order, type Zone,
} from '../orders';
import type { Company } from '../settings';

export type Block =
  | { k: 'text'; s: string; align?: 'left' | 'center' | 'right'; bold?: boolean; big?: boolean }
  | { k: 'pair'; l: string; r: string; bold?: boolean; big?: boolean }
  | { k: 'line'; ch?: '-' | '=' }
  | { k: 'logo' }
  | { k: 'feed'; n?: number }
  | { k: 'cut' };

export interface PrintDoc { title: string; blocks: Block[] }

export type Paper = '58' | '80' | 'a4';
export const PAPERS: Record<Paper, string> = { '58': 'Ticket 58 mm', '80': 'Ticket 80 mm', a4: 'Feuille A4' };
export const colsOf = (paper: Paper) => (paper === '58' ? 32 : 48);

// ---------- Mise en page en colonnes ----------
/** Espaces spéciaux (séparateurs de milliers français) → espace normal, pour que tout tienne en colonnes. */
export const clean = (s: string) => (s ?? '').replace(/[   ]/g, ' ').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[–—]/g, '-');

export function wrap(s: string, width: number): string[] {
  const out: string[] = [];
  for (const para of clean(s).split('\n')) {
    let line = '';
    for (const word of para.split(/ +/)) {
      if (!word) continue;
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += ' ' + word;
      else { out.push(line); line = word; }
      while (line.length > width) { out.push(line.slice(0, width)); line = line.slice(width); }
    }
    out.push(line);
  }
  return out;
}

export interface Row { s: string; bold?: boolean; big?: boolean; logo?: boolean; cut?: boolean }

/** Transforme les blocs en lignes de texte de largeur fixe (utilisé pour l'aperçu, l'image et l'imprimante). */
export function layout(doc: PrintDoc, cols: number): Row[] {
  const rows: Row[] = [];
  for (const b of doc.blocks) {
    if (b.k === 'logo') rows.push({ s: '', logo: true });
    else if (b.k === 'cut') rows.push({ s: '', cut: true });
    else if (b.k === 'feed') for (let i = 0; i < (b.n ?? 1); i++) rows.push({ s: '' });
    else if (b.k === 'line') rows.push({ s: (b.ch ?? '-').repeat(cols) });
    else if (b.k === 'text') {
      const w = b.big ? Math.floor(cols / 2) : cols;
      for (const l of wrap(b.s, w)) {
        const pad = b.align === 'center' ? Math.floor((w - l.length) / 2) : b.align === 'right' ? w - l.length : 0;
        rows.push({ s: ' '.repeat(Math.max(0, pad)) + l, bold: b.bold, big: b.big });
      }
    } else {
      const r = clean(b.r);
      // Gros caractères : si le libellé et le montant ne tiennent pas sur une ligne, le libellé passe au-dessus.
      if (b.big && b.l.length + r.length + 1 > Math.floor(cols / 2)) {
        for (const l of wrap(b.l, cols)) rows.push({ s: l, bold: true });
        if (r.length <= Math.floor(cols / 2)) rows.push({ s: ' '.repeat(Math.floor(cols / 2) - r.length) + r, bold: true, big: true });
        else rows.push({ s: ' '.repeat(Math.max(0, cols - r.length)) + r, bold: true });
        continue;
      }
      const w = b.big ? Math.floor(cols / 2) : cols;
      const left = wrap(b.l, Math.max(4, w - r.length - 1));
      left.forEach((l, i) => {
        const last = i === left.length - 1;
        rows.push({ s: last ? l + ' '.repeat(Math.max(1, w - l.length - r.length)) + r : l, bold: b.bold, big: b.big });
      });
    }
  }
  return rows;
}

export function joinDocs(title: string, docs: PrintDoc[]): PrintDoc {
  return { title, blocks: docs.flatMap((d, i) => (i < docs.length - 1 ? [...d.blocks, { k: 'cut' as const }] : d.blocks)) };
}

// ---------- Morceaux communs ----------
const T = (s: string, o: Partial<Extract<Block, { k: 'text' }>> = {}): Block => ({ k: 'text', s, ...o });
const P = (l: string, r: string, o: Partial<Extract<Block, { k: 'pair' }>> = {}): Block => ({ k: 'pair', l, r, ...o });
const L = (ch: '-' | '=' = '-'): Block => ({ k: 'line', ch });
const dt = (iso?: string) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const ar = (n: number) => fmtAr(n);

function header(c: Company, withLogo = true): Block[] {
  const b: Block[] = [];
  if (withLogo && c.logo) b.push({ k: 'logo' });
  b.push(T(c.name, { align: 'center', bold: true, big: true }));
  if (c.slogan) b.push(T(c.slogan, { align: 'center' }));
  if (c.address) b.push(T(c.address, { align: 'center' }));
  if (c.phone) b.push(T(`Tél : ${c.phone}`, { align: 'center' }));
  const ids = [c.nif && `NIF ${c.nif}`, c.stat && `STAT ${c.stat}`].filter(Boolean).join(' · ');
  if (ids) b.push(T(ids, { align: 'center' }));
  return b;
}

function itemName(variantId: string) {
  const v = get<Variant>('variants', variantId);
  const p = v && get<Product>('products', v.productId);
  const vl = variantLabel(v);
  return [p?.name || 'Article', vl && vl !== 'Unique' ? vl : ''].filter(Boolean).join(' - ');
}
function itemLines(variantId: string, qty: number, price: number, note = ''): Block[] {
  return [T(itemName(variantId) + note), P(`  ${fmtNum(qty)} x ${fmtNum(price)}`, ar(qty * price))];
}

// ---------- Ticket de caisse (vente sur place ou commande) ----------
export function ticketDoc(o: Order, c: Company, opts: { cashGiven?: number } = {}): PrintDoc {
  const closed = ['delivered', 'partial', 'refused'].includes(o.status);
  const walkIn = isWalkIn(o);
  const zone = get<Zone>('zones', o.zoneId || '');
  const courier = get<Courier>('couriers', o.courierId || '');
  const b: Block[] = [...header(c), L('=')];
  b.push(T(`${walkIn ? 'TICKET' : o.kind === 'exchange' ? 'ÉCHANGE' : 'COMMANDE'} ${o.number}`, { align: 'center', bold: true }));
  b.push(T(dt(o.createdAt), { align: 'center' }));
  if (o.createdByName) b.push(T(`Vendeur : ${o.createdByName}`, { align: 'center' }));
  if (o.name || o.phone) {
    b.push(L());
    if (o.name) b.push(T(`Client : ${o.name}`));
    if (o.phone) b.push(T(`Tél : ${fmtPhone(o.phone)}`));
  }
  if (!walkIn && zone) b.push(T(`Livraison : ${zone.name}${o.place && !isPickupZone(zone) ? ' - ' + o.place : ''}`));
  if (!walkIn && courier) b.push(T(`Livreur : ${courier.name}`));
  b.push(L());

  let count = 0;
  for (const l of o.lines) {
    const q = closed ? (l.qtyKept ?? 0) : l.isChoice ? 0 : l.qty;
    if (q > 0) { b.push(...itemLines(l.variantId, q, l.unitPrice)); count += q; }
  }
  const choices = closed ? [] : o.lines.filter((l) => l.isChoice);
  if (choices.length) {
    b.push(T('En choix (non compté) :', { bold: true }));
    for (const l of choices) b.push(T(`  ${fmtNum(l.qty)} x ${itemName(l.variantId)}`));
  }
  for (const r of o.returnLines || []) b.push(...itemLines(r.variantId, -r.qty, r.unitPrice, ' (repris)'));
  b.push(L());

  const items = closed ? keptTotal(o) : sellingLines(o).reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const fee = closed ? (o.feeCharged ?? o.deliveryFee) : o.deliveryFee;
  b.push(P(`${fmtNum(count)} article(s)`, ar(items)));
  if (o.discount) b.push(P('Remise', '- ' + ar(o.discount)));
  if (o.credit) b.push(P('Articles repris', '- ' + ar(o.credit)));
  if (fee) b.push(P('Frais de livraison', ar(fee)));
  const due = o.kind === 'exchange' ? exchangeBalance(o) : orderTotal(o);
  b.push(P('TOTAL', ar(Math.max(0, due)), { bold: true, big: true }));
  const pays = o.payments || [];
  for (const p of pays) b.push(P(`Payé ${PAY_METHODS[p.method]}${p.ref ? ' ' + p.ref : ''}`, ar(p.amount)));
  const cashPaid = pays.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
  const given = opts.cashGiven ?? o.cashGiven;
  if (given && given > cashPaid) {
    b.push(P('Espèces reçues', ar(given)));
    b.push(P('Monnaie rendue', ar(given - cashPaid), { bold: true }));
  }
  const rest = due - paidTotal(o);
  if (rest > 0) b.push(P('RESTE À PAYER', ar(rest), { bold: true }));
  else if (rest < 0) b.push(P('À rendre au client', ar(-rest), { bold: true }));
  b.push(L('='));
  if (c.ticketFooter) b.push(T(c.ticketFooter, { align: 'center' }));
  b.push({ k: 'feed', n: 2 });
  return { title: `Ticket ${o.number}`, blocks: b };
}

// ---------- Bon de livraison (remis au livreur avec le colis) ----------
export function deliveryNoteDoc(o: Order, c: Company): PrintDoc {
  const zone = get<Zone>('zones', o.zoneId || '');
  const courier = get<Courier>('couriers', o.courierId || '');
  const b: Block[] = [...header(c, false), L('=')];
  b.push(T('BON DE LIVRAISON', { align: 'center', bold: true }));
  b.push(T(o.number, { align: 'center', bold: true, big: true }));
  b.push(T(dt(o.dispatchedAt || o.createdAt), { align: 'center' }));
  b.push(L());
  b.push(T(`Client : ${o.name || '-'}`, { bold: true }));
  if (o.phone) b.push(T(`Tél : ${fmtPhone(o.phone)}`, { bold: true }));
  b.push(T(`Lieu : ${zone?.name || '-'}${o.place ? ' - ' + o.place : ''}`));
  if (courier) b.push(T(`Livreur : ${courier.name}${courier.phone ? ' (' + fmtPhone(courier.phone) + ')' : ''}`));
  b.push(T(`Canal : ${CHANNELS[o.channel]}`));
  b.push(L());
  for (const l of o.lines) b.push(...itemLines(l.variantId, l.qty, l.unitPrice, l.isChoice ? ' (CHOIX)' : ''));
  if (o.lines.some((l) => l.isChoice)) b.push(T('CHOIX : le client paie seulement ce qu’il garde, le reste revient à la boutique.'));
  b.push(L());
  const items = sellingLines(o).reduce((s, l) => s + l.qty * l.unitPrice, 0);
  b.push(P('Articles', ar(items)));
  if (o.discount) b.push(P('Remise', '- ' + ar(o.discount)));
  if (o.credit) b.push(P('Articles repris', '- ' + ar(o.credit)));
  b.push(P('Frais de livraison', ar(o.deliveryFee || 0)));
  const paid = paidTotal(o);
  if (paid) b.push(P('Déjà payé', '- ' + ar(paid)));
  b.push(P('À ENCAISSER', ar(Math.max(0, remaining(o))), { bold: true, big: true }));
  if (remaining(o) < 0) b.push(P('À rendre au client', ar(-remaining(o)), { bold: true }));
  if (o.notes) { b.push(L()); b.push(T(`Obs. : ${o.notes}`)); }
  b.push(L());
  b.push({ k: 'feed' });
  b.push(T('Signature client :'));
  b.push({ k: 'feed', n: 3 });
  return { title: `Bon de livraison ${o.number}`, blocks: b };
}

// ---------- Feuille de route d'un livreur ----------
export function routeSheetDoc(courier: Courier | undefined, orders: Order[], c: Company): PrintDoc {
  const b: Block[] = [T(c.name, { align: 'center', bold: true }), L('=')];
  b.push(T('FEUILLE DE ROUTE', { align: 'center', bold: true }));
  b.push(T(courier?.name || 'Livreur', { align: 'center', bold: true, big: true }));
  b.push(T(dt(new Date().toISOString()), { align: 'center' }));
  b.push(L());
  let total = 0, pcs = 0;
  orders.forEach((o, i) => {
    const zone = get<Zone>('zones', o.zoneId || '');
    const due = Math.max(0, remaining(o));
    total += due; pcs += o.lines.reduce((s, l) => s + l.qty, 0);
    b.push(P(`${i + 1}. ${o.number}`, ar(due), { bold: true }));
    b.push(T(`${o.name ? o.name + ' - ' : ''}${fmtPhone(o.phone)}`));
    b.push(T(`${zone?.name || ''}${o.place ? ' - ' + o.place : ''}`));
    const choix = o.lines.filter((l) => l.isChoice).reduce((s, l) => s + l.qty, 0);
    b.push(T(`${fmtNum(o.lines.reduce((s, l) => s + l.qty, 0))} pièce(s)${choix ? ` dont ${choix} en choix` : ''}`));
    if (o.notes) b.push(T(`Obs. : ${o.notes}`));
    b.push(L());
  });
  b.push(P(`${orders.length} commande(s), ${fmtNum(pcs)} pcs`, ''));
  b.push(P('TOTAL À ENCAISSER', ar(total), { bold: true }));
  b.push(T('(frais de livraison compris : ils restent au livreur)'));
  b.push({ k: 'feed' });
  b.push(T('Signature livreur :'));
  b.push({ k: 'feed', n: 3 });
  return { title: `Feuille de route ${courier?.name || ''}`.trim(), blocks: b };
}

// ---------- Page de test ----------
export function testDoc(c: Company, printerName: string): PrintDoc {
  return {
    title: 'Page de test',
    blocks: [
      ...header(c), L('='),
      T('PAGE DE TEST', { align: 'center', bold: true }),
      T(printerName, { align: 'center' }),
      T(dt(new Date().toISOString()), { align: 'center' }),
      L(),
      T('Accents : é è ê à â ç ô û ù ï « »'),
      T('Si les accents sont mal imprimés, changez le « jeu de caractères » de l’imprimante dans TSENA.'),
      P('Article exemple', ar(25000)),
      P('TOTAL', ar(25000), { bold: true, big: true }),
      L('='),
      T('Impression réussie !', { align: 'center', bold: true }),
      { k: 'feed', n: 2 },
    ],
  };
}
