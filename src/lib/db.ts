// Base de données locale (IndexedDB) : toutes les données vivent sur l'appareil,
// chaque modification est notée dans une "boîte d'envoi" pour la synchronisation cloud.
import { useSyncExternalStore } from 'react';

export const DB_NAME = 'tsena';
export const DB_VERSION = 2;

/** Tables métier synchronisées. Ajouter un nom ici (et augmenter DB_VERSION) crée la table. */
export const TABLES = ['users', 'roles', 'settings', 'audit', 'categories', 'products', 'variants', 'stockMoves', 'suppliers', 'purchases', 'receptions'] as const;
export type TableName = (typeof TABLES)[number];

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  [key: string]: any;
}

let idb: IDBDatabase | null = null;
const cache = new Map<string, Map<string, BaseRecord>>();
const listeners = new Map<string, Set<() => void>>();
const snapshots = new Map<string, BaseRecord[]>();
const metaCache = new Map<string, any>();
const metaListeners = new Set<() => void>();

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function openDb(): Promise<void> {
  if (idb) return;
  idb = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const t of TABLES) if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('_meta')) db.createObjectStore('_meta');
      if (!db.objectStoreNames.contains('_outbox')) db.createObjectStore('_outbox', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Fermez les autres onglets TSENA puis rechargez la page.'));
  });
  // Demande au navigateur de ne pas effacer les données en cas de manque de place.
  try { await navigator.storage?.persist?.(); } catch { /* facultatif */ }

  const tx = idb.transaction([...TABLES, '_meta'], 'readonly');
  for (const t of TABLES) {
    const rows = await req(tx.objectStore(t).getAll() as IDBRequest<BaseRecord[]>);
    cache.set(t, new Map(rows.map((r) => [r.id, r])));
  }
  const metaStore = tx.objectStore('_meta');
  const keys = await req(metaStore.getAllKeys());
  const vals = await req(metaStore.getAll());
  keys.forEach((k, i) => metaCache.set(String(k), vals[i]));
}

function notify(table: string) {
  snapshots.delete(table);
  listeners.get(table)?.forEach((l) => l());
}

export function newId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}
export const nowIso = () => new Date().toISOString();

/** Tous les enregistrements non supprimés d'une table. */
export function all<T extends BaseRecord = BaseRecord>(table: TableName): T[] {
  let snap = snapshots.get(table);
  if (!snap) {
    snap = [...(cache.get(table)?.values() ?? [])].filter((r) => !r.deleted);
    snapshots.set(table, snap);
  }
  return snap as T[];
}
export function get<T extends BaseRecord = BaseRecord>(table: TableName, id: string): T | undefined {
  const r = cache.get(table)?.get(id);
  return r && !r.deleted ? (r as T) : undefined;
}
export function getRaw(table: TableName, id: string) {
  return cache.get(table)?.get(id);
}

/** Écrit un ou plusieurs enregistrements (création ou modification) et les met en file pour la synchro. */
export async function save(table: TableName, records: Partial<BaseRecord> | Partial<BaseRecord>[]): Promise<BaseRecord[]> {
  const list = Array.isArray(records) ? records : [records];
  const now = nowIso();
  const written: BaseRecord[] = list.map((r) => {
    const prev = r.id ? cache.get(table)?.get(r.id) : undefined;
    return { ...prev, ...r, id: r.id || newId(), createdAt: prev?.createdAt || r.createdAt || now, updatedAt: now } as BaseRecord;
  });
  const tx = idb!.transaction([table, '_outbox'], 'readwrite');
  for (const r of written) {
    tx.objectStore(table).put(r);
    tx.objectStore('_outbox').put({ key: table + ':' + r.id, tbl: table, id: r.id, at: now });
    cache.get(table)!.set(r.id, r);
  }
  await done(tx);
  notify(table);
  writeHook?.();
  return written;
}

let writeHook: (() => void) | null = null;
/** Appelé après chaque écriture locale (utilisé pour déclencher la synchro). */
export function setWriteHook(fn: () => void) { writeHook = fn; }

/** Suppression "douce" : l'enregistrement est marqué supprimé (et synchronisé comme tel). */
export async function remove(table: TableName, id: string) {
  await save(table, { id, deleted: true });
}

/** Applique des données venues du cloud (dernière modification gagnante), sans les renvoyer. */
export async function applyRemote(rows: { tbl: string; id: string; data: BaseRecord }[]): Promise<number> {
  if (!rows.length) return 0;
  const tables = [...new Set(rows.map((r) => r.tbl))].filter((t) => (TABLES as readonly string[]).includes(t));
  if (!tables.length) return 0;
  const tx = idb!.transaction([...tables, '_outbox'], 'readwrite');
  const outbox = tx.objectStore('_outbox');
  let applied = 0;
  for (const row of rows) {
    if (!tables.includes(row.tbl)) continue;
    const local = cache.get(row.tbl)!.get(row.id);
    if (local && local.updatedAt > row.data.updatedAt) continue; // la version locale est plus récente
    tx.objectStore(row.tbl).put(row.data);
    cache.get(row.tbl)!.set(row.id, row.data);
    if (local && local.updatedAt <= row.data.updatedAt) outbox.delete(row.tbl + ':' + row.id);
    applied++;
  }
  await done(tx);
  tables.forEach(notify);
  return applied;
}

export async function outboxEntries(): Promise<{ key: string; tbl: TableName; id: string; at: string }[]> {
  const tx = idb!.transaction('_outbox', 'readonly');
  return req(tx.objectStore('_outbox').getAll());
}
export async function outboxClear(keys: { key: string; at: string }[]) {
  const tx = idb!.transaction('_outbox', 'readwrite');
  const store = tx.objectStore('_outbox');
  for (const k of keys) {
    const cur = await req(store.get(k.key));
    if (cur && cur.at === k.at) store.delete(k.key); // ne supprime pas si modifié entre-temps
  }
  await done(tx);
}
export async function outboxCount(): Promise<number> {
  const tx = idb!.transaction('_outbox', 'readonly');
  return req(tx.objectStore('_outbox').count());
}

// ---- Méta-données propres à l'appareil (non synchronisées) ----
export function getMeta<T = any>(key: string, fallback?: T): T {
  return metaCache.has(key) ? metaCache.get(key) : (fallback as T);
}
export async function setMeta(key: string, value: any) {
  metaCache.set(key, value);
  const tx = idb!.transaction('_meta', 'readwrite');
  tx.objectStore('_meta').put(value, key);
  await done(tx);
  metaListeners.forEach((l) => l());
}

// ---- Sauvegarde / restauration / remise à zéro ----
export function dumpAll(): Record<string, BaseRecord[]> {
  const out: Record<string, BaseRecord[]> = {};
  for (const t of TABLES) out[t] = [...(cache.get(t)?.values() ?? [])];
  return out;
}

/** Remplace (ou fusionne) le contenu des tables par celui d'une sauvegarde. */
export async function restoreAll(data: Record<string, BaseRecord[]>, mode: 'replace' | 'merge') {
  const tables = TABLES.filter((t) => Array.isArray(data[t]));
  const tx = idb!.transaction([...tables, '_outbox'], 'readwrite');
  const now = nowIso();
  for (const t of tables) {
    const store = tx.objectStore(t);
    if (mode === 'replace') {
      // Les enregistrements absents de la sauvegarde sont marqués supprimés (pour que le cloud suive).
      const keep = new Set(data[t].map((r) => r.id));
      for (const r of cache.get(t)!.values()) {
        if (!keep.has(r.id) && !r.deleted) {
          const del = { ...r, deleted: true, updatedAt: now };
          store.put(del);
          cache.get(t)!.set(r.id, del);
          tx.objectStore('_outbox').put({ key: t + ':' + r.id, tbl: t, id: r.id, at: now });
        }
      }
    }
    for (const r of data[t]) {
      const rec = { ...r, updatedAt: now };
      store.put(rec);
      cache.get(t)!.set(r.id, rec);
      tx.objectStore('_outbox').put({ key: t + ':' + r.id, tbl: t, id: r.id, at: now });
    }
  }
  await done(tx);
  tables.forEach(notify);
}

/** Efface toute la base locale de cet appareil. */
export async function wipeLocal() {
  idb?.close();
  idb = null;
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
    r.onblocked = () => resolve();
  });
}

// ---- Hooks React ----
function subscribe(table: string, cb: () => void) {
  if (!listeners.has(table)) listeners.set(table, new Set());
  listeners.get(table)!.add(cb);
  return () => listeners.get(table)!.delete(cb);
}
/** Liste réactive d'une table : le composant se met à jour à chaque changement. */
export function useTable<T extends BaseRecord = BaseRecord>(table: TableName): T[] {
  return useSyncExternalStore((cb) => subscribe(table, cb), () => all<T>(table));
}
export function useMeta<T = any>(key: string, fallback?: T): T {
  return useSyncExternalStore(
    (cb) => { metaListeners.add(cb); return () => metaListeners.delete(cb); },
    () => getMeta(key, fallback)
  );
}

/** Remet tous les enregistrements dans la boîte d'envoi, sans changer leur date (réparation de synchro). */
export async function requeueAll() {
  const tx = idb!.transaction('_outbox', 'readwrite');
  const now = nowIso();
  for (const t of TABLES) for (const r of cache.get(t)!.values()) tx.objectStore('_outbox').put({ key: t + ':' + r.id, tbl: t, id: r.id, at: now });
  await done(tx);
}
