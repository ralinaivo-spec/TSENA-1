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
  await put('_meta', [{ id: 'pr1', name: 'Ticket caisse', kind: 'usb', paper: '58', charset: 'cp850', logo: false, cut: false, ref: '1046:20497:', deviceName: 'Printer POS-58' }], 'printers');
  await put('_meta', { stationId: 'st1', printerId: 'pr1' }, 'myStation');
  await put('printStations', { id: 'st1', name: 'Caisse Mac', createdAt: now, updatedAt: now, lastSeen: now });
  await put('_meta', 'ancienne erreur', 'stationNeedsTap');
  await put('printJobs', { id: 'j2', stationId: 'st1', doc: { title: 'Doublon', blocks: [] }, copies: 1, status: 'error', error: 'x', createdAt: now, updatedAt: now });
  await put('printJobs', { id: 'j1', stationId: 'st1', doc: { title: 'T', blocks: [{ t: 'text', s: 'Bonjour é' }] }, copies: 1, status: 'pending', createdAt: now, updatedAt: now });
});
await p.reload(); await p.waitForTimeout(3000);
const st = async (id) => p.evaluate(async (id) => { const db = await new Promise(r => { const q = indexedDB.open('tsena'); q.onsuccess = () => r(q.result); }); return new Promise(r => { const x = db.transaction('printJobs').objectStore('printJobs').get(id); x.onsuccess = () => r(x.result ? (x.result.deleted ? 'deleted' : x.result.status) : 'none'); }); }, id);
console.log('j1 auto', await st('j1'), 'bytes', (await p.evaluate(() => window.__out)).length, 'banner', await p.locator('.notice', { hasText: 'imprimante à reconnecter' }).count());
await p.goto('http://localhost:5173/#/parametres/imprimantes'); await p.waitForTimeout(800);
const sum = p.getByText('Dernières impressions envoyées aux postes'); if (await sum.count()) await sum.click();
await p.getByRole('button', { name: /Effacer les tickets en attente et en erreur/ }).click(); await p.waitForTimeout(500);
console.log('j2 after clear', await st('j2'));
await b.close();
