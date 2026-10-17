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
await p.evaluate(async () => { const t = window.__tsena; const at = new Date().toISOString();
  await t.save('categories', [{ id: 'c1', name: 'PYJAMAS' }, { id: 'c1a', name: 'Enfant', parentId: 'c1' }, { id: 'c2', name: 'SANDALE' }]);
  await t.save('products', [
    { id: 'p1', code: 'A1', name: 'Petit stock récent', categoryId: 'c1a', active: true, createdAt: at },
    { id: 'p2', code: 'A2', name: 'Gros argent ancien', categoryId: 'c1a', active: true, createdAt: '2020-01-01' },
    { id: 'p3', code: 'A3', name: 'Beaucoup pas cher', categoryId: 'c1', active: true, createdAt: '2021-01-01' },
    { id: 'p4', code: 'B1', name: 'Sandale', categoryId: 'c2', active: true, createdAt: '2022-01-01' }]);
  await t.save('variants', [{ id: 'v1', productId: 'p1', sku: 'A1', costAvg: 1000 }, { id: 'v2', productId: 'p2', sku: 'A2', costAvg: 50000 }, { id: 'v3', productId: 'p3', sku: 'A3', costAvg: 500 }, { id: 'v4', productId: 'p4', sku: 'B1', costAvg: 9000 }]);
  await t.save('stockMoves', [{ variantId: 'v1', qty: 2, type: 'purchase', at }, { variantId: 'v2', qty: 10, type: 'purchase', at }, { variantId: 'v3', qty: 100, type: 'purchase', at }, { variantId: 'v4', qty: 5, type: 'purchase', at }]); });
const first = async (sel) => (await p.locator(sel).first().innerText()).trim();
for (const [path, sel, name] of [['#/articles', '.list .list-item-title', 'Articles'], ['#/stock/etat', 'table.table >> nth=-1 >> tbody tr strong', 'Stock']]) {
  await p.goto('http://localhost:5173/' + path); await p.waitForTimeout(600);
  ok(await first(sel) === 'Gros argent ancien', `${name} : par défaut, plus grosse valeur d’abord`);
  ok((await p.locator('.sort-now').innerText()).includes('Valeur en stock'), `${name} : « Trié par : Valeur en stock ↓ » affiché`);
  await p.getByLabel('Catégorie').first().selectOption('c1'); await p.waitForTimeout(400);
  ok(await first(sel) === 'Gros argent ancien' && await p.getByLabel('Trier par').inputValue() === 'value', `${name} : filtre catégorie → tri gardé`);
  await p.getByLabel('Trier par').selectOption('qty'); await p.waitForTimeout(300);
  ok(await first(sel) === 'Beaucoup pas cher', `${name} : tri quantité`);
  await p.getByLabel('Catégorie').first().selectOption('c2'); await p.waitForTimeout(300); await p.getByLabel('Catégorie').first().selectOption(''); await p.waitForTimeout(300);
  ok(await p.getByLabel('Trier par').inputValue() === 'qty', `${name} : tri manuel gardé en changeant de catégorie`);
  await p.reload(); await p.waitForTimeout(900);
  const later = p.getByRole('button', { name: 'Plus tard' }); if (await later.count()) await later.click();
  ok(await p.getByLabel('Trier par').inputValue() === 'qty', `${name} : tri gardé après rechargement`);
  await p.getByRole('button', { name: 'Revenir au tri par défaut' }).click(); await p.waitForTimeout(300);
  ok(await p.getByLabel('Trier par').inputValue() === 'value' && await p.getByRole('button', { name: 'Revenir au tri par défaut' }).count() === 0, `${name} : retour au tri par défaut`);
}
await p.goto('http://localhost:5173/#/articles'); await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/claude-0/t/sr4.png' });
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 392, 'mobile sans débordement');
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT OK');
await b.close();
