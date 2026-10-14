// Articles regroupés par catégorie (Vente sur place, ajout d'article à une commande) ;
// menu « Livraisons et livreurs » réservé à l'admin / gérant (pas au vendeur ni au responsable).
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Indian/Antananarivo' })).newPage();
const N = (t) => t.replace(/[  ]/g, ' ');
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
p.on('pageerror', (e) => { console.log('ERR', e.message); fail++; });
const login = async (u) => { await p.getByLabel("Nom d'utilisateur").fill(u); await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter'); await p.waitForTimeout(700); await p.getByRole('button', { name: 'Plus tard' }).click({ timeout: 1500 }).catch(() => {}); };
const logout = async () => { await p.goto('http://localhost:5173/#/compte'); await p.waitForTimeout(400); await p.locator('main').getByRole('button', { name: 'Se déconnecter' }).click(); await p.waitForTimeout(400); };
const navText = async () => N(await p.locator('aside.sidebar').innerText());
await p.goto('http://localhost:5173/'); await p.waitForTimeout(600);
await login('super-adm');
await p.evaluate(async () => {
  const t = window.__tsena; const now = new Date().toISOString(); const hash = t.get('users', 'user-superadmin').passwordHash;
  await t.save('categories', [{ id: 'pj', name: 'Pyjamas' }, { id: 'bx', name: 'Boxer' }]);
  await t.save('products', [
    { id: 'a', code: 'BX1', name: 'Boxer coton', categoryId: 'bx', priceRetail: 10000, active: true },
    { id: 'b', code: 'PJ1', name: 'Pyjama coton', categoryId: 'pj', priceRetail: 40000, active: true },
    { id: 'c', code: 'BX2', name: 'Boxer soie coton', categoryId: 'bx', priceRetail: 12000, active: true },
  ]);
  await t.save('variants', [{ id: 'va', productId: 'a', sku: 'BX1', active: true }, { id: 'vb', productId: 'b', sku: 'PJ1', active: true }, { id: 'vc', productId: 'c', sku: 'BX2', active: true }]);
  await t.save('stockMoves', ['va', 'vb', 'vc'].map((v) => ({ variantId: v, qty: 5, type: 'initial', at: now })));
  await t.save('users', [
    { id: 'u1', username: 'aina', fullName: 'Aina', roleId: 'role-seller', active: true, passwordHash: hash, mustChangePassword: false },
    { id: 'u3', username: 'resp', fullName: 'Rindra', roleId: 'role-manager', active: true, passwordHash: hash, mustChangePassword: false },
  ]);
});
// Vente sur place : résultats regroupés
await p.goto('http://localhost:5173/#/vente'); await p.waitForTimeout(500);
await p.getByLabel('Rechercher un article').fill('coton'); await p.waitForTimeout(400);
let heads = await p.locator('.pos-results .list-group-head').allInnerTexts();
ok(heads.length === 2 && N(heads[0]).startsWith('Boxer (2)') && N(heads[1]).startsWith('Pyjamas (1)'), `vente sur place : regroupé par catégorie (${heads.join(' | ')})`);
// Catalogue (même fenêtre que l'ajout d'article à une commande)
await p.getByRole('button', { name: 'Parcourir le catalogue' }).click(); await p.waitForTimeout(400);
heads = await p.getByRole('dialog').locator('.list-group-head').allInnerTexts();
ok(heads.length === 2 && N(heads[0]).startsWith('Boxer') && N(heads[1]).startsWith('Pyjamas'), 'catalogue / ajout à une commande : regroupé par catégorie');
await p.keyboard.press('Escape');
ok((await navText()).includes('Livraisons et livreurs'), 'admin : menu Livraisons visible');
await logout(); await login('aina');
ok(!(await navText()).includes('Livraisons et livreurs'), 'vendeur : menu Livraisons caché');
await p.goto('http://localhost:5173/#/livraisons'); await p.waitForTimeout(400);
ok(!/Comptes livreurs|Retour livreur/.test(N(await p.locator('main').innerText())), 'vendeur : adresse directe sans accès');
await logout(); await login('resp');
ok(!(await navText()).includes('Livraisons et livreurs'), 'responsable : menu Livraisons caché');
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST BON'); await b.close();
process.exit(fail ? 1 : 0);
