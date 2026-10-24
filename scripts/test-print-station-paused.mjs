import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1300, height: 950 } });
await ctx.addInitScript(() => {
  window.__out = []; window.__fail = Number(sessionStorage.getItem('fail') || 0); sessionStorage.removeItem('fail');
  const dev = { vendorId: 1046, productId: 20497, serialNumber: '', productName: 'Printer POS-58', opened: false, configuration: null,
    async open() { if (window.__fail > 0) { window.__fail--; const e = new Error('Must be handling a user gesture'); e.name = 'SecurityError'; throw e; } this.opened = true; },
    async selectConfiguration() { this.configuration = { interfaces: [{ interfaceNumber: 0, claimed: false, alternates: [{ endpoints: [{ direction: 'out', type: 'bulk', endpointNumber: 1 }] }] }] }; },
    async claimInterface() { this.configuration.interfaces[0].claimed = true; }, async transferOut(ep, d) { window.__out.push(...d); return { status: 'ok' }; } };
  Object.defineProperty(navigator, 'usb', { value: { requestDevice: async () => dev, getDevices: async () => [dev] } });
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
  await put('_meta', [{ id: 'pr1', name: 'Ticket caisse', kind: 'usb', paper: '58', charset: 'cp850', logo: false, cut: false, ref: '1046:20497:', deviceName: 'Printer POS-58', paused: true }], 'printers');
  await put('_meta', { stationId: 'st1', printerId: 'pr1' }, 'myStation');
  await put('printStations', { id: 'st1', name: 'Caisse Mac', createdAt: now, updatedAt: now, lastSeen: now });
  await put('printJobs', { id: 'j1', stationId: 'st1', doc: { title: 'T', blocks: [{ t: 'text', s: 'Bonjour é' }] }, copies: 1, status: 'pending', createdAt: now, updatedAt: now });
});
await p.reload(); await p.waitForTimeout(2500);
const banner = await p.locator('.notice', { hasText: 'imprimante à reconnecter' }).count();
console.log('banner shown', banner, 'bytes before', (await p.evaluate(() => window.__out)).length);
await p.screenshot({ path: '/tmp/claude-0/t/st3.png' });
if (banner) { await p.getByRole('button', { name: 'Reconnecter l’imprimante' }).click(); await p.waitForTimeout(2000); }
console.log('bytes after', (await p.evaluate(() => window.__out)).length, 'banner now', await p.locator('.notice', { hasText: 'imprimante à reconnecter' }).count());
const st = await p.evaluate(async () => { const db = await new Promise(r => { const q = indexedDB.open('tsena'); q.onsuccess = () => r(q.result); }); return new Promise(r => { const x = db.transaction('printJobs').objectStore('printJobs').get('j1'); x.onsuccess = () => r(x.result.status); }); });
console.log('job status', st);
const pr = await p.evaluate(async () => { const db = await new Promise(r => { const q = indexedDB.open('tsena'); q.onsuccess = () => r(q.result); }); return new Promise(r => { const x = db.transaction('_meta').objectStore('_meta').get('printers'); x.onsuccess = () => r(x.result[0].paused); }); });
console.log('paused after', pr);
await b.close();
