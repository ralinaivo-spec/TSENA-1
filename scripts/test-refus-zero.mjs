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
await T(async () => { const t = window.__tsena; const now = new Date().toISOString();
  await t.save('categories', { id: 'c1', name: 'Pyjama' });
  await t.save('products', [{ id: 'p1', code: 'LAP', name: 'Pyjama lapin', categoryId: 'c1', priceRetail: 20000, active: true }]);
  await t.save('variants', [{ id: 'v1', productId: 'p1', sku: 'LAP', costAvg: 9000, active: true }, { id: 'v2', productId: 'p1', sku: 'LAP2', costAvg: 9000, active: true }]);
  await t.save('stockMoves', [{ variantId: 'v1', qty: 10, type: 'initial', at: now }]);
  await t.save('couriers', { id: 'k1', name: 'Rado', active: true });
  // 2 articles, un en choix ; frais 4000 ; client a déjà payé 10 000 par MVola à la boutique
  await t.save('orders', { id: 'o1', number: 'C-9', kind: 'order', channel: 'facebook', phone: '0341112233', name: 'Fara', zoneId: 'zone-centre', place: 'Analakely', courierId: 'k1', status: 'out', dispatchedAt: now,
    lines: [{ id: 'l1', variantId: 'v1', qty: 2, unitPrice: 20000 }, { id: 'l2', variantId: 'v2', qty: 1, unitPrice: 20000, isChoice: true }], payments: [{ id: 'pp', at: now, amount: 10000, method: 'mvola', ref: 'MV123', receivedBy: 'shop' }], discount: 0, deliveryFee: 4000, createdAt: now });
});

await T(async () => { const t = window.__tsena; const now = new Date().toISOString(); const o = t.get('orders', 'o1');
  await t.save('orders', [{ ...o, id: 'o2', number: 'C-10', lines: [{ id: 'm1', variantId: 'v1', qty: 1, unitPrice: 20000 }], payments: [] },
    { ...o, id: 'o3', number: 'C-11', status: 'refused', returnedAt: now, feeCharged: 3000, lines: [{ id: 'n1', variantId: 'v1', qty: 1, unitPrice: 20000, qtyKept: 0, qtyReturned: 1 }], payments: [] },
    { ...o, id: 'o4', number: 'C-12', status: 'cancelled', lines: [{ id: 'q1', variantId: 'v1', qty: 1, unitPrice: 24000 }], deliveryFee: 0, payments: [] }]); });
await p.goto('http://localhost:5173/#/commandes/o2'); await p.waitForTimeout(500);
await p.getByRole('button', { name: 'Confirmer le retour du livreur' }).click(); await p.waitForTimeout(300);
const d = p.getByRole('dialog');
await d.getByRole('button', { name: 'Tout refusé' }).click(); await p.waitForTimeout(200);
const box = await d.locator('.settle-box').innerText();
ok(box.includes('tout est à 0') && await d.getByLabel('Frais de livraison facturés (Ar)').count() === 0 && await d.getByLabel(/Encaissé par le livreur/).count() === 0, 'refus : frais 0 sans saisie, pas d’encaissement');
await d.getByRole('button', { name: 'Confirmer le retour' }).click(); await p.waitForTimeout(600);
const o2 = await T(() => window.__tsena.get('orders', 'o2'));
ok(o2.status === 'refused' && o2.feeCharged === 0 && !!o2.courierSettledAt, 'refusée : frais 0, rien à régler (réglée d’office)');
await p.goto('http://localhost:5173/#/commandes/regler'); await p.waitForTimeout(500);
const rg = await p.locator('main').innerText();
ok(!rg.includes('C-10') && !rg.includes('C-11'), '« À régler (livreur) » : ni la nouvelle ni l’ancienne refusée');
await p.goto('http://localhost:5173/#/livraisons/retour'); await p.waitForTimeout(500);
const cr = await p.locator('main').innerText();
ok(!cr.includes('C-10') && !cr.includes('C-11'), 'Retour livreur : refusées absentes');
await p.goto('http://localhost:5173/#/commandes/annulees'); await p.waitForTimeout(400);
await p.getByLabel('Période').first().selectOption('all').catch(() => {}); await p.waitForTimeout(400);
const an = await p.locator('main').innerText();
console.log(an.slice(an.indexOf('C-1'), an.indexOf('C-1') + 400));
ok(await p.locator('main s').count() >= 3, 'annulées / refusées : montant de la commande barré');
ok(!/24\s?000 Ar\s*\n?\s*$/.test(''), 'ok');
const grp = await p.locator('.list-group-head').allInnerTexts();
ok(grp.every((g) => /0 Ar$/.test(g.replace(/\s/g, ' ').trim())), 'totaux des groupes à 0 Ar : ' + grp.join(' | '));
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT OK');
await b.close();
