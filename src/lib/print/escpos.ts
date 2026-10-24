// Langage ESC/POS : celui des imprimantes à tickets (58 mm et 80 mm, Bluetooth ou USB).
import { layout, logoFor, type PrintDoc } from './doc';

export type Charset = 'cp850' | 'cp858' | 'wpc1252' | 'wpc1252cn' | 'ascii';
export const CHARSETS: Record<Charset, string> = {
  cp850: 'A — PC850 (recommandé : marche sur presque toutes les imprimantes)',
  cp858: 'A — PC850 (ancien réglage « PC858 »)',
  wpc1252: 'C — Windows-1252 (imprimantes Epson)',
  wpc1252cn: 'D — Windows-1252 (imprimantes 58 mm chinoises : JK-5803H, POS-58…)',
  ascii: 'E — Sans accents (si aucune autre ne marche)',
};
/** Numéro de la page de code envoyé à l'imprimante (commande ESC t n). */
// « PC858 » (n° 19 chez Epson) correspond à une autre langue sur beaucoup d'imprimantes chinoises (lettres accentuées
// remplacées par des traits) : les imprimantes réglées ainsi utilisent désormais PC850 (n° 2), identique sauf l'euro.
const TABLE: Record<Charset, number> = { cp850: 2, cp858: 2, wpc1252: 16, wpc1252cn: 11, ascii: 0 };
const ENC: Record<Charset, 'cp850' | 'cp858' | 'wpc1252' | 'ascii'> = { cp850: 'cp850', cp858: 'cp850', wpc1252: 'wpc1252', wpc1252cn: 'wpc1252', ascii: 'ascii' };

// Correspondance des lettres accentuées pour les pages de code PC850/PC858.
const CP858: Record<string, number> = {
  Ç: 0x80, ü: 0x81, é: 0x82, â: 0x83, ä: 0x84, à: 0x85, å: 0x86, ç: 0x87, ê: 0x88, ë: 0x89, è: 0x8a, ï: 0x8b, î: 0x8c, ì: 0x8d, Ä: 0x8e, Å: 0x8f,
  É: 0x90, æ: 0x91, Æ: 0x92, ô: 0x93, ö: 0x94, ò: 0x95, û: 0x96, ù: 0x97, ÿ: 0x98, Ö: 0x99, Ü: 0x9a, ø: 0x9b, '£': 0x9c, Ø: 0x9d,
  á: 0xa0, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, '«': 0xae, '»': 0xaf, Á: 0xb5, Â: 0xb6, À: 0xb7, Ê: 0xd2, Ë: 0xd3, È: 0xd4, '€': 0xd5,
  Í: 0xd6, Î: 0xd7, Ï: 0xd8, Ó: 0xe0, Ô: 0xe2, Ò: 0xe3, Ú: 0xe9, Û: 0xea, Ù: 0xeb, '°': 0xf8, '·': 0xfa,
};
const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[«»]/g, '"').replace(/€/g, 'EUR').replace(/·/g, '.').replace(/°/g, 'o');

function encodeText(s: string, charset: Charset): number[] {
  const cs = ENC[charset];
  const out: number[] = [];
  for (const ch of cs === 'ascii' ? stripAccents(s) : s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (cs === 'cp850' && ch === '€') out.push(0x45, 0x55, 0x52); // PC850 n'a pas l'euro
    else if ((cs === 'cp858' || cs === 'cp850') && CP858[ch] != null) out.push(CP858[ch]);
    else if (cs === 'wpc1252' && c <= 0xff) out.push(c);
    else if (cs === 'wpc1252' && ch === '€') out.push(0x80);
    else out.push(...[...stripAccents(ch)].map((x) => (x.charCodeAt(0) < 0x80 ? x.charCodeAt(0) : 0x3f)));
  }
  return out;
}

const ESC = 0x1b, GS = 0x1d;

/** Logo de la société converti en image noir et blanc (points de l'imprimante). */
export async function logoRaster(dataUrl: string, dots: number): Promise<number[]> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const maxW = Math.min(dots, Math.round(dots * 0.6));
  const scale = Math.min(maxW / img.width, 160 / img.height, 1.5);
  const w = Math.max(8, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = dots; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dots, h);
  ctx.drawImage(img, Math.round((dots - w) / 2), 0, w, h);
  const px = ctx.getImageData(0, 0, dots, h).data;
  const bytesPerRow = dots / 8;
  // Tramage (Floyd-Steinberg) pour garder les nuances du logo.
  const lum = new Float32Array(dots * h);
  for (let i = 0; i < dots * h; i++) lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const data: number[] = new Array(bytesPerRow * h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < dots; x++) {
    const i = y * dots + x, old = lum[i], val = old < 128 ? 0 : 255, err = old - val;
    if (val === 0) data[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    if (x + 1 < dots) lum[i + 1] += (err * 7) / 16;
    if (y + 1 < h) { if (x > 0) lum[i + dots - 1] += (err * 3) / 16; lum[i + dots] += (err * 5) / 16; if (x + 1 < dots) lum[i + dots + 1] += err / 16; }
  }
  return [GS, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, h & 0xff, h >> 8, ...data];
}

export async function encodeDoc(doc: PrintDoc, o: { cols: number; charset: Charset; cut: boolean; logo?: string | null; copies?: number; feedMm?: number }): Promise<Uint8Array> {
  // Espace blanc en bas pour déchirer le ticket sans couper le texte (8 points par mm ; ESC J avance de n points, 255 au plus).
  const tail = (): number[] => { const out: number[] = []; let dots = Math.round((o.feedMm ?? 20) * 8); while (dots > 0) { const n = Math.min(255, dots); out.push(ESC, 0x4a, n); dots -= n; } return out; };
  const dots = o.cols >= 48 ? 576 : 384;
  const rows = layout(doc, o.cols);
  // Un logo par ligne « logo » : celui de la page si le document en a un, sinon celui de la société.
  const rasters = new Map<string, number[]>();
  for (const r of rows) { const src = r.logo ? logoFor(r, o.logo) : undefined; if (src && !rasters.has(src)) { try { rasters.set(src, await logoRaster(src, dots)); } catch { rasters.set(src, []); } } }
  const one: number[] = [ESC, 0x40]; // initialisation
  one.push(ESC, 0x74, TABLE[o.charset] ?? 2);
  let bold = false, big = 0;
  for (const r of rows) {
    if (r.logo) { const src = logoFor(r, o.logo); const logo = src ? rasters.get(src) ?? [] : []; if (logo.length) one.push(ESC, 0x61, 1, ...logo, ESC, 0x61, 0); continue; }
    if (r.qr) {
      const data = [...new TextEncoder().encode(r.qr)];
      const len = data.length + 3;
      one.push(ESC, 0x61, 1);
      one.push(GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00); // modèle 2
      one.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, 4);          // taille des points (petit QR : économise le papier)
      one.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31);       // correction M
      one.push(GS, 0x28, 0x6b, len & 0xff, len >> 8, 0x31, 0x50, 0x30, ...data);
      one.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30, 0x0a); // impression
      one.push(ESC, 0x61, 0);
      continue;
    }
    if (r.cut) { one.push(...tail()); if (o.cut) one.push(GS, 0x56, 0x42, 0x00); continue; }
    if (!!r.bold !== bold) { bold = !!r.bold; one.push(ESC, 0x45, bold ? 1 : 0); }
    const size = r.big ? 0x11 : r.tall ? 0x01 : 0x00;
    if (size !== big) { big = size; one.push(GS, 0x21, size); }
    one.push(...encodeText(r.s.replace(/\s+$/, ''), o.charset), 0x0a);
  }
  if (bold) one.push(ESC, 0x45, 0);
  if (big) one.push(GS, 0x21, 0);
  one.push(...tail());
  if (o.cut) one.push(GS, 0x56, 0x42, 0x00);
  const all: number[] = [];
  for (let i = 0; i < Math.max(1, o.copies ?? 1); i++) all.push(...one);
  return new Uint8Array(all);
}

/** Ticket « Test des accents » : la même phrase dans chaque jeu de caractères, repérée par une lettre (A, B, C…).
 *  On choisit ensuite la lettre dont la ligne s'imprime correctement. */
export function charsetProbe(): Uint8Array {
  const out: number[] = [ESC, 0x40];
  const line = (t: string) => out.push(...encodeText(t, 'ascii'), 0x0a);
  out.push(ESC, 0x61, 1, ESC, 0x45, 1); line('TEST DES ACCENTS'); out.push(ESC, 0x45, 0, ESC, 0x61, 0);
  line('Choisissez la lettre dont la ligne');
  line('est bien ecrite :');
  line('');
  for (const k of Object.keys(TABLE) as Charset[]) {
    if (k === 'ascii' || k === 'cp858') continue;
    out.push(ESC, 0x74, TABLE[k]);
    out.push(ESC, 0x45, 1, ...encodeText(`${CHARSETS[k][0]}`, 'ascii'), ESC, 0x45, 0, 0x20, ...encodeText('é è à ç ê ô û ï É', k), 0x0a);
  }
  out.push(ESC, 0x74, 0);
  line(''); line('E : sans accents (dernier recours)');
  out.push(ESC, 0x64, 4);
  return new Uint8Array(out);
}
