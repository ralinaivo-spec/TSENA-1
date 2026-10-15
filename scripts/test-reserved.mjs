// Stock réservé : 8 en stock, 6 réservés par des commandes pas encore remises au livreur → 2 disponibles.
// Ajouter un article (nouvelle commande) : « 2 dispo · 8 en stock · 6 réservé(s) » ; Stock : colonnes Réservé / Disponible ;
// Détail : liste des commandes qui réservent.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Indian/Antananarivo' })).newPage();
const N = (t) => t.replace(/[\s  ]+/g, ' ');
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
p.on('pageerror', (e) => { console.log('ERR', e.message); fail++; });
await p.goto('http://localhost:5173/'); await p.waitForTimeout(600);
await p.getByLabel("Nom d'utilisateur").fill('super-adm'); await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
await p.getByRole('button', { name: 'Plus tard' }).click({ timeout: 1500 }).catch(() => {});
await p.evaluate(async () => {
  const t = window.__tsena; const now = new Date().toISOString();
  await t.save('categories', { id: 'bx', name: 'Boxer homme' });
  await t.save('products', { id: 'a', code: 'BXH7L', name: 'Rayure', categoryId: 'bx', priceRetail: 9000, active: true });
  await t.save('variants', { id: 'va', productId: 'a', sku: 'BOXHOMME-BXH7-L', active: true });
  await t.save('stockMoves', { variantId: 'va', qty: 8, type: 'initial', at: now });
  const o = (id, status, lines) => ({ id, number: id, kind: 'order', channel: 'facebook', phone: '0340000000', name: 'Client ' + id, status, zoneId: '', lines, payments: [], discount: 0, deliveryFee: 0, createdBy: 'user-superadmin', createdAt: now });
  await t.save('orders', [
    o('C-1', 'new', [{ id: 'l1', variantId: 'va', qty: 3, unitPrice: 9000 }]),
    o('C-2', 'ready', [{ id: 'l2', variantId: 'va', qty: 2, unitPrice: 9000 }, { id: 'l3', variantId: 'va', qty: 1, unitPrice: 9000, isChoice: true }]),
    o('C-3', 'delivered', [{ id: 'l4', variantId: 'va', qty: 5, unitPrice: 9000, qtyKept: 5 }]),
  ]);
});
await p.goto('http://localhost:5173/#/stock'); await p.waitForTimeout(600);
const row = N(await p.locator('tr', { hasText: 'BOXHOMME-BXH7-L' }).innerText());
ok(/\b8\b.*\b6\b.*\b2\b/.test(row), `Stock : 8 en stock, 6 réservés, 2 disponibles (${row})`);
await p.locator('tr', { hasText: 'BOXHOMME-BXH7-L' }).getByRole('button', { name: 'Détail' }).click(); await p.waitForTimeout(400);
let tx = N(await p.getByRole('dialog').innerText());
ok(tx.includes('Réservé par des commandes en cours : 6') && tx.includes('disponible pour une nouvelle commande : 2') && tx.includes('C-1') && tx.includes('C-2') && !tx.includes('Client C-3'), 'Détail : les 2 commandes qui réservent (pas la livrée)');
await p.keyboard.press('Escape');
await p.goto('http://localhost:5173/#/commandes/enregistrees'); await p.waitForTimeout(400);
await p.getByRole('button', { name: 'Nouvelle commande' }).click(); await p.waitForTimeout(300);
await p.getByRole('button', { name: 'Ajouter un article' }).click(); await p.waitForTimeout(300);
tx = N(await p.getByRole('dialog').last().innerText());
ok(tx.includes('2 dispo') && tx.includes('8 en stock · 6 réservé(s)'), 'Ajouter un article : 2 dispo · 8 en stock · 6 réservé(s)');
await p.getByRole('dialog').last().getByText('Rayure').click(); await p.waitForTimeout(300);
tx = N(await p.getByRole('dialog').last().innerText());
ok(tx.includes('2 dispo') && tx.includes('8 en stock · 6 réservé(s) par des commandes en cours'), 'choix de la taille : même détail');
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST BON'); await b.close();
process.exit(fail ? 1 : 0);
