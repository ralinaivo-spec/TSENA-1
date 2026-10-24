// Imprimantes : celles de cet appareil (gardées sur l'appareil), les postes d'impression partagés
// (via le cloud : un téléphone sans Bluetooth envoie, le poste relié à l'imprimante imprime).
import { useEffect, useState } from 'react';
import { all, get, getMeta, newId, nowIso, remove, save, setMeta, useMeta, useTable, type BaseRecord } from '../db';
import { currentUser } from '../auth';
import { getCloud, syncNow } from '../sync';
import { DEFAULT_COMPANY, type Company } from '../settings';
import { colsOf, type Paper, type PrintDoc } from './doc';
import { charsetProbe, encodeDoc, type Charset } from './escpos';
import { disconnectRaw, shareImage, systemPrint, writeRaw } from './devices';

export * from './doc';
export { CHARSETS, type Charset } from './escpos';
export { support, pairBluetooth, pairUsb, pairSerial, docHtml, btConnected } from './devices';

export type PrinterKind = 'system' | 'bluetooth' | 'usb' | 'serial';
export const KINDS: Record<PrinterKind, string> = {
  bluetooth: 'Bluetooth (direct)',
  usb: 'USB (direct)',
  serial: 'Port série / Bluetooth appairé',
  system: 'Fenêtre d’impression de l’appareil',
};
export interface Printer {
  id: string;
  name: string;
  kind: PrinterKind;
  paper: Paper;
  charset: Charset;
  logo: boolean;
  cut: boolean;
  ref?: string;        // identifiant de l'appareil appairé
  deviceName?: string; // nom donné par l'imprimante
  baud?: number;
  /** Déconnectée volontairement (libérée pour un autre appareil) : rien n'est envoyé tant qu'on ne la reconnecte pas. */
  paused?: boolean;
}
export interface PrintStation extends BaseRecord { name: string; printerName?: string; paper?: Paper; lastSeen?: string; deviceId?: string }
export interface PrintJob extends BaseRecord { fromDevice?: string; stationId: string; doc: PrintDoc; copies: number; status: 'pending' | 'done' | 'error'; byName?: string; printedAt?: string; error?: string }

/** Choix toujours disponibles, sans réglage. */
export const SYSTEM_PRINTER: Printer = { id: '@system', name: 'Fenêtre d’impression de l’appareil', kind: 'system', paper: '58', charset: 'cp850', logo: true, cut: false };
export const SHARE_TARGET = '@share';

export const usePrinters = () => useMeta<Printer[]>('printers', []);
export const getPrinters = () => getMeta<Printer[]>('printers', []);
export async function savePrinter(p: Printer) {
  const list = getPrinters();
  await setMeta('printers', list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]);
}
export async function deletePrinter(id: string) {
  await setMeta('printers', getPrinters().filter((p) => p.id !== id));
  if (getMeta('printDefault', '') === id) await setMeta('printDefault', '');
}

/** Ce que l'on peut choisir au moment d'imprimer : imprimantes de l'appareil, postes partagés, fenêtre système, image. */
export interface Target { id: string; label: string; detail: string; kind: 'printer' | 'station' | 'share'; online?: boolean }
export function useTargets(): Target[] {
  const printers = usePrinters();
  const stations = useTable<PrintStation>('printStations');
  const myStation = useMeta<{ stationId: string } | null>('myStation', null);
  const t: Target[] = printers.map((p) => ({ id: p.id, label: p.name, detail: `${KINDS[p.kind]} · ${p.paper === 'a4' ? 'A4' : p.paper + ' mm'}${p.paused ? ' · déconnectée de cet appareil' : ''}`, kind: 'printer' }));
  for (const s of stations) {
    if (s.id === myStation?.stationId) continue;
    const online = !!s.lastSeen && Date.now() - new Date(s.lastSeen).getTime() < 3 * 60_000;
    t.push({ id: 'station:' + s.id, label: s.name, detail: `Poste d’impression partagé${s.printerName ? ' · ' + s.printerName : ''}${online ? '' : ' · hors ligne'}`, kind: 'station', online });
  }
  t.push({ id: SYSTEM_PRINTER.id, label: SYSTEM_PRINTER.name, detail: 'AirPrint, imprimantes installées sur l’ordinateur, PDF…', kind: 'printer' });
  t.push({ id: SHARE_TARGET, label: 'Partager en image', detail: 'WhatsApp, Messenger, enregistrer dans les photos…', kind: 'share' });
  return t;
}

const company = (): Company => ({ ...DEFAULT_COMPANY, ...(get<Company>('settings', 'company') ?? {}) });
export const findPrinter = (id: string) => (id === SYSTEM_PRINTER.id ? SYSTEM_PRINTER : getPrinters().find((p) => p.id === id));

/** Imprime sur une imprimante de cet appareil. */
export async function printOn(p: Printer, doc: PrintDoc, copies = 1) {
  const logo = p.logo ? company().logo ?? '' : null; // null : pas de logo sur cette imprimante
  if (p.kind === 'system') return systemPrint(doc, p.paper, logo, copies);
  if (!p.ref) throw new Error(`L’imprimante « ${p.name} » n’est pas encore appairée : ouvrez Paramètres → Imprimantes.`);
  if (p.paused) throw new Error(`L’imprimante « ${p.name} » est déconnectée de cet appareil : Paramètres → Imprimantes → « Reconnecter », ou imprimez sur le poste d’impression partagé.`);
  const data = await encodeDoc(doc, { cols: colsOf(p.paper), charset: p.charset, cut: p.cut, logo, copies });
  await writeRaw(p.kind, p.ref, data, p.baud, p.deviceName);
}

/** Déconnecte l'imprimante de cet appareil sans la supprimer (pour l'associer à un autre appareil). */
export async function disconnectPrinter(p: Printer) {
  if (p.kind !== 'system' && p.ref) await disconnectRaw(p.kind, p.ref);
  await savePrinter({ ...p, paused: true });
  const mine = getMeta<{ stationId: string; printerId: string } | null>('myStation', null);
  if (mine?.printerId === p.id) await stopStation(); // un autre appareil va devenir le poste
}
/** Reconnecte l'imprimante (à appeler depuis un clic). */
export async function reconnectPrinter(p: Printer) {
  const q = { ...p, paused: false };
  if (q.kind !== 'system' && q.ref) await writeRaw(q.kind, q.ref, new Uint8Array([0x1b, 0x40]), q.baud, q.deviceName);
  await savePrinter(q);
}

/** Imprime le ticket « Test des accents » pour trouver le bon jeu de caractères. */
export async function printCharsetProbe(p: Printer) {
  if (p.kind === 'system') throw new Error('Le test des accents ne concerne que les imprimantes Bluetooth, USB ou port série.');
  if (!p.ref) throw new Error('Cherchez d’abord l’imprimante.');
  await writeRaw(p.kind, p.ref, charsetProbe(), p.baud, p.deviceName);
}

/** Imprime vers un choix (imprimante, poste partagé ou image). Renvoie un message pour l'utilisateur. */
export async function printTo(targetId: string, doc: PrintDoc, copies = 1): Promise<string> {
  await setMeta('printDefault', targetId);
  if (targetId === SHARE_TARGET) { await shareImage(doc, '58', company().logo ?? ''); return 'Image prête'; }
  if (targetId.startsWith('station:')) {
    const stationId = targetId.slice(8);
    const st = get<PrintStation>('printStations', stationId);
    if (!getCloud()) throw new Error('Le cloud n’est pas relié : impossible d’envoyer au poste d’impression.');
    const [job] = await save('printJobs', { stationId, doc, copies, status: 'pending', byName: currentUser()?.fullName, fromDevice: getMeta('deviceId', '') });
    sentJobs.set(job.id, st?.name ?? 'poste');
    syncNow();
    return `Envoyé à « ${st?.name ?? 'poste'} » : impression dans quelques secondes`;
  }
  const p = findPrinter(targetId);
  if (!p) throw new Error('Imprimante introuvable sur cet appareil.');
  await printOn(p, doc, copies);
  return p.kind === 'system' ? 'Fenêtre d’impression ouverte' : `Imprimé sur « ${p.name} »`;
}

/** Impression rapide sur le choix habituel de l'appareil (ex. ticket automatique après une vente). */
export function defaultTarget(): string {
  const d = getMeta<string>('printDefault', '');
  if (d === SYSTEM_PRINTER.id || d === SHARE_TARGET) return d;
  if (d.startsWith('station:') && get('printStations', d.slice(8))) return d;
  if (getPrinters().some((p) => p.id === d)) return d;
  return getPrinters()[0]?.id ?? SYSTEM_PRINTER.id;
}

// ---------- Poste d'impression partagé ----------
export async function makeStation(name: string, printerId: string) {
  const p = findPrinter(printerId);
  const prev = getMeta<{ stationId: string } | null>('myStation', null);
  const [st] = await save('printStations', { id: prev?.stationId || newId(), name, printerName: p?.name, paper: p?.paper, lastSeen: nowIso(), deviceId: getMeta('deviceId', '') });
  await setMeta('myStation', { stationId: st.id, printerId });
}
export async function stopStation() {
  const mine = getMeta<{ stationId: string } | null>('myStation', null);
  if (mine) await remove('printStations', mine.stationId);
  await setMeta('myStation', null);
}

/** Tourne sur le poste d'impression : imprime les tickets envoyés par les autres appareils. */
export function usePrintStationWorker() {
  const mine = useMeta<{ stationId: string; printerId: string } | null>('myStation', null);
  const jobs = useTable<PrintJob>('printJobs');
  const [retry, setRetry] = useState(0);
  useEffect(() => { const f = () => setRetry((n) => n + 1); retrySubs.add(f); return () => { retrySubs.delete(f); }; }, []);
  useEffect(() => {
    if (!mine) return;
    const beat = () => save('printStations', { id: mine.stationId, lastSeen: nowIso() });
    beat();
    const b = setInterval(beat, 60_000);
    const s = setInterval(() => syncNow(), 5_000); // récupère vite les impressions demandées
    return () => { clearInterval(b); clearInterval(s); };
  }, [mine?.stationId]);
  useEffect(() => {
    if (!mine) return;
    const todo = jobs.filter((j) => j.stationId === mine.stationId && j.status === 'pending' && Date.now() - new Date(j.createdAt).getTime() < 24 * 3600_000 && !busy.has(j.id));
    if (!todo.length) return;
    (async () => {
      for (const j of todo.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
        if (getMeta<string | null>('stationNeedsTap', null)) break; // imprimante à reconnecter : on attend un clic
        busy.add(j.id);
        const p = findPrinter(mine.printerId);
        try {
          if (!p) throw new Error('Imprimante du poste introuvable');
          await printOn(p, j.doc, j.copies || 1);
          await save('printJobs', { id: j.id, status: 'done', printedAt: nowIso() });
        } catch (e: any) {
          const msg = e?.message ?? String(e);
          if (needsTap(e)) {
            // Le navigateur exige un clic pour se reconnecter (après réouverture du logiciel, imprimante éteinte…) :
            // le ticket reste en attente et un bandeau « Reconnecter l'imprimante » s'affiche sur le poste.
            busy.delete(j.id);
            await setMeta('stationNeedsTap', msg);
            break;
          }
          await save('printJobs', { id: j.id, status: 'error', error: msg });
        }
      }
      // Ménage : les impressions de plus de 7 jours sont effacées.
      for (const old of all<PrintJob>('printJobs').filter((x) => x.status !== 'pending' && Date.now() - new Date(x.createdAt).getTime() > 7 * 24 * 3600_000)) await remove('printJobs', old.id);
    })();
  }, [jobs, mine?.stationId, retry]);
}
const busy = new Set<string>();
/** Erreurs qui demandent seulement de recliquer (le navigateur veut un geste de l'utilisateur pour se reconnecter). */
const needsTap = (e: any) => ['SecurityError', 'NotFoundError', 'NotAllowedError', 'NetworkError', 'InvalidStateError'].includes(e?.name) || /gesture|geste|user activation|disconnected|GATT|open|appair/i.test(e?.message ?? '');

/** Bandeau sur le poste d'impression quand l'imprimante doit être reconnectée d'un clic. */
export function useStationReconnect() {
  const need = useMeta<string | null>('stationNeedsTap', null);
  const mine = useMeta<{ stationId: string; printerId: string } | null>('myStation', null);
  const pending = useTable<PrintJob>('printJobs').filter((j) => j.stationId === mine?.stationId && j.status === 'pending').length;
  return {
    need: !!mine && !!need, pending, message: need,
    /** À appeler depuis un clic : reconnecte l'imprimante puis relance les tickets en attente. */
    async reconnect() {
      const p = mine && findPrinter(mine.printerId);
      if (!p) throw new Error('Imprimante du poste introuvable');
      if (p.kind !== 'system' && p.ref) await writeRaw(p.kind, p.ref, new Uint8Array([0x1b, 0x40]), p.baud, p.deviceName);
      await setMeta('stationNeedsTap', null);
      bumpRetry();
    },
  };
}
const retrySubs = new Set<() => void>();
const bumpRetry = () => retrySubs.forEach((f) => f());

/** Tickets envoyés depuis cet appareil vers un poste : on prévient quand ils sont imprimés (ou en erreur). */
const sentJobs = new Map<string, string>();
export function useSentJobsWatcher(notify: (text: string, kind: 'ok' | 'error') => void) {
  const jobs = useTable<PrintJob>('printJobs');
  useEffect(() => {
    for (const j of jobs) {
      const name = sentJobs.get(j.id);
      if (!name || j.status === 'pending') continue;
      sentJobs.delete(j.id);
      if (j.status === 'done') notify(`Ticket imprimé sur « ${name} »`, 'ok');
      else notify(`Le poste « ${name} » n’a pas pu imprimer : ${j.error ?? 'erreur'}`, 'error');
    }
  }, [jobs]);
}
