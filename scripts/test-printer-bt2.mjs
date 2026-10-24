import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1300, height: 950 } });
await ctx.addInitScript(() => {
  window.__chunks = []; window.__connects = 0;
  const ch = { properties: { writeWithoutResponse: true, write: true }, async writeValueWithoutResponse(d) { window.__chunks.push(Array.from(d)); }, async writeValueWithResponse(d) { window.__chunks.push(Array.from(d)); } };
  const listeners = {};
  const dev = { id: 'bt1', name: 'KPrinter_6193_BLE', addEventListener(t, f) { (listeners[t] ||= []).push(f); },
    gatt: { connected: false, async connect() { window.__connects++; this.connected = true; return { getPrimaryServices: async () => [{ getCharacteristics: async () => [ch] }] }; }, disconnect() { this.connected = false; } } };
  ch.service = { device: dev };
  window.__drop = () => { dev.gatt.connected = false; (listeners.gattserverdisconnected || []).forEach(f => f()); };
  Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: async () => dev, getDevices: async () => [dev] } });
});
const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:5173/');
await p.getByLabel("Nom d'utilisateur").fill('super-adm');
await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter');
await p.getByRole('button', { name: 'Plus tard' }).click(); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const db = await new Promise(r => { const q = indexedDB.open('tsena'); q.onsuccess = () => r(q.result); });
  const put = (t, rec, key) => new Promise(r => { const tx = db.transaction(t, 'readwrite'); key ? tx.objectStore(t).put(rec, key) : tx.objectStore(t).put(rec); tx.oncomplete = r; });
  const now = new Date().toISOString();
  await put('_meta', [{ id: 'pr1', name: 'KPrinter', kind: 'bluetooth', paper: '58', charset: 'cp850', logo: false, cut: false, ref: 'bt1', deviceName: 'KPrinter_6193_BLE' }], 'printers');
  await put('_meta', { stationId: 'st1', printerId: 'pr1' }, 'myStation');
  await put('printStations', { id: 'st1', name: 'Poste Android', createdAt: now, updatedAt: now, lastSeen: now });
});
await p.reload(); await p.waitForTimeout(2000);
await p.goto('http://localhost:5173/#/parametres/imprimantes'); await p.waitForTimeout(1500);
console.log('connects at start', await p.evaluate(() => window.__connects), 'status', await p.locator('.list-item').first().innerText().then(t => /Connectée/.test(t) ? 'green' : /Non connectée/.test(t) ? 'red' : '?'));
await p.evaluate(() => window.__drop()); await p.waitForTimeout(300);
console.log('after drop', await p.locator('.list-item').first().innerText().then(t => /Connectée/.test(t) ? 'green' : /Non connectée/.test(t) ? 'red' : '?'));
await p.waitForTimeout(3500);
console.log('after auto-reconnect', await p.evaluate(() => window.__connects), await p.locator('.list-item').first().innerText().then(t => /Connectée/.test(t) ? 'green' : /Non connectée/.test(t) ? 'red' : '?'));
// job via station
const t0 = Date.now();
await p.evaluate(async () => {
  const db = await new Promise(r => { const q = indexedDB.open('tsena'); q.onsuccess = () => r(q.result); });
  const now = new Date().toISOString();
  await new Promise(r => { const tx = db.transaction('printJobs', 'readwrite'); tx.objectStore('printJobs').put({ id: 'j1', stationId: 'st1', doc: { title: 'T', blocks: [{ k: 'text', s: 'Bonjour' }] }, copies: 1, status: 'pending', createdAt: now, updatedAt: now }); tx.oncomplete = r; });
});
await p.reload(); await p.waitForTimeout(3000);
const st = await p.evaluate(async () => { const db = await new Promise(r => { const q = indexedDB.open('tsena'); q.onsuccess = () => r(q.result); }); return new Promise(r => { const x = db.transaction('printJobs').objectStore('printJobs').get('j1'); x.onsuccess = () => r(x.result.status); }); });
const c = await p.evaluate(() => window.__chunks);
console.log('job', st, 'max chunk', Math.max(...c.map(x => x.length)));
await p.screenshot({ path: '/tmp/claude-0/t/bt2.png', fullPage: true });
await b.close();
