import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const W = Number(process.argv[2] || 1280);
const p = await (await b.newContext({ viewport: { width: W, height: 880 } })).newPage();
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
p.on('pageerror', (e) => console.log('ERR', e.message));
const T = (fn, a) => p.evaluate(fn, a);
await p.goto('http://localhost:5173/'); await p.waitForTimeout(600);
await p.getByLabel("Nom d'utilisateur").fill('super-adm'); await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter');
await p.getByRole('button', { name: 'Plus tard' }).click(); await p.waitForTimeout(400);

// Reproduction : choix 35 000 gardé (l'autre 45 000 rendu), frais 4 000 ; le vendeur a saisi 39 000 « payé à la boutique » ; livreur 4 000.
await T(async () => { const t = window.__tsena; const now = new Date().toISOString();
  await t.save('categories', { id: 'c1', name: 'Coffret' });
  await t.save('products', [{ id: 'p1', code: 'CF25', name: 'Coffret homme', categoryId: 'c1', priceRetail: 35000, active: true }, { id: 'p2', code: 'CF13', name: 'Coffret homme', categoryId: 'c1', priceRetail: 45000, active: true }]);
  await t.save('variants', [{ id: 'v1', productId: 'p1', sku: 'CF25', costAvg: 15000, active: true }, { id: 'v2', productId: 'p2', sku: 'CF13', costAvg: 20000, active: true }]);
  await t.save('couriers', { id: 'k1', name: 'Tina', active: true });
  await t.save('orders', { id: 'o1', number: 'C-50', kind: 'order', channel: 'facebook', phone: '0348060933', name: 'Ny aina', zoneId: 'zone-centre', courierId: 'k1', status: 'out', dispatchedAt: now, deliveryFee: 4000, discount: 0,
    lines: [{ id: 'l1', variantId: 'v1', qty: 1, unitPrice: 35000, isChoice: true }, { id: 'l2', variantId: 'v2', qty: 1, unitPrice: 45000, isChoice: true }],
    payments: [{ id: 'pa', at: now, amount: 39000, method: 'cash', receivedBy: 'shop' }] });
  await t.save('stockMoves', [{ variantId: 'v1', qty: 5, type: 'initial', at: now }, { variantId: 'v2', qty: 5, type: 'initial', at: now }, { variantId: 'v1', qty: -1, type: 'dispatch', refType: 'order', refId: 'o1', at: now }, { variantId: 'v2', qty: -1, type: 'dispatch', refType: 'order', refId: 'o1', at: now }]); });

const stock = () => T(() => { const m = window.__tsena.all('stockMoves'); const s = (v) => m.filter((x) => x.variantId === v).reduce((a, x) => a + x.qty, 0); return [s('v1'), s('v2')]; });
await p.goto('http://localhost:5173/#/commandes/o1'); await p.waitForTimeout(500);
await p.getByRole('button', { name: 'Préciser le choix du client' }).first().click(); await p.waitForTimeout(300);
let d = p.getByRole('dialog');
await d.getByLabel('Gardé').nth(0).fill('1'); await d.getByLabel('Gardé').nth(1).fill('0');
await d.getByLabel(/Encaissé par le livreur/).fill('4000');
await d.getByRole('button', { name: 'Confirmer le retour' }).click(); await p.waitForTimeout(600);
let o = await T(() => window.__tsena.get('orders', 'o1'));
ok(o.status === 'delivered' && (await stock()).join() === '4,5', 'situation de l’erreur reproduite (retour fait, stock 4/5)');
await p.reload(); await p.waitForTimeout(700);
await p.getByRole('button', { name: /Remettre en livraison/ }).click(); await p.waitForTimeout(300);
await p.getByRole('dialog').getByRole('button', { name: 'Remettre en livraison' }).click(); await p.waitForTimeout(700);
o = await T(() => window.__tsena.get('orders', 'o1'));
ok(o.status === 'out' && !o.returnedAt && o.lines.every((l) => l.qtyKept == null), 'commande de nouveau « En livraison »');
ok(o.payments.length === 1 && o.payments[0].id === 'pa', 'encaissement du retour (4 000) retiré, paiement boutique gardé');
ok((await stock()).join() === '4,4', 'stock : les 2 coffrets de nouveau chez le livreur');
ok(o.choiceNote?.kept?.l1 === 1 && o.choiceNote?.kept?.l2 === 0, 'choix gardé pré-rempli (1 / 0)');
await p.goto('http://localhost:5173/#/commandes/regler'); await p.waitForTimeout(400);
ok(!(await p.locator('main').innerText()).includes('C-50'), 'plus dans « À régler (livreur) »');
await p.goto('http://localhost:5173/#/commandes/o1'); await p.waitForTimeout(500);
{ const sb = (await p.locator('.summary-box').innerText()).replace(/\s/g, ''); console.log(sb); ok(sb.includes('Articles(aveclechoixindiqué)35000Ar') && sb.includes('Total39000Ar'), 'en livraison : total attendu 39 000 avec le choix indiqué'); }
await p.goto('http://localhost:5173/#/livraisons/retour'); await p.waitForTimeout(500);
ok((await p.locator('main').innerText()).includes('C-50'), 'de retour dans la liste du livreur (Retour livreur)');
// correction du paiement puis retour refait
await p.goto('http://localhost:5173/#/commandes/o1'); await p.waitForTimeout(500);
await p.getByRole('button', { name: 'Corriger ce paiement' }).first().click(); await p.waitForTimeout(300);
d = p.getByRole('dialog');
await d.getByLabel('Argent reçu par').selectOption('courier');
await d.getByRole('button', { name: 'Enregistrer la correction' }).click(); await p.waitForTimeout(500);
await p.getByRole('button', { name: 'Confirmer le retour du livreur' }).click(); await p.waitForTimeout(300);
d = p.getByRole('dialog');
const box = (await d.locator('.settle-box').innerText()).replace(/\s/g, '');
console.log(box);
await d.getByRole('button', { name: 'Confirmer le retour' }).click(); await p.waitForTimeout(600);
o = await T(() => window.__tsena.get('orders', 'o1'));
const main = await p.locator('main').innerText();
ok(o.status === 'delivered' && !main.includes('Trop perçu') && (await stock()).join() === '4,5', 'retour refait : 39 000 encaissés par le livreur, rien à rendre, stock juste');
await p.getByRole('button', { name: 'Régler avec Tina' }).click(); await p.waitForTimeout(300);
ok((await p.getByRole('dialog').locator('.ml-expected').innerText()).replace(/\s/g, '').includes('35000Ar'), 'règlement : Tina remet 35 000 (frais 4 000 gardés)');
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT OK');
await b.close();
