import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1300, height: 950 } });
await ctx.addInitScript(() => {
  window.__out = [];
  const dev = { vendorId: 1046, productId: 20497, serialNumber: '', productName: 'Printer POS-58', opened: false, configuration: null,
    async open() { this.opened = true; }, async selectConfiguration() { this.configuration = { interfaces: [{ interfaceNumber: 0, claimed: false, alternates: [{ endpoints: [{ direction: 'out', type: 'bulk', endpointNumber: 1 }] }] }] }; },
    async claimInterface() { this.configuration.interfaces[0].claimed = true; }, async transferOut(ep, d) { window.__out.push(...d); return { status: 'ok' }; } };
  Object.defineProperty(navigator, 'usb', { value: { requestDevice: async () => dev, getDevices: async () => [dev] } });
});
const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:5173/');
await p.getByLabel("Nom d'utilisateur").fill('super-adm');
await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter');
await p.getByRole('button', { name: 'Plus tard' }).click(); await p.waitForTimeout(800);
await p.goto('http://localhost:5173/#/parametres/imprimantes'); await p.waitForTimeout(800);
await p.screenshot({ path: '/tmp/claude-0/t/pr1.png', fullPage: true });
await p.evaluate(async () => {
  const db = await new Promise(r => { const q = indexedDB.open('tsena'); q.onsuccess = () => r(q.result); });
  await new Promise(r => { const tx = db.transaction('_meta', 'readwrite'); tx.objectStore('_meta').put([{ id: 'p80', name: 'Imprimante 80', kind: 'usb', paper: '80', charset: 'cp850', logo: false, cut: false, ref: '1046:20497:' }], 'printers'); tx.oncomplete = r; });
});
await p.reload(); await p.waitForTimeout(1200);
await p.goto('http://localhost:5173/#/parametres/imprimantes'); await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Test', exact: true }).first().click(); await p.waitForTimeout(1200);
const o = await p.evaluate(() => window.__out);
const txt = String.fromCharCode(...o.filter(x => x === 10 || (x >= 32 && x < 127)));
console.log('starts with top feed:', o.slice(5, 8).join(','), '\n' + txt.split('\n').slice(0, 8).map(l => '|' + l + '|').join('\n'));
await p.getByLabel('Modifier').first().click(); await p.waitForTimeout(400);
console.log((await p.locator('.modal').innerText()).match(/Largeur du texte[^\n]*/)?.[0]);
await b.close();
