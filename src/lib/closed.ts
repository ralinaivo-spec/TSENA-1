// Semaines clôturées par un versement au patron : on ne peut plus y ajouter ni y supprimer de dépense ou de vente
// sur place (le montant versé ne doit plus changer après coup).
import { all, bizNow, type BaseRecord } from './db';

export interface Payout extends BaseRecord {
  weekStart: string;       // lundi (AAAA-MM-JJ)
  weekEnd: string;         // samedi
  sales: number;           // total des ventes de la semaine (retours déduits)
  expenses: number;        // total des dépenses de la semaine
  expected: number;        // ventes − dépenses
  amount: number;          // montant réellement remis au patron
  account: string;         // compte d'où sort l'argent (caisse espèces par défaut)
  gap: number;             // montant remis − montant attendu
  note?: string;
  byId?: string; byName?: string; at: string; device?: string;
  perPage: { pageId: string; name: string; sales: number }[];
  expenseIds: string[];
  moveId?: string;         // mouvement de trésorerie « versement au patron »
  status: 'paid' | 'cancelled';
  cancelledBy?: string; cancelledAt?: string; cancelReason?: string;
}

export const payoutId = (monday: string) => `po_${monday}`;
const mondayOfYmd = (ymd: string) => { const d = new Date(`${ymd}T12:00:00`); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Versement validé couvrant ce jour (lundi → samedi), s'il y en a un. */
export function closedBy(ymd: string): Payout | undefined {
  if (!ymd) return undefined;
  const p = all<Payout>('payouts').find((x) => x.id === payoutId(mondayOfYmd(ymd)) && x.status === 'paid');
  return p && ymd >= p.weekStart && ymd <= p.weekEnd ? p : undefined;
}
export function assertOpen(ymd: string, what: string) {
  const p = closedBy(ymd);
  if (p) throw new Error(`${what} impossible : la semaine du ${fr(p.weekStart)} au ${fr(p.weekEnd)} est clôturée (versement au patron validé le ${fr(p.at.slice(0, 10))} par ${p.byName ?? '?'}).`);
}
const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** Refuse une opération datée d'aujourd'hui (date de travail) si la semaine est déjà versée. */
export const assertOpenNow = (what: string) => assertOpen(localDay(bizNow()), what);
export const assertOpenAt = (iso: string, what: string) => assertOpen(localDay(iso), what);
const fr = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
