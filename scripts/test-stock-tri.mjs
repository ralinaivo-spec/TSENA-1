import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:5173/'); await p.waitForTimeout(600);
await p.getByLabel("Nom d'utilisateur").fill('super-adm');
await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter');
await p.getByRole('button', { name: 'Plus tard' }).click(); await p.waitForTimeout(500);
await p.evaluate(async () => {
  const t = window.__tsena; const at = new Date().toISOString(); const old = new Date(Date.now() - 90 * 864e5).toISOString();
  await t.save('categories', [{ id: 'c1', name: 'PYJAMAS' }, { id: 'c2', name: 'SANDALE' }, { id: 'c3', name: 'MONTRE' }]);
  await t.save('products', [
    { id: 'p1', name: 'Pyjama cher', categoryId: 'c1', priceRetail: 40000, active: true, createdAt: old },
    { id: 'p2', name: 'Sandale rapide', categoryId: 'c2', priceRetail: 20000, active: true, createdAt: old },
    { id: 'p3', name: 'Montre lente', categoryId: 'c3', priceRetail: 50000, active: true, createdAt: at }]);
  await t.save('variants', [{ id: 'v1', productId: 'p1', sku: 'PJ', costAvg: 20000 }, { id: 'v2', productId: 'p2', sku: 'SD', costAvg: 8000 }, { id: 'v3', productId: 'p3', sku: 'MT', costAvg: 30000 }]);
  await t.save('stockMoves', [
    { variantId: 'v1', qty: 50, type: 'purchase', at: old }, { variantId: 'v2', qty: 30, type: 'purchase', at: old }, { variantId: 'v3', qty: 20, type: 'purchase', at: old },
    { variantId: 'v2', qty: -20, type: 'sale', at }, { variantId: 'v3', qty: -2, type: 'sale', at }]);
  const mk = (id, vid, qty, price) => ({ id, number: id, kind: 'order', channel: 'shop', status: 'delivered', createdAt: at, createdByName: 'X', lines: [{ id: id + 'l', variantId: vid, qty, qtyKept: qty, unitPrice: price }], payments: [], discount: 0, deliveryFee: 0 });
  await t.save('orders', [mk('O1', 'v2', 20, 20000), mk('O2', 'v3', 2, 50000)]);
  await t.save('boosts', [{ id: 'b1', pageId: 'c2', slot: 1, status: 'active', startDate: '2026-01-01' }]);
});
await p.goto('http://localhost:5173/#/stock/etat'); await p.waitForTimeout(700);
const names = await p.locator('table.table').last().locator('tbody tr strong').allInnerTexts();
console.log(names.join(' | '));
ok(names[0] === 'Pyjama cher', 'tri par défaut : plus grosse valeur en premier (Pyjama 1 000 000)');
const body = await p.locator('table.table').last().innerText();
ok(/Dormant/.test(body) && /À booster/.test(body) && /Rotation OK/.test(body), 'marques Dormant / À booster / Rotation OK');
await p.getByLabel('Marque').selectOption('boost'); await p.waitForTimeout(300);
const b2 = await p.locator('table.table').last().locator('tbody tr').count();
ok(b2 === 1 && (await p.locator('table.table').last().innerText()).includes('Montre lente'), 'filtre « À booster » : Montre seulement');
await p.getByLabel('Marque').selectOption(''); await p.getByLabel('Trier par').selectOption('qty'); await p.waitForTimeout(300);
ok((await p.locator('table.table').last().locator('tbody tr strong').first().innerText()) === 'Pyjama cher', 'tri par quantité');
await p.getByLabel('Trier par').selectOption('new'); await p.waitForTimeout(300);
ok((await p.locator('table.table').last().locator('tbody tr strong').first().innerText()) === 'Montre lente', 'tri plus récents');
const pg = await p.locator('.page-stock').innerText();
console.log(pg);
ok(/PYJAMAS[\s\S]*Mettre un boost/.test(pg) && /MONTRE[\s\S]*Mettre un boost/.test(pg) && /SANDALE[\s\S]*1 actif/.test(pg), 'résumé par page : conseils et boosts');
await p.screenshot({ path: '/tmp/claude-0/t/sr1.png', fullPage: true });
await p.goto('http://localhost:5173/#/'); await p.waitForTimeout(600);
const top = await p.locator('.money-in-stock').innerText();
ok(top.includes('Pyjama cher') && top.indexOf('Pyjama') < top.indexOf('Montre'), 'accueil : top 5 argent dans le stock');
await p.setViewportSize({ width: 390, height: 844 }); await p.goto('http://localhost:5173/#/stock/etat'); await p.waitForTimeout(500);
ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 392, 'mobile sans débordement');
await p.screenshot({ path: '/tmp/claude-0/t/sr2.png', fullPage: false });
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT OK');
await b.close();
