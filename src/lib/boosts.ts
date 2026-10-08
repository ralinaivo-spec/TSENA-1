// Boosts publicitaires (Facebook / Meta) : suivi quotidien des résultats théoriques (affichés par Meta)
// et des messages réellement reçus sur chaque page, pour mesurer l'efficacité de chaque boost.
//
// Comme dans le cahier Excel « NBR MESSAGE PAR JOUR » :
// - chaque page a des boosts numérotés 1, 2, 3… dans l'ordre où ils apparaissent dans l'Espace Pubs ;
// - chaque jour, le vendeur recopie pour chaque boost actif la dépense cumulée ($) et le nombre cumulé
//   de conversations (messages théoriques) ;
// - les messages théoriques du jour = valeur du jour − valeur précédente (jamais négatif : une valeur
//   inférieure à la précédente est une erreur de saisie et n'est pas acceptée) ;
// - le vendeur compte aussi les messages réellement reçus sur la page (messages physiques).
import { all, get, save, type BaseRecord } from './db';
import { audit, currentUser } from './auth';
import type { Category } from './catalog';
import { addDays, dayOf } from './money';
import { isWalkIn, type Order } from './orders';
import { variantPage } from './scope';

export interface Boost extends BaseRecord {
  pageId: string;           // catégorie principale = page Facebook
  slot: number;             // n° dans l'ordre de l'Espace Pubs (1 = le premier de la liste)
  label?: string;           // texte de la publicité, pour le reconnaître
  startDate: string;        // date de lancement (AAAA-MM-JJ)
  dailyBudget?: number;     // budget par jour ($)
  status: 'active' | 'stopped';
  stoppedOn?: string;       // dernier jour actif
  stopReason?: string;
  createdByName?: string;
}
export interface BoostReading extends BaseRecord {
  boostId: string;
  pageId: string;
  date: string;             // jour de la saisie (AAAA-MM-JJ)
  spend: number;            // dépense cumulée depuis le lancement ($)
  messages: number;         // conversations cumulées depuis le lancement (théorique)
  userName?: string;
}
export interface PageMessages extends BaseRecord {
  pageId: string;
  date: string;
  count: number;            // messages réellement reçus ce jour-là sur la page
  userName?: string;
}

export const STOP_REASONS = ['Peu performant', 'Remplacé par un nouveau boost', 'Budget ou durée terminés', 'Arrêté par Meta / refusé', 'Autre'];

// ---------- Pages ----------
/** Pages = catégories principales (sans parent), par ordre alphabétique. */
export function allPages(): Category[] {
  return all<Category>('categories').filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
export const pageName = (id: string) => get<Category>('categories', id)?.name ?? 'Page supprimée';

// ---------- Boosts ----------
export const boostsOf = (pageId: string) => all<Boost>('boosts').filter((b) => b.pageId === pageId);
/** Boost actif ce jour-là : lancé avant ou ce jour, et pas encore arrêté (ou arrêté ce jour ou après). */
export const activeOn = (b: Boost, date: string) => b.startDate <= date && (b.status === 'active' || (!!b.stoppedOn && b.stoppedOn >= date));
export const activeBoosts = (pageId: string, date: string) => boostsOf(pageId).filter((b) => activeOn(b, date)).sort((a, b) => a.slot - b.slot);
export const boostName = (b: Boost) => `Boost ${b.slot}${b.label ? ` — ${b.label}` : ''}`;
export function nextSlot(pageId: string) {
  const used = new Set(boostsOf(pageId).filter((b) => b.status === 'active').map((b) => b.slot));
  let n = 1; while (used.has(n)) n++;
  return n;
}

export async function createBoost(d: { pageId: string; slot: number; label?: string; startDate: string; dailyBudget?: number }) {
  const clash = boostsOf(d.pageId).find((b) => b.status === 'active' && b.slot === d.slot);
  if (clash) throw new Error(`Le n° ${d.slot} est déjà pris par un boost actif (${boostName(clash)}). Arrêtez-le d'abord ou choisissez un autre numéro.`);
  const [b] = await save('boosts', { ...d, status: 'active', createdByName: currentUser()?.fullName });
  await audit('Boost', `${pageName(d.pageId)} : nouveau boost n° ${d.slot}${d.label ? ` (${d.label})` : ''}, lancé le ${d.startDate}`, 'boosts', b.id);
  return b as Boost;
}

/** Modifier un boost. Si le nouveau numéro est pris par un autre boost actif, les deux numéros sont échangés. */
export async function updateBoost(b: Boost, patch: Partial<Pick<Boost, 'slot' | 'label' | 'startDate' | 'dailyBudget'>>) {
  const updates: Partial<Boost>[] = [{ id: b.id, ...patch }];
  if (patch.slot != null && patch.slot !== b.slot) {
    const other = boostsOf(b.pageId).find((x) => x.id !== b.id && x.status === 'active' && x.slot === patch.slot);
    if (other) updates.push({ id: other.id, slot: b.slot });
  }
  await save('boosts', updates);
  await audit('Boost', `${pageName(b.pageId)} : boost n° ${b.slot} modifié${patch.slot != null && patch.slot !== b.slot ? ` (devient n° ${patch.slot})` : ''}`, 'boosts', b.id);
}

export async function stopBoost(b: Boost, stoppedOn: string, reason: string) {
  await save('boosts', { id: b.id, status: 'stopped', stoppedOn, stopReason: reason });
  await audit('Boost', `${pageName(b.pageId)} : ${boostName(b)} arrêté le ${stoppedOn} — ${reason}`, 'boosts', b.id);
}
export async function restartBoost(b: Boost) {
  const clash = boostsOf(b.pageId).find((x) => x.id !== b.id && x.status === 'active' && x.slot === b.slot);
  if (clash) throw new Error(`Le n° ${b.slot} est repris par ${boostName(clash)} : changez d'abord son numéro.`);
  await save('boosts', { id: b.id, status: 'active', stoppedOn: undefined, stopReason: undefined });
  await audit('Boost', `${pageName(b.pageId)} : ${boostName(b)} réactivé`, 'boosts', b.id);
}

// ---------- Saisies ----------
export const readingId = (boostId: string, date: string) => `br_${boostId}_${date}`;
export const pageMsgId = (pageId: string, date: string) => `pm_${pageId}_${date}`;
export const readingsOf = (boostId: string) => all<BoostReading>('boostReadings').filter((r) => r.boostId === boostId).sort((a, b) => a.date.localeCompare(b.date));
export const readingOn = (boostId: string, date: string) => get<BoostReading>('boostReadings', readingId(boostId, date));
export const prevReading = (boostId: string, date: string) => readingsOf(boostId).filter((r) => r.date < date).pop();
export const nextReading = (boostId: string, date: string) => readingsOf(boostId).find((r) => r.date > date);
export const realOn = (pageId: string, date: string) => get<PageMessages>('pageMessages', pageMsgId(pageId, date));

const fmtD = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const n2 = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/**
 * Contrôle d'une saisie : les valeurs cumulées ne baissent jamais.
 * - égale à la précédente : rien de nouveau (0 message ce jour) ;
 * - plus grande : nouveaux messages ;
 * - plus petite : erreur de saisie, l'enregistrement est refusé.
 */
export function checkReading(boostId: string, date: string, spend: number | undefined, messages: number | undefined): string[] {
  const errs: string[] = [];
  if (messages == null || isNaN(messages)) errs.push('Nombre de messages (conversations) à saisir.');
  else if (messages < 0 || !Number.isInteger(messages)) errs.push('Le nombre de messages doit être un nombre entier positif.');
  if (spend == null || isNaN(spend)) errs.push('Dépense ($) à saisir.');
  else if (spend < 0) errs.push('La dépense ne peut pas être négative.');
  const prev = prevReading(boostId, date);
  const next = nextReading(boostId, date);
  if (prev && messages != null && messages < prev.messages) errs.push(`Erreur de saisie : ${messages} messages, alors que le ${fmtD(prev.date)} il y en avait déjà ${prev.messages}. Le total cumulé reste stable ou augmente, il ne baisse jamais.`);
  if (prev && spend != null && spend < prev.spend - 0.001) errs.push(`Erreur de saisie : dépense ${n2(spend)} $, alors que le ${fmtD(prev.date)} elle était déjà de ${n2(prev.spend)} $. La dépense cumulée ne baisse jamais.`);
  if (next && messages != null && messages > next.messages) errs.push(`Incohérent avec le ${fmtD(next.date)} (${next.messages} messages) : une valeur passée ne peut pas dépasser une valeur plus récente.`);
  if (next && spend != null && spend > next.spend + 0.001) errs.push(`Incohérent avec le ${fmtD(next.date)} (${n2(next.spend)} $).`);
  return errs;
}

/** Enregistre la journée d'une page : un résultat par boost actif + les messages réels. Tout ou rien. */
export async function saveDay(pageId: string, date: string, rows: { boostId: string; spend: number; messages: number }[], real: number) {
  const errors = rows.flatMap((r) => checkReading(r.boostId, date, r.spend, r.messages).map((e) => `${boostName(get<Boost>('boosts', r.boostId)!)} : ${e}`));
  if (real == null || isNaN(real) || real < 0 || !Number.isInteger(real)) errors.push('Messages réels reçus : nombre entier à saisir (0 si aucun).');
  if (errors.length) throw new Error(errors.join('\n'));
  const u = currentUser()?.fullName;
  await save('boostReadings', rows.map((r) => ({ id: readingId(r.boostId, date), boostId: r.boostId, pageId, date, spend: r.spend, messages: r.messages, userName: u })));
  await save('pageMessages', { id: pageMsgId(pageId, date), pageId, date, count: real, userName: u });
  const d = dayStats(pageId, date);
  await audit('Boosts — saisie du jour', `${pageName(pageId)} ${date} : ${d.theo} message(s) théorique(s), ${real} réel(s), dépense ${n2(d.spend)} $`, 'pageMessages', pageMsgId(pageId, date));
}

// ---------- Calculs ----------
/** Nouveaux messages et dépense d'un boost pour un jour saisi (écart avec la saisie précédente). */
export function boostDelta(boostId: string, date: string): { messages: number; spend: number; reading?: BoostReading; first?: boolean } {
  const r = readingOn(boostId, date);
  if (!r) return { messages: 0, spend: 0 };
  const p = prevReading(boostId, date);
  // Première saisie : tout ce qui est arrivé depuis le lancement compte ce jour-là.
  return { messages: Math.max(0, r.messages - (p?.messages ?? 0)), spend: Math.max(0, r.spend - (p?.spend ?? 0)), reading: r, first: !p };
}

/** Commandes en ligne créées ce jour-là contenant au moins un article de la page. */
export function ordersOn(pageId: string, date: string) {
  return all<Order>('orders').filter((o) => !isWalkIn(o) && o.status !== 'cancelled' && dayOf(o.createdAt) === date && o.lines.some((l) => variantPage(l.variantId) === pageId)).length;
}

export interface DayStats { date: string; theo: number; real?: number; gap?: number; spend: number; orders: number; perBoost: Map<string, number>; spendPerBoost: Map<string, number>; missing: number; entered: boolean }
export function dayStats(pageId: string, date: string): DayStats {
  const perBoost = new Map<string, number>(); const spendPerBoost = new Map<string, number>();
  let theo = 0, spend = 0, missing = 0;
  for (const b of boostsOf(pageId)) {
    const d = boostDelta(b.id, date);
    if (d.reading) { perBoost.set(b.id, d.messages); spendPerBoost.set(b.id, d.spend); theo += d.messages; spend += d.spend; }
    else if (activeOn(b, date)) missing++;
  }
  const real = realOn(pageId, date)?.count;
  return { date, theo, real, gap: real == null ? undefined : real - theo, spend, orders: ordersOn(pageId, date), perBoost, spendPerBoost, missing, entered: real != null || perBoost.size > 0 };
}

export const weekDates = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

// ---------- Performance et décision ----------
export type Verdict = 'good' | 'average' | 'bad' | 'new' | 'none';
export const VERDICT: Record<Verdict, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' | 'brand' }> = {
  good: { label: 'Bon', tone: 'ok' }, average: { label: 'Moyen', tone: 'warn' }, bad: { label: 'Faible', tone: 'danger' },
  new: { label: 'Trop récent', tone: 'brand' }, none: { label: 'Pas de saisie', tone: 'neutral' },
};
export interface BoostPerf {
  b: Boost; days: number; readings: number;
  spend: number; messages: number; cost: number | null;          // sur la période
  last3: number; totalSpend: number; totalMessages: number;        // depuis le lancement
  verdict: Verdict; advice: string;
}

/** Performance de chaque boost sur la période [from, to] et avis : bon, moyen, faible. */
export function boostPerformance(from: string, to: string, pageId?: string): BoostPerf[] {
  const list = all<Boost>('boosts').filter((b) => (!pageId || b.pageId === pageId) && b.startDate <= to && (b.status === 'active' || (b.stoppedOn ?? '') >= from));
  const rows: BoostPerf[] = list.map((b) => {
    const rs = readingsOf(b.id);
    let spend = 0, messages = 0, last3 = 0, n = 0;
    const in3 = addDays(to, -2);
    for (const r of rs) {
      if (r.date < from || r.date > to) continue;
      const d = boostDelta(b.id, r.date); n++;
      spend += d.spend; messages += d.messages;
      if (r.date >= in3) last3 += d.messages;
    }
    const lastR = rs.filter((r) => r.date <= to).pop();
    const days = Math.max(1, Math.round((new Date(`${(b.stoppedOn && b.stoppedOn < to ? b.stoppedOn : to)}T12:00:00`).getTime() - new Date(`${b.startDate}T12:00:00`).getTime()) / 864e5) + 1);
    return { b, days, readings: n, spend, messages, cost: messages ? spend / messages : null, last3, totalSpend: lastR?.spend ?? 0, totalMessages: lastR?.messages ?? 0, verdict: 'none' as Verdict, advice: '' };
  });
  // Référence : coût moyen par message de la page (ou de toutes les pages si la page n'a qu'un boost).
  const avg = (rs: BoostPerf[]) => { const s = rs.reduce((t, r) => t + r.spend, 0), m = rs.reduce((t, r) => t + r.messages, 0); return m ? s / m : null; };
  const global = avg(rows);
  for (const r of rows) {
    const same = rows.filter((x) => x.b.pageId === r.b.pageId);
    const ref = same.length >= 2 ? avg(same) : global;
    if (!r.readings) { r.verdict = 'none'; r.advice = 'Aucun résultat saisi sur la période.'; continue; }
    if (r.readings < 3 && r.days < 4) { r.verdict = 'new'; r.advice = 'Lancé depuis peu : attendre 3 à 4 jours avant de juger.'; continue; }
    if (r.b.status === 'active' && r.last3 === 0 && r.readings >= 3) { r.verdict = 'bad'; r.advice = 'Aucun message depuis 3 jours : à arrêter, et lancer un nouveau boost à la place.'; continue; }
    if (r.cost == null) { r.verdict = r.spend > 0 ? 'bad' : 'none'; r.advice = r.spend > 0 ? 'Des dépenses sans aucun message : à arrêter.' : 'Pas de dépense sur la période.'; continue; }
    if (ref == null) { r.verdict = 'average'; r.advice = ''; continue; }
    if (r.cost <= ref * 0.8) { r.verdict = 'good'; r.advice = `Coût par message ${Math.round((1 - r.cost / ref) * 100)} % sous la moyenne : à garder (voire augmenter le budget).`; }
    else if (r.cost >= ref * 1.3) { r.verdict = 'bad'; r.advice = `Coût par message ${Math.round((r.cost / ref - 1) * 100)} % au-dessus de la moyenne : à arrêter ou à remplacer.`; }
    else { r.verdict = 'average'; r.advice = 'Dans la moyenne : à surveiller.'; }
  }
  return rows;
}
