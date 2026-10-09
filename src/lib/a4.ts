// Impression / PDF au format A4 : une page propre (en-tête société, titre, période, tableaux, pied de page),
// envoyée à l'impression du navigateur (« Enregistrer en PDF » sur ordinateur et téléphone).
import { get } from './db';
import { DEFAULT_COMPANY, type Company } from './settings';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const h = esc;
export const arA4 = (n: number) => `${Math.round(n).toLocaleString('fr-FR')}&nbsp;Ar`;

export interface A4Table { title?: string; head: string[]; rows: (string | number)[][]; foot?: (string | number)[]; num?: number[] }
/** Tableau HTML (colonnes `num` alignées à droite). Les cellules sont déjà échappées ou numériques. */
export function a4Table(t: A4Table) {
  const n = new Set(t.num ?? []);
  const cell = (v: string | number, i: number, tag: 'td' | 'th') => `<${tag}${n.has(i) ? ' class="n"' : ''}>${v}</${tag}>`;
  return `${t.title ? `<h2>${esc(t.title)}</h2>` : ''}<table><thead><tr>${t.head.map((x, i) => cell(esc(x), i, 'th')).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((v, i) => cell(v, i, 'td')).join('')}</tr>`).join('')}</tbody>${t.foot ? `<tfoot><tr>${t.foot.map((v, i) => cell(v, i, 'td')).join('')}</tr></tfoot>` : ''}</table>`;
}

const CSS = `
@page { size: A4; margin: 14mm 12mm 16mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.45 "Manrope", "Segoe UI", Arial, sans-serif; color: #1b1d2a; margin: 0; }
header { display: flex; gap: 14px; align-items: center; border-bottom: 2px solid #5B3DB0; padding-bottom: 10px; margin-bottom: 14px; }
header img { width: 46px; height: 46px; object-fit: contain; border-radius: 8px; }
header .co { flex: 1; } header .co b { font-size: 13pt; display: block; } header .co span { color: #555; font-size: 9pt; }
header .doc { text-align: right; } header .doc b { font-size: 14pt; display: block; color: #5B3DB0; } header .doc span { font-size: 9.5pt; color: #444; }
h2 { font-size: 11.5pt; margin: 16px 0 6px; color: #2b2550; break-after: avoid; }
table { width: 100%; border-collapse: collapse; margin-bottom: 6px; break-inside: auto; }
th, td { padding: 5px 7px; border-bottom: 1px solid #dcd8ea; text-align: left; vertical-align: top; }
th { background: #f1eefa; font-size: 9pt; text-transform: uppercase; letter-spacing: .03em; color: #3d3666; }
td.n, th.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tfoot td { font-weight: 800; border-top: 2px solid #5B3DB0; border-bottom: 0; }
tr { break-inside: avoid; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 4px 0 10px; }
.kpi { border: 1px solid #dcd8ea; border-radius: 8px; padding: 8px 10px; } .kpi span { font-size: 8.5pt; color: #555; display: block; } .kpi b { font-size: 12.5pt; }
.kpi.strong { background: #5B3DB0; color: #fff; border-color: #5B3DB0; } .kpi.strong span { color: #e8e2ff; }
.neg { color: #b42318; } .muted { color: #666; font-size: 9pt; }
footer { position: fixed; bottom: -10mm; left: 0; right: 0; font-size: 8pt; color: #777; display: flex; justify-content: space-between; }
`;

/** Ouvre l'impression A4 du document (titre, sous-titre/période, contenu HTML). */
export function printA4(title: string, subtitle: string, body: string) {
  const c: Company = { ...DEFAULT_COMPANY, ...(get<Company>('settings', 'company') ?? {}) };
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)} — ${esc(subtitle)}</title><style>${CSS}</style></head><body>
<header>${c.logo ? `<img src="${c.logo}" alt="">` : ''}<div class="co"><b>${esc(c.name)}</b><span>${esc([c.address, c.phone, c.nif ? 'NIF ' + c.nif : '', c.stat ? 'STAT ' + c.stat : ''].filter(Boolean).join(' · '))}</span></div>
<div class="doc"><b>${esc(title)}</b><span>${esc(subtitle)}</span></div></header>
${body}
<footer><span>${esc(c.name)} — Trésor en ligne</span><span>Imprimé le ${esc(new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }))}</span></footer>
</body></html>`;
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  const d = f.contentDocument!;
  d.open(); d.write(html); d.close();
  const go = () => { try { f.contentWindow!.focus(); f.contentWindow!.print(); } finally { setTimeout(() => f.remove(), 60_000); } };
  if (d.readyState === 'complete') setTimeout(go, 250); else f.onload = () => setTimeout(go, 250);
}
