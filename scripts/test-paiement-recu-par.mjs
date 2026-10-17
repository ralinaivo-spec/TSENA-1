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
  await t.save('orders', { id: 'o1', number: 'C-50', kind: 'order', channel: 'facebook', phone: '0348060933', name: 'Ny aina', zoneId: 'zone-centre', courierId: 'k1', status: 'delivered', dispatchedAt: now, returnedAt: now, deliveryFee: 4000, feeCharged: 4000, discount: 0,
    lines: [{ id: 'l1', variantId: 'v1', qty: 1, unitPrice: 35000, isChoice: true, qtyKept: 1, qtyReturned: 0 }, { id: 'l2', variantId: 'v2', qty: 1, unitPrice: 45000, isChoice: true, qtyKept: 0, qtyReturned: 1 }],
    payments: [{ id: 'pa', at: now, amount: 39000, method: 'cash', receivedBy: 'shop' }, { id: 'pb', at: now, amount: 4000, method: 'cash', receivedBy: 'courier', courierId: 'k1' }] }); });
await p.goto('http://localhost:5173/#/commandes/o1'); await p.waitForTimeout(500);
console.log((await p.locator('main').innerText()).match(/Trop perçu[^\n]*\n?[^\n]*/)?.[0]);
await p.getByRole('button', { name: 'Corriger ce paiement' }).first().click(); await p.waitForTimeout(300);
const d = p.getByRole('dialog');
await d.getByLabel(/Nouveau montant/).fill('35000');
await d.getByLabel('Argent reçu par').selectOption('courier');
await d.getByLabel('Motif').fill('Saisi par erreur comme payé à la boutique : encaissé par le livreur');
await d.getByRole('button', { name: 'Enregistrer la correction' }).click(); await p.waitForTimeout(500);
const o = await T(() => window.__tsena.get('orders', 'o1'));
ok(o.payments.every((x) => x.receivedBy === 'courier') && o.payments.reduce((s, x) => s + x.amount, 0) === 39000, 'paiements : 39 000 encaissés par le livreur, 0 à la boutique');
const main = await p.locator('main').innerText();
ok(!main.includes('Trop perçu') && !main.includes('Rendre l’argent'), 'plus de « trop perçu / à rendre »');
await p.getByRole('button', { name: 'Régler avec Tina' }).click(); await p.waitForTimeout(300);
const sd = p.getByRole('dialog');
const exp = (await sd.locator('.ml-expected').innerText()).replace(/\s/g, '');
console.log(exp);
ok(exp.includes('35000Ar'), 'frais gardés par le livreur : il remet 35 000');
await sd.getByLabel(/g\. Les frais du livreur/).selectOption('apart:cash'); await p.waitForTimeout(150);
ok((await sd.locator('.ml-expected').innerText()).replace(/\s/g, '').includes('39000Ar'), 'frais payés à part : il remet 39 000');
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT OK');
await b.close();
