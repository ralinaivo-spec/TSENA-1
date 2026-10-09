// Usage (serveur de dev lancé) : node scripts/design-check.mjs 360,390,768,1280 [dark] [shots]
// Balayage design : toutes les pages (et leurs onglets, et les principaux formulaires) à plusieurs largeurs, clair/sombre.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const widths = (process.argv[2] || '360,390,768,1280').split(',').map(Number);
const dark = process.argv[3] === 'dark';
const shots = process.argv[4] === 'shots';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ROUTES = ['/', '/vente', '/commandes/suivre', '/commandes/enregistrees', '/livraisons', '/clients', '/depenses', '/caisse-du-jour', '/recapitulatif', '/tresorerie', '/pages', '/articles', '/stock', '/achats', '/receptions', '/boosts', '/rapports', '/utilisateurs', '/roles', '/journal', '/import-export', '/parametres', '/compte'];
const FORMS = { '/commandes/enregistrees': ['Nouvelle commande', 'Client à suivre'], '/depenses': ['Ajouter une dépense'], '/clients': ['Nouveau client'], '/achats': ['Nouvelle commande'], '/utilisateurs': ['Ajouter un utilisateur', 'Nouvel utilisateur'] };
const issues = [];
for (const W of widths) {
  const ctx = await b.newContext({ viewport: { width: W, height: 860 }, colorScheme: dark ? 'dark' : 'light', timezoneId: 'Indian/Antananarivo' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => issues.push(`${W} ERR ${e.message}`));
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(600);
  await p.getByLabel("Nom d'utilisateur").fill('super-adm'); await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter');
  await p.getByRole('button', { name: 'Plus tard' }).click(); await p.waitForTimeout(300);
  if (W === widths[0]) await p.evaluate(async () => { const t = window.__tsena; const now = new Date().toISOString();
    await t.save('categories', [{ id: 'c1', name: 'Pyjama enfant avec un nom de page assez long' }, { id: 'c2', name: 'Lampes moto' }]);
    await t.save('products', [{ id: 'p1', code: 'LAP-4A-ROSE-XL', name: 'Pyjama lapin rose à capuche taille 4 ans', categoryId: 'c1', priceRetail: 20000, priceWholesale: 15000, active: true }, { id: 'p2', code: 'LPM', name: 'Lampe moto LED', categoryId: 'c2', priceRetail: 30000, active: true }]);
    await t.save('variants', [{ id: 'v1', productId: 'p1', sku: 'LAP-4A', costAvg: 9000, active: true }, { id: 'v2', productId: 'p2', sku: 'LPM', costAvg: 12000, active: true }]);
    await t.save('stockMoves', [{ variantId: 'v1', qty: 20, type: 'initial', at: now }, { variantId: 'v2', qty: 2, type: 'initial', at: now }]);
    await t.save('couriers', { id: 'k1', name: 'Rado Andrianarisoa', phone: '0341111111', active: true, zoneIds: ['zone-centre'] });
    await t.save('customers', { id: 'cus_0341234567', phone: '0341234567', name: 'Fara Rasoanaivo', facebook: 'Fara Rasoa', place: 'Analakely, devant la pharmacie' });
    await t.save('orders', [{ id: 'o1', number: 'C-A1', kind: 'order', channel: 'facebook', phone: '0341234567', name: 'Fara Rasoanaivo', zoneId: 'zone-centre', place: 'Analakely, devant la pharmacie', courierId: 'k1', status: 'confirmed', lines: [{ id: 'l1', variantId: 'v1', qty: 2, unitPrice: 20000 }], payments: [], discount: 0, deliveryFee: 3000, createdAt: now },
      { id: 'o2', number: 'V-A1', kind: 'order', channel: 'shop', phone: '', status: 'delivered', lines: [{ id: 'l2', variantId: 'v2', qty: 1, unitPrice: 30000, qtyKept: 1 }], payments: [{ id: 'pp', at: now, amount: 30000, method: 'cash', receivedBy: 'shop' }], discount: 0, deliveryFee: 0, createdAt: now }]);
    await t.save('prospects', { id: 'pr1', fbName: 'Soa Rakotomalala', items: [{ id: 'i', text: 'pyjama lapin taille à voir' }], waitFor: 'info', followAt: now, priority: 'high', status: 'open' });
    await t.save('cashMoves', { at: now, account: 'cash', amount: -5000, type: 'expense', categoryId: 'fc-divers', label: 'Sakafo' });
  });
  const check = async (where) => {
    await p.waitForTimeout(250);
    const r = await p.evaluate((W) => {
      const out = [];
      const sw = document.documentElement.scrollWidth;
      if (sw > W + 1) out.push(`page déborde (${sw}px)`);
      const scrollable = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowX) || e.classList.contains('table-wrap')) return true; } return false; };
      const vis = (el) => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && el.offsetParent !== null; };
      for (const el of document.querySelectorAll('button, a.btn, .btn, input, select, .stat-value, h1, h2, .badge, .chip, label')) {
        if (!vis(el) || scrollable(el)) continue;
        const rc = el.getBoundingClientRect();
        if (rc.width && (rc.right > W + 1 || rc.left < -1)) out.push(`hors écran : ${el.tagName.toLowerCase()} « ${(el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 40)} » (${Math.round(rc.left)}→${Math.round(rc.right)})`);
        else if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'hidden' && el.tagName !== 'INPUT' && el.tagName !== 'SELECT') out.push(`texte coupé : ${el.tagName.toLowerCase()} « ${(el.innerText || '').trim().slice(0, 40)} »`);
      }
      return [...new Set(out)].slice(0, 8);
    }, W);
    for (const x of r) issues.push(`${W}${dark ? ' sombre' : ''} ${where} : ${x}`);
    if (shots) await p.screenshot({ path: `/tmp/claude-0/t/sweep/${W}${dark ? 'd' : ''}${where.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true });
  };
  for (const r of ROUTES) {
    await p.goto('http://localhost:5173/#' + r); await p.waitForTimeout(400);
    await check(r);
    const tabs = await p.locator('main [role=tab]').allInnerTexts();
    for (let i = 0; i < Math.min(tabs.length, 12); i++) {
      const t = p.locator('main [role=tab]').nth(i);
      if (!(await t.isVisible().catch(() => false))) continue;
      await t.click().catch(() => {}); await check(`${r} [${tabs[i].trim().slice(0, 25)}]`);
    }
    for (const f of FORMS[r] ?? []) {
      await p.goto('http://localhost:5173/#' + r); await p.waitForTimeout(300);
      const btn = p.getByRole('button', { name: f, exact: true }).first();
      if (!(await btn.isVisible().catch(() => false))) continue;
      await btn.click(); await check(`${r} (${f})`); await p.keyboard.press('Escape');
    }
  }
  await ctx.close();
}
console.log(issues.length ? issues.join('\n') : 'AUCUN PROBLÈME');
await b.close();
