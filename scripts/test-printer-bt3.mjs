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
  Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: async () => dev } });
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
  await put('printStations', { id: 'st1', name: 'Poste Android', createdAt: now, updatedAt: now, lastSeen: now });
});
await p.reload(); await p.waitForTimeout(2000);
await p.goto('http://localhost:5173/#/parametres/imprimantes'); await p.waitForTimeout(1500);
const state = async () => p.locator('.list-item').first().innerText().then(t => /Connectée/.test(t) ? 'green' : /Non connectée/.test(t) ? 'red' : '?');
console.log('start', await state(), 'button', await p.getByRole('button', { name: 'Se reconnecter maintenant' }).count());
await p.getByRole('button', { name: 'Se reconnecter maintenant' }).click(); await p.waitForTimeout(800);
console.log('after click', await state());
await b.close();
