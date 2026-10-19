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



const iso = (d, h = 12) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, 0, 0, 0); return x.toISOString(); };
const local = (d, h) => { const x = new Date(); x.setDate(x.getDate() - d); const p2 = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}T${p2(h)}:00`; };
await T(async ({ a, b, c }) => { const t = window.__tsena;
  await t.save('categories', { id: 'c1', name: 'MONTRE' });
  await t.save('products', [{ id: 'p1', code: 'M1', name: 'Montre', categoryId: 'c1', priceRetail: 153000, active: true }]);
  await t.save('variants', [{ id: 'v1', productId: 'p1', sku: 'M1', costAvg: 50000, active: true }]);
  await t.save('couriers', { id: 'k1', name: 'Tina', active: true });
  await t.save('orders', [
    { id: 'o1', number: 'C-C0008', kind: 'order', channel: 'facebook', phone: '0340000000', name: 'X', zoneId: 'zone-centre', courierId: 'k1', status: 'out', createdAt: a, dispatchedAt: b, deliveryFee: 0, discount: 0, lines: [{ id: 'l1', variantId: 'v1', qty: 1, unitPrice: 153000 }], payments: [{ id: 'pa', at: b, amount: 153000, method: 'orange', receivedBy: 'shop' }] },
    { id: 'o2', number: 'C-C0009', kind: 'order', channel: 'facebook', phone: '0340000001', name: 'Y', zoneId: 'zone-centre', courierId: 'k1', status: 'delivered', createdAt: a, dispatchedAt: b, returnedAt: b, courierSettledAt: c, deliveryFee: 0, discount: 0, lines: [{ id: 'm1', variantId: 'v1', qty: 1, qtyKept: 1, unitPrice: 153000 }], payments: [{ id: 'pb', at: b, amount: 153000, method: 'mvola', receivedBy: 'shop' }] }]); }, { a: iso(20), b: iso(2, 18), c: iso(1) });
await p.goto('http://localhost:5173/#/commandes/o1'); await p.waitForTimeout(500);
await p.getByRole('button', { name: 'Corriger ce paiement' }).first().click(); await p.waitForTimeout(300);
let d = p.getByRole('dialog');
await d.getByLabel('Date réelle du paiement').fill(local(-1, 10)); await p.waitForTimeout(200);
ok((await d.innerText()).includes('futur') && await d.getByRole('button', { name: 'Enregistrer la correction' }).isDisabled(), 'date dans le futur refusée');
await d.getByLabel('Date réelle du paiement').fill(local(25, 10)); await p.waitForTimeout(200);
ok((await d.innerText()).includes('avant la commande'), 'date avant la commande refusée');
await d.getByLabel('Date réelle du paiement').fill(local(4, 11)); await p.waitForTimeout(200);
await d.getByRole('button', { name: 'Enregistrer la correction' }).click(); await p.waitForTimeout(500);
let o = await T(() => window.__tsena.get('orders', 'o1'));
ok(new Date(o.payments[0].at).getDate() === new Date(Date.now() - 4 * 864e5).getDate() && o.payments[0].edits?.[0]?.toAt, 'date du paiement corrigée (avant la livraison, compte livreur pas fait)');
ok((await p.locator('main').innerText()).includes('· date'), 'historique : « date … → … » affiché');
// date après le départ chez le livreur mais compte pas fait : autorisé
await p.getByRole('button', { name: 'Corriger ce paiement' }).first().click(); await p.waitForTimeout(300);
d = p.getByRole('dialog');
await d.getByLabel('Date réelle du paiement').fill(local(0, 9)); await p.waitForTimeout(200);
ok(!(await d.innerText()).includes('impossible') && await d.getByRole('button', { name: 'Enregistrer la correction' }).isEnabled(), 'après la date de livraison mais compte livreur pas fait : autorisé');
await d.getByRole('button', { name: 'Annuler' }).click();
// semaine versée
await T(async ({ w }) => { const t = window.__tsena; const m = new Date(w); const day = (m.getDay() + 6) % 7; m.setDate(m.getDate() - day); const p2 = (n) => String(n).padStart(2, '0'); const ymd = (x) => `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`; const e = new Date(m); e.setDate(m.getDate() + 5);
  await t.save('payouts', { id: 'po_' + ymd(m), weekStart: ymd(m), weekEnd: ymd(e), status: 'paid', amount: 1, at: new Date().toISOString(), byName: 'Gerant', sales: 0, expenses: 0, expected: 1, gap: 0, account: 'cash', perPage: [], expenseIds: [] }); }, { w: iso(9) });
await p.getByRole('button', { name: 'Corriger ce paiement' }).first().click(); await p.waitForTimeout(300);
d = p.getByRole('dialog');
await d.getByLabel('Date réelle du paiement').fill(local(9, 10)); await p.waitForTimeout(200);
const t9 = await d.innerText();
ok(t9.includes('clôturée'), 'semaine déjà versée (ou avant commande) refusée');
await d.getByRole('button', { name: 'Annuler' }).click();
// compte livreur fait : verrouillé
await p.goto('http://localhost:5173/#/commandes/o2'); await p.waitForTimeout(500);
await p.getByRole('button', { name: 'Corriger ce paiement' }).first().click(); await p.waitForTimeout(300);
d = p.getByRole('dialog');
ok(await d.getByLabel('Date réelle du paiement').count() === 0 && (await d.innerText()).includes('ne peut plus changer'), 'compte livreur fait : date verrouillée');
await d.getByRole('button', { name: 'Annuler' }).click();
// nouveau paiement avec date
await p.goto('http://localhost:5173/#/commandes/o1'); await p.waitForTimeout(400);
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT OK');
await b.close();
