// Clients à suivre (prospects) : clients repérés dans les messages privés de la page, qui vont probablement acheter
// mais pas tout de suite (ils attendent une confirmation, une information, un paiement…). On note ce qu'on sait,
// on relance à la date prévue, et on transforme en commande seulement quand les critères essentiels sont remplis.
import { all, bizNow, get, save, type BaseRecord } from './db';
import { audit, currentUser } from './auth';
import { linePrice, normPhone, isPickupZone, type PayMethod } from './orders';
import { variantLabel, type Product, type Variant } from './catalog';

export type WaitFor = 'confirm' | 'info' | 'payment' | 'stock' | 'other';
export const WAIT: Record<WaitFor, string> = { confirm: 'Sa confirmation', info: 'Une information', payment: 'Son paiement', stock: 'Arrivage / stock', other: 'Autre' };
export type Priority = 'high' | 'normal' | 'low';
export const PRIORITY: Record<Priority, string> = { high: 'Haute', normal: 'Normale', low: 'Basse' };
export const ABANDON = ['Pas de réponse', 'Trop cher', 'A acheté ailleurs', 'Article indisponible', 'Autre'];

export interface ProspectItem { id: string; variantId?: string; text?: string; qty?: number }
export interface Prospect extends BaseRecord {
  fbName: string;            // nom Facebook (Messenger) : sert à retrouver le client
  phone?: string;
  pageId?: string;           // page (catégorie principale)
  items: ProspectItem[];     // article du catalogue ou texte libre, quantité si connue
  waitFor: WaitFor; waitNote?: string; waitDone?: boolean;
  paid?: { amount: number; method: PayMethod; ref?: string }; // paiement déjà reçu (repris dans la commande)
  followAt: string;          // ISO : prochaine relance
  priority: Priority;
  zoneId?: string; place?: string; notes?: string;
  events?: { at: string; text: string; user?: string }[];
  status: 'open' | 'converted' | 'abandoned';
  orderId?: string; abandonReason?: string; closedAt?: string;
  ownerId?: string; ownerName?: string;
}

/** Demain à 9 h (relance proposée par défaut). */
export function tomorrow9() { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString(); }
export const STALE_DAYS = 7;

export const itemLabel = (i: ProspectItem) => {
  if (!i.variantId) return i.text || '?';
  const v = get<Variant>('variants', i.variantId); const p = v && get<Product>('products', v.productId);
  return p ? `${p.code} ${p.attrs ? p.name : `${p.name} ${variantLabel(v)}`}`.trim() : i.text || '?';
};
export const itemsText = (p: Prospect) => p.items.map((i) => `${i.qty ? i.qty + ' × ' : ''}${itemLabel(i)}`).join(', ');
/** Montant estimé : articles du catalogue dont la quantité est connue, au prix détail. */
export const estimate = (p: Prospect) => p.items.reduce((s, i) => s + (i.variantId && i.qty ? i.qty * linePrice(i.variantId, false) : 0), 0);

/** Ce qui manque pour pouvoir transformer en commande (vide = prêt). */
export function missing(p: Prospect): string[] {
  const m: string[] = [];
  if (normPhone(p.phone || '').length < 9) m.push('téléphone');
  if (!p.zoneId) m.push('lieu de livraison');
  else if (!isPickupZone(p.zoneId) && !p.place?.trim()) m.push('lieu précis');
  if (!p.items.length) m.push('article');
  else {
    if (p.items.some((i) => !i.variantId)) m.push('article précis du catalogue');
    if (p.items.some((i) => !(i.qty && i.qty > 0))) m.push('quantité');
  }
  if (!p.waitDone) m.push(`réponse attendue : ${WAIT[p.waitFor].toLowerCase()}`);
  return m;
}

/** Dernière nouvelle (dernière relance notée, sinon création). */
export const lastNews = (p: Prospect) => (p.events?.length ? p.events[p.events.length - 1].at : p.createdAt);
export const staleDays = (p: Prospect) => Math.floor((Date.now() - Date.parse(lastNews(p))) / 86400_000);

export type Bucket = 'late' | 'today' | 'later';
export function bucketOf(p: Prospect): Bucket {
  const t = Date.parse(p.followAt), now = new Date();
  if (t <= now.getTime()) return 'late';
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return t <= end.getTime() ? 'today' : 'later';
}
/** Suivis à relancer maintenant (heure passée), pour les notifications. */
export const dueProspects = (mineOnly?: string) => all<Prospect>('prospects').filter((p) => p.status === 'open' && Date.parse(p.followAt) <= Date.now() && (!mineOnly || p.ownerId === mineOnly));

const who = () => currentUser()?.fullName;
const ev = (text: string) => ({ at: bizNow(), text, user: who() });

export async function saveProspect(data: Partial<Prospect>, existing?: Prospect) {
  if (existing) {
    const [r] = await save('prospects', { id: existing.id, ...data });
    await audit('Client à suivre modifié', data.fbName || existing.fbName, 'prospects', existing.id);
    return r as Prospect;
  }
  const u = currentUser();
  const [r] = await save('prospects', { status: 'open', priority: 'normal', items: [], ...data, ownerId: u?.id, ownerName: u?.fullName, events: [ev('Suivi créé' + (data.waitFor ? ` — attend : ${WAIT[data.waitFor].toLowerCase()}` : ''))] });
  await audit('Client à suivre ajouté', `${data.fbName}`, 'prospects', r.id);
  return r as Prospect;
}
export async function followUp(p: Prospect, text: string, next: string, patch: Partial<Prospect> = {}) {
  await save('prospects', { id: p.id, ...patch, followAt: next, events: [...(p.events || []), ev(text)] });
}
export async function abandonProspect(p: Prospect, reason: string) {
  await save('prospects', { id: p.id, status: 'abandoned', abandonReason: reason, closedAt: bizNow(), events: [...(p.events || []), ev(`Abandonné : ${reason}`)] });
  await audit('Client à suivre abandonné', `${p.fbName} — ${reason}`, 'prospects', p.id);
}
export async function reopenProspect(p: Prospect) {
  await save('prospects', { id: p.id, status: 'open', abandonReason: undefined, closedAt: undefined, followAt: tomorrow9(), events: [...(p.events || []), ev('Suivi rouvert')] });
}
export async function markConverted(p: Prospect, orderId: string, number: string) {
  await save('prospects', { id: p.id, status: 'converted', orderId, closedAt: bizNow(), events: [...(p.events || []), ev(`Transformé en commande ${number}`)] });
}
