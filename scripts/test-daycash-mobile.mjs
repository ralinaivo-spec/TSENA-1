import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1300, height: 950 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:5173/');
await p.getByLabel("Nom d'utilisateur").fill('super-adm');
await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter');
await p.getByRole('button', { name: 'Plus tard' }).click(); await p.waitForTimeout(800);
const put = async (patch) => p.evaluate(async (patch) => {
  const db = await new Promise(r => { const q = indexedDB.open('tsena'); q.onsuccess = () => r(q.result); });
  const g = (t) => new Promise(r => { const x = db.transaction(t).objectStore(t).getAll(); x.onsuccess = () => r(x.result); });
  const now = new Date().toISOString();
  const pt = (t, rec) => new Promise(r => { const tx = db.transaction(t, 'readwrite'); tx.objectStore(t).put(rec); tx.oncomplete = r; });
  await pt('products', { id: 'p1', name: 'Pyjama', active: true, createdAt: now, updatedAt: now });
  await pt('variants', { id: 'v6', productId: 'p1', sku: 'A3', active: true, createdAt: now, updatedAt: now });
  await pt('variants', { id: 'v7', productId: 'p1', sku: 'A1', active: true, createdAt: now, updatedAt: now });
  const v6 = { id: 'v6' }, v7 = { id: 'v7' };
  await pt('couriers', { id: 'c1', name: 'Rado', active: true, createdAt: now, updatedAt: now });
  const o = { id: 'o1', number: 'C-F0058', kind: 'order', channel: 'facebook', phone: '0341234567', name: 'Fara', zoneId: 'zone-centre', deliveryFee: 3000, discount: 0, status: 'out', courierId: 'c1', dispatchedAt: now,
    lines: [{ id: 'a3', variantId: v6.id, qty: 1, unitPrice: 70000, isChoice: true }, { id: 'a1', variantId: v7.id, qty: 1, unitPrice: 80000, isChoice: true }],
    choiceNote: { at: now, kept: { a3: 0, a1: 1 } }, payments: [{ id: 'pp1', at: now, amount: 20000, method: 'mvola', receivedBy: 'shop' }, { id: 'pp2', at: now, amount: 5000, method: 'orange', receivedBy: 'shop' }, { id: 'pp3', at: now, amount: 9000, method: 'cash', receivedBy: 'shop' }], createdAt: now, updatedAt: now };
  if (patch === 'ret') { o.status = 'partial'; o.returnedAt = now; o.lines[0].qtyKept = 0; o.lines[0].qtyReturned = 1; o.lines[1].qtyKept = 1; o.lines[1].qtyReturned = 0; }
  if (patch === 'ret2') { o.status = 'delivered'; o.returnedAt = now; o.lines[0].qtyKept = 1; o.lines[1].qtyKept = 1; }
  if (patch === 'cancel') { o.status = 'cancelled'; o.statusDates = { cancelled: now }; }
  await pt('orders', o);
}, patch);
const total = async () => { await p.reload(); await p.waitForTimeout(1500); await p.goto('http://localhost:5173/#/caisse-du-jour'); await p.waitForTimeout(1200);
  const t = await p.locator('.stat').first().innerText(); return t.replace(/\s/g, ''); };
for (const c of ['out']) { await put(c); console.log(c, await total()); console.log((await p.locator('.stat').nth(3).innerText()).replace(/\s+/g,' ')); }
await p.screenshot({ path: '/tmp/claude-0/t/cs.png' });
await b.close();
