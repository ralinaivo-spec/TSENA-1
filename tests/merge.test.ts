import { mergeRecords, stampWrite, sameContent, observe, tick } from '../src/lib/merge';
let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const base = stampWrite(undefined, { id: 'o1', createdAt: '2026-10-08T08:00:00Z', number: 'C-0001', status: 'confirmed', notes: '', payments: [] }, { by: 'Admin', dev: 'devA' }, 1000);
// A (hors ligne) change le statut ; B ajoute un paiement et une note
const a = stampWrite(base, { status: 'ready' }, { by: 'Hery', dev: 'devA' }, 2000);
const b1 = stampWrite(base, { payments: [{ id: 'p1', at: 't1', amount: 20000 }] }, { by: 'Tiana', dev: 'devB' }, 1500);
const b = stampWrite(b1, { notes: 'client absent le matin' }, { by: 'Tiana', dev: 'devB' }, 1600);
const ab = mergeRecords(a, b).merged, ba = mergeRecords(b, a).merged;
ok(ab.status === 'ready' && ab.payments.length === 1 && ab.notes === 'client absent le matin', 'champs différents : les deux modifications sont gardées');
ok(sameContent(ab, ba), 'même résultat quel que soit l’ordre d’arrivée');
ok(sameContent(mergeRecords(ab, b).merged, ab) && sameContent(mergeRecords(ab, ab).merged, ab), 'recevoir deux fois la même chose ne change rien');
// Paiements saisis en parallèle sur deux appareils
const pa = stampWrite(base, { payments: [{ id: 'pA', at: '1', amount: 10000 }] }, { dev: 'devA' }, 3000);
const pb = stampWrite(base, { payments: [{ id: 'pB', at: '2', amount: 5000 }] }, { dev: 'devB' }, 3100);
const pm = mergeRecords(pa, pb);
ok(pm.merged.payments.length === 2 && pm.conflicts.length === 0, 'deux paiements en parallèle : les deux sont gardés, pas de conflit');
// Vrai conflit : même champ
const ca = stampWrite(base, { status: 'ready' }, { by: 'Hery', dev: 'devA' }, 4000);
const cb = stampWrite(base, { status: 'cancelled' }, { by: 'Tiana', dev: 'devB' }, 4100);
const cm = mergeRecords(ca, cb);
ok(cm.merged.status === 'cancelled' && cm.conflicts.length === 1 && cm.conflicts[0].lost === 'ready' && cm.conflicts[0].lostBy === 'Hery', 'même champ : la plus récente gagne, l’autre est signalée (qui, quoi)');
ok(sameContent(mergeRecords(cb, ca).merged, cm.merged), 'conflit résolu pareil sur les deux appareils');
// Égalité parfaite d'horodatage : départage par appareil, identique des deux côtés
const ta = stampWrite(base, { status: 'ready' }, { dev: 'devA' }, 5000), tb = stampWrite(base, { status: 'out' }, { dev: 'devB' }, 5000);
ok(mergeRecords(ta, tb).merged.status === mergeRecords(tb, ta).merged.status, 'égalité d’heure : même gagnant partout');
// Horloge du téléphone en retard : l'horloge logique tient compte de ce qui a été reçu
observe(9_999_999_999_000); const t = tick();
ok(t > 9_999_999_999_000, 'horloge logique : une saisie faite après une réception est toujours plus récente');
// Ancienne fiche sans suivi par champ
const legacy: any = { id: 'x', createdAt: 'a', updatedAt: '2026-10-01T00:00:00Z', name: 'Ancien', phone: '034' };
const lr = stampWrite(legacy, { name: 'Nouveau' }, { dev: 'devB' }, Date.parse('2026-10-05T00:00:00Z'));
const lm = mergeRecords(legacy, lr).merged;
ok(lm.name === 'Nouveau' && lm.phone === '034', 'ancienne fiche (avant mise à jour) fusionnée correctement');
// Suppression vs modification
const del = stampWrite(base, { deleted: true }, { dev: 'devA' }, 6000);
const edit = stampWrite(base, { notes: 'x' }, { dev: 'devB' }, 6100);
const dm = mergeRecords(del, edit).merged;
ok(dm.deleted === true && dm.notes === 'x', 'suppression et modification d’un autre champ : rien n’est perdu, la suppression reste');
process.exit(fail ? 1 : 0);
