// Onglet « Annulées / refusées » : commandes annulées, livraisons refusées (réglées) et ventes sur place annulées,
// filtrées par la date d'annulation / de refus ; « Terminées » = livrées seulement ; ventes annulées signalées à la caisse.
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
  const t = window.__tsena; const now = new Date(); const old = new Date(now.getTime() - 3 * 86400000).toISOString(); const n = now.toISOString();
  await t.save('categories', { id: 'av', name: 'Antivol' });
  await t.save('products', { id: 'a', code: 'CH1', name: 'Chaîne', categoryId: 'av', priceRetail: 20000, active: true });
  await t.save('variants', { id: 'va', productId: 'a', sku: 'CH1', active: true });
  await t.save('zones', [{ id: 'z1', name: 'Tana', fee: 0, active: true }, { id: 'zone-retrait', name: 'Retrait boutique', fee: 0, active: true, pickup: true }]);
  await t.save('couriers', { id: 'tina', name: 'Tina', active: true });
  const L = (id) => [{ id: id + 'l', variantId: 'va', qty: 1, unitPrice: 20000, qtyKept: 0, qtyReturned: 1 }];
  const base = { kind: 'order', phone: '0320000000', payments: [], discount: 0, deliveryFee: 0, createdBy: 'user-superadmin' };
  await t.save('orders', [
    { ...base, id: 'X1', number: 'C-X1', channel: 'facebook', status: 'cancelled', zoneId: 'z1', createdAt: old, statusDates: { cancelled: n }, lines: L('X1') },
    { ...base, id: 'X2', number: 'C-X2', channel: 'facebook', status: 'refused', zoneId: 'z1', courierId: 'tina', createdAt: old, dispatchedAt: old, returnedAt: n, courierSettledAt: n, lines: L('X2') },
    { ...base, id: 'X3', number: 'C-X3', channel: 'facebook', status: 'delivered', zoneId: 'z1', courierId: 'tina', createdAt: old, dispatchedAt: old, returnedAt: n, courierSettledAt: n, lines: [{ id: 'X3l', variantId: 'va', qty: 1, unitPrice: 20000, qtyKept: 1 }] },
    { ...base, id: 'V9', number: 'V-9', channel: 'shop', status: 'cancelled', zoneId: 'zone-retrait', createdAt: n, statusDates: { cancelled: n }, lines: L('V9') },
  ]);
});
await p.goto('http://localhost:5173/#/commandes/annulees'); await p.waitForTimeout(700);
let tx = N(await p.locator('main').innerText());
ok(tx.includes('Annulées / refusées'), 'onglet renommé « Annulées / refusées »');
ok(tx.includes('C-X1') && tx.includes('C-X2') && tx.includes('V-9') && !tx.includes('C-X3'), 'annulée, refusée et vente sur place annulée (datées d’aujourd’hui), pas la livrée');
await p.goto('http://localhost:5173/#/commandes/terminees'); await p.waitForTimeout(600);
tx = N(await p.locator('main').innerText());
ok(tx.includes('C-X3') && !tx.includes('C-X2'), 'Terminées : livrées seulement');
await p.goto('http://localhost:5173/#/vente'); await p.waitForTimeout(600);
await p.getByRole('button', { name: 'Toutes', exact: true }).click().catch(() => {}); await p.waitForTimeout(300);
tx = N(await p.locator('main').innerText());
ok(tx.includes('vente(s) annulée(s)') && tx.includes('V-9'), 'vente sur place : vente annulée signalée avec lien');
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST BON'); await b.close();
process.exit(fail ? 1 : 0);
