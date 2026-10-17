import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const W = +(process.argv[2] || 1430);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: W, height: 860 } })).newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:5173/'); await p.waitForTimeout(600);
await p.getByLabel("Nom d'utilisateur").fill('super-adm');
await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter');
await p.getByRole('button', { name: 'Plus tard' }).click(); await p.waitForTimeout(500);
await p.evaluate(async () => { const t = window.__tsena; const at = new Date().toISOString();
  await t.save('categories', [{ id: 'c1', name: 'BOXER HOMME' }, { id: 'c2', name: 'PYJAMAS ENFANT FILLE' }]);
  const ps = [], vs = [], ms = [];
  for (let i = 0; i < 8; i++) { ps.push({ id: 'p' + i, code: 'BOXHOMME-BXH' + i, name: (i % 2 ? 'SK8 boxer coton premium' : 'Carreaux'), categoryId: i % 3 ? 'c1' : 'c2', active: true, createdAt: at, priceRetail: 15000 }); vs.push({ id: 'v' + i, productId: 'p' + i, sku: 'BOXHOMME-BXH' + i + '-3XL', size: '3XL', color: 'Bleu marine', costAvg: 5740 }); ms.push({ variantId: 'v' + i, qty: 60 + i * 5, type: 'purchase', at }); }
  await t.save('products', ps); await t.save('variants', vs); await t.save('stockMoves', ms);
  await t.save('couriers', [{ id: 'k1', name: 'Rakoto Jean Livreur', phone: '0341111111', active: true }]);
  await t.save('customers', [{ id: 'cu1', name: 'Rasoanirina Hantamalala', phone: '0345556666' }]);
  const mk = (id, st, extra = {}) => ({ id, number: 'CMD-2026-00' + id, kind: 'order', channel: 'online', status: st, createdAt: at, createdByName: 'Vendeur Hery', customerId: 'cu1', customerName: 'Rasoanirina Hantamalala', customerPhone: '0345556666', address: 'Ambohipo lot IVB 23 près de la pharmacie', courierId: 'k1', deliveryFee: 3000, lines: [{ id: id + 'l', variantId: 'v1', qty: 2, unitPrice: 15000 }, { id: id + 'm', variantId: 'v2', qty: 1, unitPrice: 15000 }], payments: [], discount: 0, ...extra });
  await t.save('orders', [mk('1', 'new'), mk('2', 'out', { dispatchedAt: at }), mk('3', 'delivered', { dispatchedAt: at, deliveredAt: at }), mk('4', 'refused', { dispatchedAt: at })]);
  await t.save('cashMoves', [{ at, account: 'cash', amount: -12000, type: 'expense', label: 'Taxi pour livraison urgente Ambohipo', userName: 'Hery' }]);
});
const routes = ['/', '/notifications', '/vente', '/commandes', '/livraisons', '/clients', '/depenses', '/caisse-du-jour', '/versements', '/recapitulatif', '/tresorerie', '/pages', '/articles', '/stock', '/achats', '/boosts', '/rapports', '/utilisateurs', '/roles', '/journal', '/import-export', '/parametres', '/compte'];
const check = async (label) => {
  const r = await p.evaluate(() => {
    const out = [];
    for (const w of document.querySelectorAll('.content .table-wrap')) { const d = w.scrollWidth - w.clientWidth; if (d > 4) out.push(`table-wrap +${d}px [${[...w.querySelectorAll('thead th')].map((th) => th.textContent.trim().slice(0,18) + ':' + Math.round(th.getBoundingClientRect().width)).join(', ')}]`); }
    const doc = document.documentElement.scrollWidth - innerWidth; if (doc > 2) out.push(`page +${doc}px`);
    for (const c of document.querySelectorAll('.content .card')) { if (getComputedStyle(c).overflow !== 'hidden') continue; const cr = c.getBoundingClientRect();
      for (const el of c.querySelectorAll('button, a, strong, td, th, .badge')) { if (el.closest('.table-wrap')) continue; const er = el.getBoundingClientRect(); if (er.width && er.right > cr.right + 2) { out.push(`clipped "${el.textContent.trim().slice(0, 25)}" +${Math.round(er.right - cr.right)}`); break; } } }
    return out;
  });
  if (r.length) console.log(label, '→', r.join(' | '));
};
for (const r of routes) {
  await p.goto('http://localhost:5173/#' + r); await p.waitForTimeout(500);
  await check(r);
  const tabs = await p.locator('.content [role=tab]').allInnerTexts();
  for (let i = 1; i < tabs.length; i++) { await p.locator('.content [role=tab]').nth(i).click().catch(() => {}); await p.waitForTimeout(350); await check(`${r} [${tabs[i].trim()}]`); }
}
console.log('fin scan', W);
await b.close();
