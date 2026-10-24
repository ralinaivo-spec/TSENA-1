import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1300, height: 1100 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:5173/');
await p.getByLabel("Nom d'utilisateur").fill('super-adm');
await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter');
await p.getByRole('button', { name: 'Plus tard' }).click(); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const db = await new Promise(r => { const q = indexedDB.open('tsena'); q.onsuccess = () => r(q.result); });
  const pt = (t, rec) => new Promise(r => { const tx = db.transaction(t, 'readwrite'); tx.objectStore(t).put(rec); tx.oncomplete = r; });
  const now = new Date().toISOString();
  await pt('categories', { id: 'cat1', name: 'ANTIVOL', createdAt: now, updatedAt: now });
  await pt('products', { id: 'p1', name: 'Chaîne antivol Bold 105 cm 350 g', categoryId: 'cat1', active: true, createdAt: now, updatedAt: now });
  await pt('variants', { id: 'v1', productId: 'p1', sku: 'A1', active: true, createdAt: now, updatedAt: now });
  await pt('couriers', { id: 'c1', name: 'Johnson', active: true, createdAt: now, updatedAt: now });
  await pt('orders', { id: 'o1', number: 'C-N0023', kind: 'order', channel: 'facebook', phone: '0381151161', name: 'Alain Gerald', zoneId: 'zone-centre', place: 'Andranomena', wantedDate: '2026-10-22', deliveryFee: 5000, discount: 0, payments: [], status: 'out', courierId: 'c1', dispatchedAt: now,
    lines: [{ id: 'l1', variantId: 'v1', qty: 1, unitPrice: 20000 }], createdAt: now, updatedAt: now });
});
await p.reload(); await p.waitForTimeout(1500);
await p.goto('http://localhost:5173/#/commandes/o1'); await p.waitForTimeout(1000);
await p.getByRole('button', { name: 'Imprimer' }).first().click(); await p.waitForTimeout(600);
for (const name of ['Étiquette du colis (58 mm)', 'Bon de livraison', 'Ticket client']) {
  await p.getByRole('button', { name }).click(); await p.waitForTimeout(400);
  await p.locator('.ticket-preview').screenshot({ path: `/tmp/claude-0/t/tk-${name.slice(0,4)}.png` });
  console.log(name, '\n' + (await p.locator('.ticket-preview .ticket').innerText()));
}
await b.close();
