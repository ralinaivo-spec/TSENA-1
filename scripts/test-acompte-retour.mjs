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


await T(async () => { const t = window.__tsena; const now = new Date().toISOString(); const d15 = new Date(Date.now() - 2 * 864e5).toISOString();
  await t.save('categories', { id: 'c1', name: 'PYJAMAS FEMME' });
  await t.save('products', [{ id: 'p1', code: 'PA30', name: 'PA30 L COE', categoryId: 'c1', priceRetail: 40000, active: true }, { id: 'p2', code: 'PA28', name: 'PA28 L COF', categoryId: 'c1', priceRetail: 40000, active: true }]);
  await t.save('variants', [{ id: 'v1', productId: 'p1', sku: 'PA30', costAvg: 15000, active: true }, { id: 'v2', productId: 'p2', sku: 'PA28', costAvg: 15000, active: true }]);
  await t.save('couriers', { id: 'k1', name: 'Tina', active: true });
  await t.save('stockMoves', [{ variantId: 'v1', qty: 5, type: 'initial', at: d15 }, { variantId: 'v2', qty: 5, type: 'initial', at: d15 }, { variantId: 'v1', qty: -1, type: 'dispatch', refType: 'order', refId: 'o1', at: now }, { variantId: 'v2', qty: -1, type: 'dispatch', refType: 'order', refId: 'o1', at: now }]);
  await t.save('orders', { id: 'o1', number: 'C-70', kind: 'order', channel: 'facebook', phone: '0340000000', name: 'Cliente', zoneId: 'zone-centre', courierId: 'k1', status: 'out', createdAt: d15, dispatchedAt: now, deliveryFee: 5000, discount: 0,
    lines: [{ id: 'l1', variantId: 'v1', qty: 1, unitPrice: 40000 }, { id: 'l2', variantId: 'v2', qty: 1, unitPrice: 40000 }],
    payments: [{ id: 'pa', at: d15, amount: 40000, method: 'mvola', ref: '895/273', receivedBy: 'shop' }, { id: 'pb', at: d15, amount: 45000, method: 'cash', receivedBy: 'courier', courierId: 'k1' }] }); });
await p.goto('http://localhost:5173/#/commandes/o1'); await p.waitForTimeout(500);
await p.getByRole('button', { name: 'Confirmer le retour du livreur' }).click(); await p.waitForTimeout(300);
const d = p.getByRole('dialog');
await d.getByLabel('Gardé').nth(0).fill('0'); await p.waitForTimeout(200);
const txt = await d.innerText();
ok(txt.replace(/\s/g, '').includes('45000Arétaientnotésd’avance'), 'avertissement : 45 000 noté d’avance remplacé');
ok(await d.getByLabel(/Encaissé par le livreur/).inputValue() === '5000', 'encaissé par le livreur proposé : 5 000 (45 000 − 40 000 d’acompte)');
await d.getByRole('button', { name: 'Confirmer le retour' }).click(); await p.waitForTimeout(600);
const o = await T(() => window.__tsena.get('orders', 'o1'));
ok(o.payments.length === 2 && o.payments.some((x) => x.receivedBy === 'shop' && x.amount === 40000) && o.payments.some((x) => x.receivedBy === 'courier' && x.amount === 5000), 'paiements : acompte 40 000 boutique + 5 000 livreur');
const main = await p.locator('main').innerText();
ok(!main.includes('Trop perçu') && /Reste à encaisser\s*0 Ar/.test(main), 'plus de trop perçu : reste 0');
await p.getByRole('button', { name: 'Régler avec Tina' }).click(); await p.waitForTimeout(300);
const sd = p.getByRole('dialog');
ok((await sd.locator('.ml-expected').innerText()).replace(/\s/g, '').includes('0Ar') && !(await sd.locator('.ml-expected').innerText()).includes('45'), 'Tina garde ses 5 000 de frais : rien à remettre');
await sd.getByLabel(/g\. Les frais du livreur/).selectOption('apart:cash'); await p.waitForTimeout(150);
ok((await sd.locator('.ml-expected').innerText()).replace(/\s/g, '').includes('5000Ar'), 'frais payés à part : Tina remet 5 000');
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT OK');
await b.close();
