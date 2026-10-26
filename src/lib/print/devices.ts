// Moyens d'impression : Bluetooth, USB, port série (navigateurs Chrome/Edge), fenêtre d'impression
// du système (tous les appareils) et image à partager (WhatsApp, enregistrer…).
import { layout, logoFor, type Paper, type PrintDoc, type Row } from './doc';
import { qrMatrix, qrSvg } from '../qr';

const nav = navigator as any;
export const support = {
  bluetooth: !!nav.bluetooth,
  usb: !!nav.usb,
  serial: !!nav.serial,
  share: !!nav.share && !!nav.canShare,
};

// ---------- Bluetooth (BLE) ----------
// Services utilisés par la plupart des imprimantes à tickets Bluetooth du marché.
const BT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb', '0000af30-0000-1000-8000-00805f9b34fb', '0000ae00-0000-1000-8000-00805f9b34fb',
];
const btDevices = new Map<string, any>();
const btChars = new Map<string, any>();

// ---------- État de la liaison (vert / rouge dans Paramètres → Imprimantes) ----------
const linkSubs = new Set<() => void>();
export const onLinkChange = (f: () => void) => { linkSubs.add(f); return () => { linkSubs.delete(f); }; };
const linkChanged = () => linkSubs.forEach((f) => f());

/** Imprimantes à garder connectées en permanence (poste d'impression) : reconnexion automatique si la liaison tombe. */
const keepRefs = new Map<string, { name?: string }>();
const watched = new WeakSet<any>();
function watchDevice(ref: string, dev: any) {
  if (watched.has(dev)) return;
  watched.add(dev);
  dev.addEventListener?.('gattserverdisconnected', () => {
    btChars.delete(ref);
    linkChanged();
    if (keepRefs.has(ref)) void autoReconnect(ref);
  });
}
const reconnecting = new Set<string>();
/** Reconnexion sans clic : possible tant que le navigateur garde l'appareil en mémoire (même page ouverte). */
async function autoReconnect(ref: string) {
  if (reconnecting.has(ref)) return;
  reconnecting.add(ref);
  try {
    for (const wait of [500, 1500, 3000, 6000, 10000, 20000, 30000]) {
      if (!keepRefs.has(ref)) return;
      const dev = btDevices.get(ref);
      if (!dev) return;
      if (dev.gatt?.connected) return;
      await sleep(wait);
      try { await btCharacteristic(ref, keepRefs.get(ref)?.name, true); linkChanged(); return; } catch { /* nouvel essai */ }
    }
  } finally { reconnecting.delete(ref); }
}

export async function pairBluetooth(): Promise<{ ref: string; name: string }> {
  if (!support.bluetooth) throw new Error('Bluetooth non disponible sur ce navigateur. Utilisez Chrome sur Android ou sur ordinateur.');
  const dev = await nav.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BT_SERVICES });
  btDevices.set(dev.id, dev);
  await btCharacteristic(dev.id);
  return { ref: dev.id, name: dev.name || 'Imprimante Bluetooth' };
}

/** `silent` : ne jamais ouvrir la liste des appareils (pas de clic de l'utilisateur), échouer à la place. */
async function btCharacteristic(ref: string, name?: string, silent = false): Promise<any> {
  let dev = btDevices.get(ref);
  if (!dev && nav.bluetooth?.getDevices) { try { dev = (await nav.bluetooth.getDevices()).find((d: any) => d.id === ref); } catch { /* non disponible */ } }
  if (!dev) {
    if (silent) throw Object.assign(new Error('Imprimante à reconnecter (le navigateur l’a oubliée)'), { name: 'NotAllowedError' });
    // Le navigateur a oublié l'imprimante (nouvelle ouverture du logiciel) : on la redemande,
    // en ne montrant que l'imprimante enregistrée (un seul clic sur « Associer »).
    const filters = name && name !== 'Imprimante Bluetooth' ? [{ name }, { namePrefix: name.slice(0, Math.max(3, name.length - 4)) }] : null;
    dev = await nav.bluetooth.requestDevice(filters ? { filters, optionalServices: BT_SERVICES } : { acceptAllDevices: true, optionalServices: BT_SERVICES });
  }
  btDevices.set(ref, dev);
  if (dev.id !== ref) btDevices.set(dev.id, dev);
  watchDevice(ref, dev);
  const cached = btChars.get(ref);
  if (cached && dev.gatt.connected) return cached;
  const server = await dev.gatt.connect();
  const services = await server.getPrimaryServices();
  for (const s of services) {
    for (const ch of await s.getCharacteristics()) {
      if (ch.properties.writeWithoutResponse || ch.properties.write) { btChars.set(ref, ch); linkChanged(); return ch; }
    }
  }
  throw new Error('Cette imprimante Bluetooth n’accepte pas l’impression directe.');
}

/** Une seule écriture à la fois par imprimante (impression, maintien de la liaison). */
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(ref: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(ref) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  locks.set(ref, run.catch(() => undefined));
  return run;
}

/** Envoi Bluetooth. Sur Android, la liaison n'accepte souvent que 20 octets par paquet : au-delà, la fin du paquet
 *  est perdue et le ticket s'arrête au milieu. */
export type BtSpeed = 'safe' | 'sure' | 'fast' | 'max';
export const BT_SPEEDS: Record<BtSpeed, string> = {
  safe: 'Normal — rapide et sûr sur tous les appareils (conseillé)',
  sure: 'Très sûr — chaque paquet confirmé (plus lent ; si des morceaux manquent)',
  fast: 'Rapide — ordinateurs (Mac, PC)',
  max: 'Très rapide — si l’imprimante le supporte',
};
const CHUNK: Record<BtSpeed, number> = { safe: 20, sure: 20, fast: 100, max: 180 };

function writeBluetooth(ref: string, data: Uint8Array, name?: string, speed: BtSpeed = 'safe', silent = false) {
  return withLock(ref, async () => {
    let ch = await btCharacteristic(ref, name, silent);
    if (!ch.service?.device?.gatt?.connected) { btChars.delete(ref); ch = await btCharacteristic(ref, name, silent); } // imprimante éteinte puis rallumée
    const size = CHUNK[speed] ?? 20;
    // Par défaut : envoi sans accusé de réception (bien plus rapide), en petits paquets et à un rythme régulier pour ne
    // pas déborder la mémoire de l'imprimante. « Très sûr » : chaque paquet est confirmé avant le suivant (plus lent).
    const canNoResp = !!ch.properties.writeWithoutResponse && !!ch.writeValueWithoutResponse;
    const withResp = speed === 'sure' ? !!ch.properties.write || !canNoResp : !canNoResp;
    let n = 0;
    for (let i = 0; i < data.length; i += size) {
      const part = data.slice(i, i + size);
      for (let attempt = 0; ; attempt++) {
        try {
          if (withResp) await (ch.writeValueWithResponse ? ch.writeValueWithResponse(part) : ch.writeValue(part));
          else {
            await ch.writeValueWithoutResponse(part);
            n++;
            await sleep(n % 40 === 0 ? 30 : size <= 20 ? 4 : 15); // petite pause régulière, plus longue tous les 800 octets
          }
          break;
        } catch (e: any) {
          // « GATT operation already in progress » / liaison occupée : on attend un peu et on renvoie le même paquet.
          if (attempt >= 6) throw Object.assign(new Error(`Envoi Bluetooth interrompu (${Math.round((i / data.length) * 100)} % envoyé) : rapprochez le téléphone de l’imprimante et réessayez. ${e?.message ?? ''}`), { name: 'NetworkError' });
          await sleep(60 * (attempt + 1));
          if (!ch.service?.device?.gatt?.connected) { btChars.delete(ref); ch = await btCharacteristic(ref, name, true); }
        }
      }
    }
  });
}

// ---------- USB ----------
const usbRef = (d: any) => `${d.vendorId}:${d.productId}:${d.serialNumber || ''}`;
export async function pairUsb(): Promise<{ ref: string; name: string }> {
  if (!support.usb) throw new Error('USB direct non disponible sur ce navigateur. Utilisez Chrome ou Edge sur ordinateur.');
  const d = await nav.usb.requestDevice({ filters: [] });
  return { ref: usbRef(d), name: d.productName || 'Imprimante USB' };
}
async function writeUsb(ref: string, data: Uint8Array) {
  let d = (await nav.usb.getDevices()).find((x: any) => usbRef(x) === ref);
  if (!d) d = await nav.usb.requestDevice({ filters: [] });
  if (!d.opened) await d.open();
  if (!d.configuration) await d.selectConfiguration(1);
  for (const itf of d.configuration.interfaces) {
    for (const alt of itf.alternates) {
      const ep = alt.endpoints.find((e: any) => e.direction === 'out' && e.type === 'bulk');
      if (!ep) continue;
      if (!itf.claimed) await d.claimInterface(itf.interfaceNumber);
      for (let i = 0; i < data.length; i += 4096) await d.transferOut(ep.endpointNumber, data.slice(i, i + 4096));
      return;
    }
  }
  throw new Error('Impossible d’écrire sur cette imprimante USB. Sur Windows, utilisez plutôt « Port série » ou la fenêtre d’impression.');
}

// ---------- Port série (USB-série, ou Bluetooth appairé dans Windows/macOS) ----------
const SPP = '00001101-0000-1000-8000-00805f9b34fb';
export async function pairSerial(): Promise<{ ref: string; name: string }> {
  if (!support.serial) throw new Error('Port série non disponible sur ce navigateur. Utilisez Chrome ou Edge sur ordinateur.');
  // Imprimantes Bluetooth « classiques » (port série SPP) appairées dans les réglages Bluetooth de l'ordinateur.
  let port: any;
  try { port = await nav.serial.requestPort({ allowedBluetoothServiceClassIds: [SPP] }); }
  catch (e: any) { if (e?.name === 'TypeError') port = await nav.serial.requestPort(); else throw e; }
  const info = port.getInfo?.() || {};
  const ports = await nav.serial.getPorts();
  return { ref: `${info.usbVendorId ?? ''}:${info.usbProductId ?? ''}:${ports.indexOf(port)}`, name: info.usbVendorId ? 'Imprimante (port série USB)' : 'Imprimante Bluetooth (port série)' };
}
/** Port qui a fonctionné la dernière fois pour chaque imprimante (évite de tâtonner à chaque ticket). */
const goodPort = new Map<string, any>();
const withTimeout = <T,>(p: Promise<T>, ms: number, what: string) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(Object.assign(new Error(`${what} : pas de réponse`), { name: 'NetworkError' })), ms))]);
async function closePort(port: any) { try { await port.close(); } catch { /* déjà fermé */ } }

/** Port série (USB-série ou Bluetooth « classique » appairé). Robuste : si le port enregistré ne s'ouvre pas
 *  (numéro changé, imprimante éteinte puis rallumée, liaison tombée), il est refermé et on essaie les autres ports
 *  autorisés ; un port bloqué est refermé puis rouvert. */
function writeSerial(ref: string, data: Uint8Array, baud: number, silent = false) {
  return withLock('serial:' + ref, async () => {
    const [vid, pid, idx] = ref.split(':');
    const ports: any[] = await nav.serial.getPorts();
    const byUsb = ports.filter((p: any) => { const i = p.getInfo?.() || {}; return vid && String(i.usbVendorId) === vid && String(i.usbProductId) === pid; });
    const order = [goodPort.get(ref), ...byUsb, ports[Number(idx)], ...ports].filter((p, k, a) => p && a.indexOf(p) === k && ports.includes(p));
    if (!order.length) {
      if (silent) throw Object.assign(new Error('Imprimante à reconnecter (port non autorisé)'), { name: 'NotAllowedError' });
      let port: any;
      try { port = await nav.serial.requestPort({ allowedBluetoothServiceClassIds: [SPP] }); } catch (e: any) { if (e?.name === 'TypeError') port = await nav.serial.requestPort(); else throw e; }
      order.push(port);
    }
    let last: any = null;
    for (const port of order) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (!port.writable) await withTimeout(port.open({ baudRate: baud || 9600 }), 12000, 'Ouverture de l’imprimante');
          const w = port.writable.getWriter();
          try { await withTimeout(w.write(data), 20000, 'Envoi à l’imprimante'); } finally { try { w.releaseLock(); } catch { /* */ } }
          goodPort.set(ref, port);
          linkChanged();
          return;
        } catch (e: any) {
          last = e;
          if (/already open/i.test(e?.message ?? '') && port.writable) continue; // ouvert ailleurs dans la page : on réessaie d'écrire
          await closePort(port); // port bloqué ou liaison tombée : refermer, puis rouvrir au tour suivant
          if (goodPort.get(ref) === port) goodPort.delete(ref);
          await sleep(800);
        }
      }
    }
    linkChanged();
    throw Object.assign(new Error('Impossible de se connecter à l’imprimante : elle est éteinte, trop loin, ou déjà connectée à un autre appareil (téléphone, autre ordinateur). Éteignez-la puis rallumez-la, vérifiez qu’elle est appairée dans les réglages Bluetooth, puis réessayez.' + (last?.message ? ` (${last.message})` : '')), { name: 'NetworkError' });
  });
}

export type LinkState = 'connected' | 'ready' | 'disconnected';
/** État de la liaison avec l'imprimante, sans rien ouvrir. connected : liaison active ; ready : USB / port série autorisé
 *  (s'ouvre tout seul à l'impression) ; disconnected : il faut se reconnecter. */
export async function linkState(kind: 'bluetooth' | 'usb' | 'serial', ref: string): Promise<LinkState> {
  if (kind === 'bluetooth') return btDevices.get(ref)?.gatt?.connected ? 'connected' : 'disconnected';
  if (kind === 'usb') { const d = ((await nav.usb?.getDevices?.()) ?? []).find((x: any) => usbRef(x) === ref); return d ? (d.opened ? 'connected' : 'ready') : 'disconnected'; }
  const ports = (await nav.serial?.getPorts?.()) ?? [];
  return ports.length ? (ports.some((p: any) => p.writable) ? 'connected' : 'ready') : 'disconnected';
}

/** Connexion sans clic (au démarrage du poste, maintien de la liaison). Échoue si le navigateur exige un clic. */
export async function connectSilently(kind: 'bluetooth' | 'usb' | 'serial', ref: string, name?: string) {
  if (kind === 'bluetooth') { await btCharacteristic(ref, name, true); return; }
  if (kind === 'usb') {
    const d = ((await nav.usb?.getDevices?.()) ?? []).find((x: any) => usbRef(x) === ref);
    if (!d) throw Object.assign(new Error('Imprimante USB à reconnecter'), { name: 'NotAllowedError' });
    if (!d.opened) await d.open();
    linkChanged(); return;
  }
  const ports = (await nav.serial?.getPorts?.()) ?? [];
  if (!ports.length) throw Object.assign(new Error('Imprimante à reconnecter'), { name: 'NotAllowedError' });
}

/** Maintien de la liaison (poste d'impression) : toutes les 25 s, une demande d'état à l'imprimante (DLE EOT 1 :
 *  n'imprime rien) garde la liaison Bluetooth active ; si elle est tombée, reconnexion automatique. */
const keepTimers = new Map<string, ReturnType<typeof setInterval>>();
export function keepAlive(kind: 'bluetooth' | 'usb' | 'serial', ref: string, name?: string) {
  if (kind !== 'bluetooth') return () => undefined;
  keepRefs.set(ref, { name });
  const tick = async () => {
    const dev = btDevices.get(ref);
    if (!dev?.gatt?.connected) { void autoReconnect(ref); return; }
    const ch = btChars.get(ref);
    if (!ch) return;
    try { await withLock(ref, async () => { if (ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) await ch.writeValueWithoutResponse(new Uint8Array([0x10, 0x04, 0x01])); else await (ch.writeValueWithResponse ?? ch.writeValue).call(ch, new Uint8Array([0x10, 0x04, 0x01])); }); }
    catch { /* la reconnexion se fera au prochain tour */ }
  };
  clearInterval(keepTimers.get(ref));
  keepTimers.set(ref, setInterval(tick, 25_000));
  return () => { clearInterval(keepTimers.get(ref)); keepTimers.delete(ref); keepRefs.delete(ref); };
}
/** Le navigateur peut-il retrouver seul une imprimante Bluetooth après réouverture du logiciel ? */
export const btRemembers = () => !!nav.bluetooth?.getDevices;

/** Libère l'imprimante (sans l'oublier) : une imprimante Bluetooth ne se connecte qu'à un appareil à la fois,
 *  il faut la libérer ici pour l'associer à un autre téléphone ou ordinateur. */
export async function disconnectRaw(kind: 'bluetooth' | 'usb' | 'serial', ref: string) {
  if (kind === 'bluetooth') {
    keepRefs.delete(ref); clearInterval(keepTimers.get(ref)); keepTimers.delete(ref);
    for (const [k, dev] of [...btDevices]) {
      if (k !== ref && dev?.id !== ref) continue;
      try { if (dev.gatt?.connected) dev.gatt.disconnect(); } catch { /* déjà libérée */ }
      try { await dev.forget?.(); } catch { /* non disponible */ }
      btDevices.delete(k);
    }
    btChars.delete(ref);
    linkChanged();
    return;
  }
  if (kind === 'usb') {
    for (const d of (await nav.usb?.getDevices?.()) ?? []) if (usbRef(d) === ref && d.opened) { try { await d.close(); } catch { /* */ } }
    return;
  }
  for (const port of (await nav.serial?.getPorts?.()) ?? []) { if (port.writable || port.readable) { try { await port.close(); } catch { /* */ } } }
}
/** L'imprimante est-elle connectée en ce moment (Bluetooth) ? */
export const btConnected = (ref: string) => { const d = btDevices.get(ref); return !!d?.gatt?.connected; };

export async function writeRaw(kind: 'bluetooth' | 'usb' | 'serial', ref: string, data: Uint8Array, baud?: number, name?: string, speed?: BtSpeed, silent = false) {
  if (kind === 'bluetooth') return writeBluetooth(ref, data, name, speed, silent);
  if (kind === 'usb') return writeUsb(ref, data);
  return writeSerial(ref, data, baud || 9600, silent);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Rendu HTML (aperçu et fenêtre d'impression) ----------
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
export function docHtml(doc: PrintDoc, paper: Paper, logo?: string | null): string {
  const cols = paper === '58' ? 32 : 48;
  return layout(doc, cols).map((r: Row) => {
    if (r.logo) { const src = logoFor(r, logo); return src ? `<div class="tk-logo"><img src="${src}" alt=""></div>` : ''; }
    if (r.cut) return '<div class="tk-cut"></div>';
    if (r.qr) return `<div class="tk-qr">${qrSvg(r.qr, 2)}</div>`;
    const cls = [r.bold && 'b', r.big && 'big', r.tall && 'tall'].filter(Boolean).join(' ');
    return `<div class="tk-row ${cls}">${esc(r.s) || '&nbsp;'}</div>`;
  }).join('');
}

/** Ouvre la fenêtre d'impression de l'appareil (AirPrint sur iPhone, imprimantes installées sur Windows/Mac…). */
export function systemPrint(doc: PrintDoc, paper: Paper, logo?: string | null, copies = 1): Promise<void> {
  return new Promise((resolve) => {
    const lay = layout(doc, paper === '58' ? 32 : 48);
    const rows = lay.length + lay.filter((r) => r.big || r.tall).length + lay.filter((r) => r.qr).length * 7;
    const area = document.createElement('div');
    area.className = `print-area ticket paper-${paper}`;
    const one = `<div class="tk-page">${docHtml(doc, paper, logo)}</div>`;
    area.innerHTML = Array.from({ length: Math.max(1, copies) }, () => one).join('');
    const style = document.createElement('style');
    const width = paper === '58' ? 58 : 80;
    style.textContent = paper === 'a4' ? '@page { size: A4; margin: 14mm; }'
      : `@page { size: ${width}mm ${Math.max(60, Math.ceil(rows * 4.4 * copies + 20))}mm; margin: 0; }`;
    document.head.appendChild(style);
    document.body.appendChild(area);
    document.body.classList.add('printing');
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      document.body.classList.remove('printing');
      area.remove(); style.remove();
      resolve();
    };
    window.addEventListener('afterprint', () => setTimeout(finish, 300), { once: true });
    const imgs = [...area.querySelectorAll('img')].map((i) => i.decode().catch(() => null));
    Promise.all(imgs).then(() => {
      setTimeout(() => {
        window.print();
        setTimeout(finish, 1500); // certains navigateurs n'envoient pas « afterprint »
      }, 50);
    });
  });
}

// ---------- Image du ticket (à partager) ----------
export async function docImage(doc: PrintDoc, paper: Paper, logo?: string | null): Promise<Blob> {
  const cols = paper === '58' ? 32 : 48;
  const rows = layout(doc, cols);
  const scale = 2, charW = 12, lineH = 26, pad = 24;
  const width = cols * charW + pad * 2;
  // Un logo par ligne « logo » (plusieurs étiquettes de pages différentes dans un même document).
  const imgs = new Map<string, HTMLImageElement | null>();
  for (const r of rows) { const src = r.logo ? logoFor(r, logo) : undefined; if (src && !imgs.has(src)) { const im = new Image(); im.src = src; try { await im.decode(); imgs.set(src, im); } catch { imgs.set(src, null); } } }
  const imgOf = (r: Row) => { const src = logoFor(r, logo); return src ? imgs.get(src) ?? null : null; };
  const hOf = (im: HTMLImageElement | null) => (im ? Math.min(140, (im.height * Math.min(width * 0.5, im.width)) / im.width) : 0);
  const qrPx = 3;
  const qrH = (r: Row) => (qrMatrix(r.qr!).length + 8) * qrPx;
  const height = pad * 2 + rows.reduce((h, r) => h + (r.qr ? qrH(r) : r.logo ? (imgOf(r) ? hOf(imgOf(r)) + 10 : 0) : r.cut ? 30 : r.big || r.tall ? lineH * 2 : lineH), 0);
  const canvas = document.createElement('canvas');
  canvas.width = width * scale; canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#111'; ctx.textBaseline = 'top';
  let y = pad;
  for (const r of rows) {
    if (r.logo) {
      const im = imgOf(r);
      if (im) { const lh = hOf(im); const w = (im.width * lh) / im.height; ctx.drawImage(im, (width - w) / 2, y, w, lh); y += lh + 10; }
      continue;
    }
    if (r.qr) {
      const m = qrMatrix(r.qr), s = (m.length + 8) * qrPx, x0 = (width - s) / 2;
      m.forEach((row, yy) => row.forEach((on, xx) => { if (on) ctx.fillRect(x0 + (xx + 4) * qrPx, y + (yy + 4) * qrPx, qrPx, qrPx); }));
      y += s; continue;
    }
    if (r.cut) { ctx.setLineDash([6, 6]); ctx.strokeStyle = '#999'; ctx.beginPath(); ctx.moveTo(pad, y + 15); ctx.lineTo(width - pad, y + 15); ctx.stroke(); ctx.setLineDash([]); y += 30; continue; }
    const size = r.big ? 40 : 20;
    ctx.font = `${r.bold ? 'bold ' : ''}${size}px "Courier New", ui-monospace, monospace`;
    // Chaque caractère dans sa case : alignement exact des colonnes.
    const cw = r.big ? charW * 2 : charW;
    if (r.tall) { ctx.save(); ctx.translate(0, y + 4); ctx.scale(1, 2); [...r.s].forEach((ch, i) => ctx.fillText(ch, pad + i * cw, 0)); ctx.restore(); }
    else [...r.s].forEach((ch, i) => ctx.fillText(ch, pad + i * cw, y + (r.big ? 4 : 2)));
    y += r.big || r.tall ? lineH * 2 : lineH;
  }
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Image impossible'))), 'image/png'));
}

export async function shareImage(doc: PrintDoc, paper: Paper, logo?: string | null) {
  const blob = await docImage(doc, paper, logo);
  const name = doc.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.png';
  const file = new File([blob], name || 'ticket.png', { type: 'image/png' });
  if (support.share && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: doc.title }); return; } catch (e: any) { if (e?.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
