import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 } });
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
  await pt('cashMoves', { id: 'e1', at: now, account: 'cash', amount: -5000, type: 'expense', categoryId: 'fc-divers', label: 'Taxi', createdAt: now, updatedAt: now, userName: 'Tafita' });
  await pt('cashMoves', { id: 'e2', at: '2026-10-14T09:00:00.000Z', account: 'cash', amount: -3000, type: 'expense', categoryId: 'fc-divers', label: 'Ancien', createdAt: now, updatedAt: now });
  await pt('payouts', { id: 'po_2026-10-12', weekStart: '2026-10-12', weekEnd: '2026-10-17', status: 'paid', at: '2026-10-18T10:00:00.000Z', amount: 1, createdAt: now, updatedAt: now });
});
await p.reload(); await p.waitForTimeout(1500);
await p.goto('http://localhost:5173/#/depenses'); await p.waitForTimeout(800);
// period: all
const sel = p.locator('select').first(); 
await p.getByLabel('Corriger (date, montant…)').first().click(); await p.waitForTimeout(300);
await p.locator('.modal').getByLabel('Montant (Ar)').fill('6000');
await p.locator('.modal').getByLabel('Date').fill('2026-10-25');
await p.locator('.modal').getByLabel('Raison de la correction').fill('erreur de montant');
await p.getByRole('button', { name: 'Enregistrer la correction' }).click(); await p.waitForTimeout(800);
const r = await p.evaluate(async () => { const db = await new Promise(r => { const q = indexedDB.open('tsena'); q.onsuccess = () => r(q.result); }); return new Promise(r => { const x = db.transaction('cashMoves').objectStore('cashMoves').get('e1'); x.onsuccess = () => r(x.result); }); });
console.log('e1', r.amount, r.at.slice(0, 10));
// closed check via expense form-less: try to call on e2 through UI period all
await p.goto('http://localhost:5173/#/caisse-du-jour'); await p.waitForTimeout(800);
console.log('daycash edit buttons today', await p.getByLabel('Corriger (date, montant…)').count());
await b.close();
