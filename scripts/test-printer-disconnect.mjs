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
  await put('printJobs', { id: 'j1', stationId: 'st1', doc: { title: 'T', blocks: [{ t: 'text', s: 'Bonjour é' }] }, copies: 1, status: 'pending', createdAt: now, updatedAt: now });
});
await p.reload(); await p.waitForTimeout(2500);
await p.goto('http://localhost:5173/#/parametres/imprimantes'); await p.waitForTimeout(800);
console.log('associated', await p.getByText('Associée à cet appareil').count());
await p.getByRole('button', { name: 'Déconnecter', exact: true }).click(); await p.waitForTimeout(300);
console.log('confirm mentions station', await p.locator('.modal').getByText('il arrêtera de l’être').count());
await p.locator('.modal').getByRole('button', { name: 'Déconnecter' }).click(); await p.waitForTimeout(600);
console.log('paused badge', await p.getByText('Déconnectée', { exact: true }).count(), 'station stopped', await p.getByRole('button', { name: 'Faire de cet appareil un poste d’impression' }).count());
await p.screenshot({ path: '/tmp/claude-0/t/dc1.png' });
await p.getByRole('button', { name: 'Reconnecter', exact: true }).click(); await p.waitForTimeout(600);
console.log('reconnected', await p.getByText('Associée à cet appareil').count());
await b.close();
