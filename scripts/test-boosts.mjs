import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const W = Number(process.argv[2] || 1280);
const p = await (await b.newContext({ viewport: { width: W, height: 900 }, timezoneId: 'Indian/Antananarivo' })).newPage();
const N = (t) => t.replace(/[  ]/g, ' ');
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
p.on('pageerror', (e) => { console.log('ERR', e.message); fail++; });
await p.goto('http://localhost:5173/'); await p.waitForTimeout(600);
await p.getByLabel("Nom d'utilisateur").fill('super-adm'); await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter');
await p.getByRole('button', { name: 'Plus tard' }).click(); await p.waitForTimeout(400);
const T = await p.evaluate(async () => { const t = window.__tsena; const pad = (n) => String(n).padStart(2, '0'); const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const d0 = new Date(); const d1 = new Date(Date.now() - 864e5); const d2 = new Date(Date.now() - 2 * 864e5); const today = ymd(d0), y1 = ymd(d1), y2 = ymd(d2);
  await t.save('categories', [{ id: 'pg1', name: 'Pyjamas' }, { id: 'pg2', name: 'Lampes' }]);
  await t.save('products', { id: 'p1', code: 'PJ', name: 'Pyjama', categoryId: 'pg1', priceRetail: 20000, active: true });
  await t.save('variants', { id: 'v1', productId: 'p1', sku: 'PJ', costAvg: 8000, active: true });
  await t.save('stockMoves', { variantId: 'v1', qty: 20, type: 'initial', at: d0.toISOString() });
  await t.save('boosts', [{ id: 'b1', pageId: 'pg1', slot: 1, label: 'PROMO A', startDate: y2, status: 'active' }, { id: 'b2', pageId: 'pg1', slot: 2, label: 'PROMO B', startDate: y2, status: 'active' }]);
  await t.save('boostReadings', [{ id: `br_b1_${y2}`, boostId: 'b1', pageId: 'pg1', date: y2, spend: 1, messages: 100 }, { id: `br_b1_${y1}`, boostId: 'b1', pageId: 'pg1', date: y1, spend: 2, messages: 120 },
    { id: `br_b2_${y2}`, boostId: 'b2', pageId: 'pg1', date: y2, spend: 1, messages: 10 }, { id: `br_b2_${y1}`, boostId: 'b2', pageId: 'pg1', date: y1, spend: 2, messages: 15 }]);
  await t.save('orders', { id: 'o1', number: 'V-1', kind: 'order', channel: 'shop', phone: '', status: 'delivered', lines: [{ id: 'l', variantId: 'v1', qty: 2, unitPrice: 20000, qtyKept: 2 }], payments: [], discount: 0, deliveryFee: 0, createdAt: d0.toISOString() });
  return { today, y1, y2 }; });
await p.goto('http://localhost:5173/#/boosts/suivi'); await p.waitForTimeout(500);
await p.getByLabel('Page').first().selectOption('pg1').catch(async () => { await p.getByLabel('Page').first().click(); await p.getByRole('option', { name: 'Pyjamas' }).click(); });
await p.waitForTimeout(300);
let main = N(await p.locator('main').innerText());
ok(main.includes('PROMO A') && main.includes('Semaine du'), 'tableau de la semaine affiché');
const cellA = p.getByLabel(/Conversations boost 1 /).last();
ok(await p.getByLabel(new RegExp(`Conversations boost 1 ${T.y1.slice(8)}/`)).inputValue() === '120', 'J-1 déjà rempli par l’historique (120)');
await cellA.fill('130'); await cellA.press('Enter'); await p.waitForTimeout(400);
main = N(await p.locator('main').innerText());
const r = await p.evaluate((d) => window.__tsena.get('boostReadings', `br_b1_${d}`), T.today);
ok(r?.messages === 130, 'saisie du jour enregistrée en quittant la case');
ok(main.includes('+10'), 'différence du jour +10');
await cellA.fill('100'); await cellA.press('Enter'); await p.waitForTimeout(400);
ok((await p.evaluate((d) => window.__tsena.get('boostReadings', `br_b1_${d}`), T.today)).messages === 130, 'valeur plus petite que la veille refusée');
// Pause / reprendre
await p.getByRole('button', { name: 'Mettre en pause le boost 2' }).click(); await p.getByRole('dialog').getByRole('button', { name: 'Mettre en pause' }).click(); await p.waitForTimeout(300);
ok((await p.evaluate(() => window.__tsena.get('boosts', 'b2'))).status === 'paused' && N(await p.locator('main').innerText()).includes('En pause'), 'boost 2 en pause');
await p.getByRole('button', { name: 'Reprendre le boost 2' }).click(); await p.waitForTimeout(300);
ok((await p.evaluate(() => window.__tsena.get('boosts', 'b2'))).status === 'active', 'boost 2 repris');
// Ordre par glisser-déposer
const rowB = p.locator('tr', { hasText: 'PROMO B' }); const rowA = p.locator('tr', { hasText: 'PROMO A' });
await rowB.dragTo(rowA); await p.waitForTimeout(400);
const slots = await p.evaluate(() => [window.__tsena.get('boosts', 'b1').slot, window.__tsena.get('boosts', 'b2').slot]);
ok(slots[0] === 2 && slots[1] === 1, `glisser-déposer : PROMO B devient n° 1 (${slots})`);
// Totaux et CA
main = N(await p.locator('main').innerText());
ok(main.includes('40 000 Ar') && main.includes('CA par conversation'), 'CA de la page et CA par conversation');
// Supprimer
await p.getByRole('button', { name: /Supprimer le boost/ }).first().click(); await p.getByRole('dialog').getByRole('button', { name: 'Supprimer le boost' }).click(); await p.waitForTimeout(300);
const left = await p.evaluate(() => window.__tsena.all('boosts').length);
ok(left === 1, 'boost supprimé');
// Période
await p.getByRole('button', { name: 'Période', exact: true }).click(); await p.waitForTimeout(200);
ok(await p.getByLabel('Du').count() >= 1 && await p.getByLabel('Au').count() >= 1, 'mode Période : du … au …');
// Toutes les pages
await p.getByLabel('Page').first().selectOption('').catch(() => {});
await p.waitForTimeout(300);
ok(N(await p.locator('main').innerText()).includes('Toutes les pages'), 'vue toutes les pages');
// Tableau de bord
await p.goto('http://localhost:5173/#/'); await p.waitForTimeout(700);
const dash = N(await p.locator('main').innerText()); if (process.env.DBG) console.log(dash.slice(0, 1500), await p.evaluate(() => window.__tsena.all('boostReadings').map((r) => r.date + ':' + r.messages + ':' + r.boostId)));
ok(/messages \(boosts\)/.test(dash) && /messages · .*\/msg/.test(dash), 'tableau de bord : messages sous le CA et par page');
const sw = await p.evaluate(() => document.documentElement.scrollWidth); ok(sw <= W + 1, `pas de débordement (${sw})`);
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST BON'); await b.close();
