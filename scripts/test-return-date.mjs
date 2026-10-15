// Retour livreur validé en retard : le retour (refus), l'argent et le compte du livreur gardent la date réelle
// (jour de départ du colis), pas la date de saisie. Correction d'un retour déjà saisi à la mauvaise date.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Indian/Antananarivo' })).newPage();
const N = (t) => t.replace(/[\s  ]+/g, ' ');
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
p.on('pageerror', (e) => { console.log('ERR', e.message); fail++; });
await p.goto('http://localhost:5173/'); await p.waitForTimeout(600);
await p.getByLabel("Nom d'utilisateur").fill('super-adm'); await p.locator('input[type=password]').fill('anosy'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
await p.getByRole('button', { name: 'Plus tard' }).click({ timeout: 1500 }).catch(() => {});
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const now = new Date(); const d3 = new Date(now.getTime() - 3 * 86400000); d3.setHours(10, 0, 0, 0);
const D3 = ymd(d3), TODAY = ymd(now);
await p.evaluate(async (at) => {
  const t = window.__tsena;
  await t.save('categories', { id: 'av', name: 'Antivol' });
  await t.save('products', { id: 'a', code: 'CH1', name: 'Chaîne antivol', categoryId: 'av', priceRetail: 20000, active: true });
  await t.save('variants', { id: 'va', productId: 'a', sku: 'CH1', active: true });
  await t.save('stockMoves', [{ variantId: 'va', qty: 10, type: 'initial', at }, { variantId: 'va', qty: -2, type: 'dispatch', refType: 'order', refId: 'C6', at }]);
  await t.save('zones', { id: 'z1', name: 'Tana', fee: 0, active: true });
  await t.save('couriers', { id: 'tina', name: 'Tina', active: true });
  const o = (id) => ({ id, number: 'C-' + id, kind: 'order', channel: 'facebook', phone: '0320561612', status: 'out', zoneId: 'z1', courierId: 'tina', deliveryFee: 0, dispatchedAt: at, createdAt: at, lines: [{ id: id + 'l', variantId: 'va', qty: 1, unitPrice: 20000 }], payments: [], discount: 0, createdBy: 'user-superadmin', createdByName: 'Johary' });
  await t.save('orders', [o('C6'), o('C7')]);
}, d3.toISOString());
const dayOf = (iso) => (iso ? ymd(new Date(iso)) : '');
const state = () => p.evaluate(() => {
  const t = window.__tsena; const o = t.get('orders', 'C6');
  const s = t.all('courierSettlements').filter((x) => x.orderIds.includes('C6'));
  const sm = t.all('stockMoves').filter((m) => m.refId === 'C6' && m.type === 'delivery_return');
  const cm = t.all('cashMoves').filter((m) => s.some((x) => m.refId === x.id));
  return { status: o.status, returnedAt: o.returnedAt, refused: o.statusDates?.refused, set: s.map((x) => x.at), stock: sm.map((m) => m.at), cash: cm.map((m) => m.at) };
});

// 1. Validation aujourd'hui d'un colis parti il y a 3 jours : date proposée = jour de départ
await p.goto('http://localhost:5173/#/livraisons/retour'); await p.waitForTimeout(700);
await p.getByRole('button', { name: 'Tout décocher' }).click(); await p.getByRole('checkbox', { name: 'Régler C-C6' }).check(); await p.waitForTimeout(200);
await p.getByRole('group', { name: 'Résultat C-C6' }).getByRole('button', { name: 'Refusée' }).click(); await p.waitForTimeout(200);
const dateVal = await p.getByLabel('Date réelle du retour du livreur').inputValue();
ok(dateVal === D3, `date proposée = jour de départ (${dateVal} / ${D3})`);
await p.getByRole('button', { name: /Valider le retour de Tina/ }).click(); await p.waitForTimeout(300);
await p.getByRole('dialog').getByRole('button', { name: 'Valider' }).click(); await p.waitForTimeout(1500);
let s = await state();
ok(s.status === 'refused' && dayOf(s.returnedAt) === D3 && dayOf(s.refused) === D3, `refus daté du jour réel (${dayOf(s.returnedAt)})`);
ok(s.set.length === 1 && dayOf(s.set[0]) === D3 && s.cash.every((c) => dayOf(c) === D3), 'compte du livreur et caisse au jour réel');
ok(s.stock.length === 1 && dayOf(s.stock[0]) === D3, 'retour en stock au jour réel');
await p.goto('http://localhost:5173/#/caisse-du-jour'); await p.waitForTimeout(700);
ok(!N(await p.locator('main').innerText()).includes('C-C6'), 'caisse du jour d’aujourd’hui : pas de « Retour » de C-C6');

// 2. Correction : C7 retour saisi aujourd'hui (ancienne façon), puis date corrigée
await p.evaluate(async () => { const t = window.__tsena; await t.save('orders', { id: 'C7', status: 'refused', returnedAt: new Date().toISOString(), statusDates: { refused: new Date().toISOString() }, lines: [{ id: 'C7l', variantId: 'va', qty: 1, unitPrice: 20000, qtyKept: 0, qtyReturned: 1 }] }); });
await p.goto('http://localhost:5173/#/commandes/C7'); await p.waitForTimeout(600);
await p.getByRole('button', { name: 'Corriger la date du retour' }).click(); await p.waitForTimeout(300);
const dlg = p.getByRole('dialog');
ok(await dlg.getByLabel('Date réelle du retour').inputValue() === D3, 'correction : jour de départ proposé');
await dlg.getByRole('button', { name: 'Changer la date' }).click(); await p.waitForTimeout(1200);
const r7 = await p.evaluate(() => window.__tsena.get('orders', 'C7'));
ok(dayOf(r7.returnedAt) === D3 && dayOf(r7.statusDates.refused) === D3, `C7 : retour déplacé au ${D3}`);
const bad = await p.evaluate(() => window.__tsena.all('audit').some((a) => a.action === 'Date de retour corrigée'));
ok(bad, 'correction notée dans le journal');
// 3. Colis parti il y a 3 jours, annulé aujourd'hui (« Client a annulé ») : annulation datée du jour de départ
await p.evaluate(async (at) => { const t = window.__tsena; await t.save('orders', { id: 'C8', number: 'C-C8', kind: 'order', channel: 'facebook', phone: '0320561612', status: 'out', zoneId: 'z1', courierId: 'tina', deliveryFee: 4000, dispatchedAt: at, createdAt: at, lines: [{ id: 'C8l', variantId: 'va', qty: 1, unitPrice: 20000 }], payments: [], discount: 0, createdBy: 'user-superadmin', createdByName: 'Johary' }); await t.save('stockMoves', { variantId: 'va', qty: -1, type: 'dispatch', refType: 'order', refId: 'C8', at }); }, d3.toISOString());
await p.goto('http://localhost:5173/#/commandes/C8'); await p.waitForTimeout(600);
await p.getByRole('button', { name: 'Annuler / supprimer' }).click(); await p.waitForTimeout(300);
ok(await p.getByRole('dialog').getByLabel(/Date réelle de l’annulation/).inputValue() === D3, 'annulation d’un colis parti : jour de départ proposé');
await p.getByRole('dialog').getByRole('button', { name: 'Annuler la commande' }).click(); await p.waitForTimeout(1200);
let c8 = await p.evaluate(() => window.__tsena.get('orders', 'C8'));
ok(c8.status === 'cancelled' && dayOf(c8.statusDates.cancelled) === D3, `annulation datée du ${dayOf(c8.statusDates.cancelled)}`);
let tx8 = N(await p.locator('main').innerText());
ok(!tx8.includes('Pas encore réglés'), 'commande annulée : plus de « frais pas encore réglés » pour le livreur');
// 4. Ancienne annulation saisie aujourd'hui : correction de la date
await p.evaluate(async () => { const t = window.__tsena; const o = t.get('orders', 'C8'); await t.save('orders', { id: 'C8', statusDates: { ...o.statusDates, cancelled: new Date().toISOString() } }); });
await p.reload(); await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Corriger la date de l’annulation' }).click(); await p.waitForTimeout(300);
await p.getByRole('dialog').getByRole('button', { name: 'Changer la date' }).click(); await p.waitForTimeout(1200);
c8 = await p.evaluate(() => window.__tsena.get('orders', 'C8'));
ok(dayOf(c8.statusDates.cancelled) === D3, 'annulation déjà saisie : date corrigée au jour de départ');
await p.goto('http://localhost:5173/#/commandes/annulees'); await p.waitForTimeout(600);
let ta = N(await p.locator('main').innerText());
ok(ta.includes('C-C8') || ta.includes('autre(s) commande(s) de cet onglet sur d’autres dates'), 'onglet Annulées / refusées : C-C8 trouvé ou signalé');
console.log(fail ? `${fail} ÉCHEC(S)` : 'TOUT EST BON'); await b.close();
process.exit(fail ? 1 : 0);
