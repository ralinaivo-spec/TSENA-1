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
await p.getByRole('button', { name: 'Ajouter une imprimante' }).first().click(); await p.waitForTimeout(300);
await p.locator('.modal').getByText('USB (direct)').click();
await p.getByRole('button', { name: 'Chercher l’imprimante' }).click(); await p.waitForTimeout(500);
await p.getByRole('button', { name: 'Test des accents' }).click(); await p.waitForTimeout(500);
const out = await p.evaluate(() => window.__out);
const hex = out.map(x => x.toString(16).padStart(2, '0')).join(' ');
console.log('bytes', out.length, 'ESC t 2:', hex.includes('1b 74 02'), 'ESC t 11:', hex.includes('1b 74 0b'), 'é cp850 82:', hex.includes('1b 74 02 1b 45 01 41 1b 45 00 20 82'));
await p.screenshot({ path: '/tmp/claude-0/t/pr2.png' });
await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.waitForTimeout(300);
await p.evaluate(() => window.__out = []);
await p.getByRole('button', { name: 'Test', exact: true }).first().click(); await p.waitForTimeout(800);
const o2 = await p.evaluate(() => window.__out);
console.log('test page bytes', o2.length, 'table2', o2.map(x => x.toString(16).padStart(2, '0')).join(' ').includes('1b 74 02'));
await b.close();
