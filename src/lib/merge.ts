// Fusion des données entre appareils (hors ligne puis synchronisation).
//
// Principe : chaque enregistrement garde, pour chaque champ, l'horodatage de sa dernière modification
// (`_f`). Deux appareils qui modifient des champs différents d'une même fiche gardent donc TOUS LES DEUX
// leurs modifications ; si le même champ est modifié des deux côtés, la modification la plus récente
// gagne, partout de la même façon (en cas d'égalité, l'identifiant d'appareil départage), et la valeur
// écartée est signalée comme conflit pour pouvoir être rétablie.
// Les listes d'éléments identifiés (paiements, historique) sont réunies élément par élément.
//
// Les horodatages viennent d'une horloge logique (HLC) : elle ne recule jamais, même si l'heure du
// téléphone est fausse, car elle tient compte des horodatages déjà reçus des autres appareils.

export interface Rec { id: string; createdAt: string; updatedAt: string; deleted?: boolean; _f?: Record<string, number>; _v?: number; _by?: string; _dev?: string; [k: string]: any }

/** Champs techniques : jamais fusionnés champ par champ. */
export const META = new Set(['id', 'createdAt', 'updatedAt', '_f', '_v', '_by', '_dev']);

/** Listes réunies élément par élément (clé de chaque élément). */
const UNION: Record<string, (x: any) => string> = {
  payments: (p) => p.id,
  events: (e) => `${e.at}|${e.text}`,
  edits: (e) => `${e.at}|${e.toAmount}`,
};

// ---------- Horloge logique ----------
let clock = 0;
/** Prochain horodatage de cet appareil (millisecondes, strictement croissant). */
export function tick(): number { clock = Math.max(Date.now(), clock + 1); return clock; }
/** Un horodatage reçu d'ailleurs fait avancer l'horloge locale (ne jamais « revenir dans le passé »). */
export function observe(stamp?: number) { if (stamp && isFinite(stamp) && stamp > clock) clock = stamp; }
export const clockNow = () => clock;

export const baseStamp = (r: Rec) => r._v ?? (Date.parse(r.updatedAt) || 0);
// Fiche suivie champ par champ : un champ jamais modifié a l'horodatage 0. Ancienne fiche : date de sa dernière modification.
const stampOf = (r: Rec, k: string) => (r._f ? r._f[k] ?? 0 : baseStamp(r));

export function same(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  const ka = Object.keys(a).filter((k) => a[k] !== undefined), kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same(a[k], b[k]));
}

/** Prépare l'écriture locale d'un enregistrement : horodate les champs réellement modifiés. */
export function stampWrite(prev: Rec | undefined, patch: Record<string, any>, who: { by?: string; dev?: string }, stamp = tick()): Rec {
  const f: Record<string, number> = { ...(prev?._f ?? {}) };
  // Fiche ancienne (avant le suivi par champ) : ses champs gardent la date de sa dernière modification.
  if (prev && !prev._f) for (const k of Object.keys(prev)) if (!META.has(k)) f[k] = baseStamp(prev);
  for (const k of Object.keys(patch)) {
    if (META.has(k)) continue;
    if (!prev || !same(prev[k], patch[k])) f[k] = stamp;
  }
  const rec = { ...prev, ...patch } as Rec;
  rec._f = f; rec._v = stamp; rec.updatedAt = new Date(stamp).toISOString();
  rec._by = who.by ?? rec._by; rec._dev = who.dev ?? rec._dev;
  return rec;
}

export interface Conflict { field: string; kept: any; lost: any; keptStamp: number; lostStamp: number; keptBy?: string; lostBy?: string; keptDev?: string; lostDev?: string }

function unionList(k: string, a: any[], b: any[], preferB: boolean): any[] {
  const key = UNION[k];
  const out = new Map<string, any>();
  for (const x of preferB ? a : b) out.set(key(x), x);
  for (const x of preferB ? b : a) out.set(key(x), x); // la version préférée remplace l'autre pour un même élément
  return [...out.values()].sort((x, y) => String(x.at ?? '').localeCompare(String(y.at ?? '')));
}

/**
 * Fusionne la version locale et la version reçue du cloud. Résultat identique sur tous les appareils
 * quel que soit l'ordre d'arrivée (commutatif, idempotent).
 */
export function mergeRecords(local: Rec, remote: Rec): { merged: Rec; conflicts: Conflict[] } {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(local._f ?? {}), ...Object.keys(remote._f ?? {})]);
  const merged: Rec = { id: local.id, createdAt: local.createdAt < remote.createdAt ? local.createdAt : remote.createdAt, updatedAt: local.updatedAt } as Rec;
  const f: Record<string, number> = {};
  const conflicts: Conflict[] = [];
  const devTie = (local._dev ?? '') >= (remote._dev ?? '');
  for (const k of keys) {
    if (META.has(k)) continue;
    const ls = stampOf(local, k), rs = stampOf(remote, k);
    const lv = local[k], rv = remote[k];
    const localWins = ls > rs || (ls === rs && devTie);
    if (UNION[k] && Array.isArray(lv) && Array.isArray(rv)) {
      merged[k] = unionList(k, lv, rv, !localWins);
      f[k] = Math.max(ls, rs);
      continue;
    }
    const v = localWins ? lv : rv;
    if (v !== undefined) merged[k] = v;
    f[k] = Math.max(ls, rs);
    if (!same(lv, rv) && lv !== undefined && rv !== undefined) {
      conflicts.push(localWins
        ? { field: k, kept: lv, lost: rv, keptStamp: ls, lostStamp: rs, keptBy: local._by, lostBy: remote._by, keptDev: local._dev, lostDev: remote._dev }
        : { field: k, kept: rv, lost: lv, keptStamp: rs, lostStamp: ls, keptBy: remote._by, lostBy: local._by, keptDev: remote._dev, lostDev: local._dev });
    }
  }
  const v = Math.max(baseStamp(local), baseStamp(remote));
  merged._f = f; merged._v = v; merged.updatedAt = new Date(v).toISOString();
  const last = baseStamp(local) >= baseStamp(remote) ? local : remote;
  merged._by = last._by; merged._dev = last._dev;
  return { merged, conflicts };
}

/** Deux versions ont-elles le même contenu (hors champs techniques) ? */
export function sameContent(a: Rec, b: Rec) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (!META.has(k) && !same(a[k], b[k])) return false;
  return true;
}
