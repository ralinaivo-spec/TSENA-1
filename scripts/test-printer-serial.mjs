import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1300, height: 950 } });
await ctx.addInitScript(() => {
  window.__out = []; window.__opens = [];
  const mk = (name, failOpen) => { const p = { name, writable: null, getInfo: () => ({}), async open() { window.__opens.push(name); if (failOpen) throw Object.assign(new Error('Failed to open serial port.'), { name: 'NetworkError' }); this.writable = { getWriter: () => ({ write: async (d) => { window.__out.push(...d); }, releaseLock() {} }) }; }, async close() { this.writable = null; } }; return p; };
  const ports = [mk('autre-appareil', true), mk('KPrinter', false)];
  Object.defineProperty(navigator, 'serial', { value: { getPorts: async () => ports, requestPort: async () => ports[1] } });
});
const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:5173/');
await p.getByLabel("Nom d'utilisateur").fill('super-adm');
await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter');
await p.getByRole('button', { name: 'Plus tard' }).click(); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const db = await new Promise(r => { const q = indexedDB.open('tsena'); q.onsuccess = () => r(q.result); });
  const put = (t, rec, key) => new Promise(r => { const tx = db.transaction(t, 'readwrite'); tx.objectStore(t).put(rec, key); tx.oncomplete = r; });
  await put('_meta', [{ id: 'pr1', name: 'Imprimante 80', kind: 'serial', paper: '58', charset: 'cp850', logo: false, cut: false, ref: '::0', deviceName: 'Imprimante Bluetooth (port série)' }], 'printers');
});
await p.reload(); await p.waitForTimeout(1500);
await p.goto('http://localhost:5173/#/parametres/imprimantes'); await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Test', exact: true }).first().click(); await p.waitForTimeout(3000);
console.log('opens', (await p.evaluate(() => window.__opens)).join(','), 'bytes', (await p.evaluate(() => window.__out)).length);
await p.evaluate(() => { window.__out = []; window.__opens = []; });
await p.getByRole('button', { name: 'Test', exact: true }).first().click(); await p.waitForTimeout(1500);
console.log('2nd opens', (await p.evaluate(() => window.__opens)).join(',') || '(déjà ouvert)', 'bytes', (await p.evaluate(() => window.__out)).length);
await b.close();
