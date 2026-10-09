// Livraisons → Retour livreur : le compte avec le livreur en un seul écran.
// Pour chaque colis : livré / refusé / choix ou en partie / le client vient en boutique ; frais de livraison
// modifiables (client qui paie moins) ; ce qui est déjà payé (MVola…) n'est pas demandé au livreur.
// Puis : prix des articles et frais de livraison séparés, et règlement des frais du livreur
// (retenus sur l'argent versé, payés à part, ou plus tard sur son compte).
import { useMemo, useState } from 'react';
import { useCan } from '../lib/auth';
import { get, useTable } from '../lib/db';
import { fmtAr, parseNum } from '../lib/catalog';
import {
  cancelDeliveryToShop, choiceQty, courierSplit, fmtPhone, hasPendingChoice, orderLabel, recordReturn, remaining,
  type Courier, type Order, type Zone,
} from '../lib/orders';
import { ACCOUNTS, ACCOUNT_IDS, courierBalance, settleCourier, type AccountId, type CourierSettlement } from '../lib/money';
import { Badge, Button, Confirm, Empty, SelectField, TextField, fmtDateTime, toast } from '../ui/kit';
import { Icon } from '../ui/icons';
import { ReturnModal } from './Orders';

type Decision = 'delivered' | 'refused';
type FeeMode = 'retenue' | 'apart' | 'plustard';

/** Ce que donnerait le retour d'un colis encore « en livraison », sans rien enregistrer. */
function simulate(o: Order, d: Decision, fee: number): Order {
  const lines = o.lines.map((l) => ({ ...l, qtyKept: d === 'delivered' && !l.isChoice ? l.qty : 0, qtyReturned: d === 'delivered' && !l.isChoice ? 0 : l.qty }));
  const sim = { ...o, status: d, lines, feeCharged: fee } as Order;
  const rest = remaining(sim);
  if (rest > 0) sim.payments = [...(o.payments || []), { id: 'sim', at: '', amount: rest, method: 'cash', receivedBy: 'courier', courierId: o.courierId }];
  return sim;
}

export function CourierReturn() {
  const can = useCan();
  const couriers = useTable<Courier>('couriers');
  useTable<Order>('orders'); useTable<Zone>('zones'); useTable<CourierSettlement>('courierSettlements');
  const withWork = couriers.filter((c) => courierBalance(c.id).pending.length || courierBalance(c.id).carry);
  const [cid, setCid] = useState('');
  const courier = couriers.find((c) => c.id === cid) ?? withWork[0];
  return (
    <>
      <div className="card stack-s">
        <p className="small muted">Le livreur revient avec ses colis et l’argent : indiquez pour chaque colis ce qui s’est passé, vérifiez les montants (articles et frais séparés), puis validez ce qu’il vous remet.</p>
        {withWork.length === 0 ? <Empty icon="truck" title="Aucun livreur à recevoir">Les colis remis aux livreurs apparaîtront ici.</Empty> : (
          <div className="row" style={{ gap: 6 }}>
            {withWork.map((c) => { const b = courierBalance(c.id); return <button key={c.id} type="button" className="chip" aria-pressed={courier?.id === c.id} onClick={() => setCid(c.id)}>{c.name} · {b.pending.length} colis</button>; })}
          </div>
        )}
      </div>
      {courier && <CourierSheet key={courier.id} courier={courier} canSettle={can('couriers.settle')} />}
    </>
  );
}

function CourierSheet({ courier, canSettle }: { courier: Courier; canSettle: boolean }) {
  const b = courierBalance(courier.id);
  const [dec, setDec] = useState<Record<string, Decision>>({});
  const [fees, setFees] = useState<Record<string, string>>({});
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [ret, setRet] = useState<Order | null>(null);
  const [toShop, setToShop] = useState<Order | null>(null);
  const [mode, setMode] = useState<FeeMode>('retenue');
  const [amount, setAmount] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountId>('cash');
  const [feeAccount, setFeeAccount] = useState<AccountId>('cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);

  const rows = useMemo(() => b.pending.map((o) => {
    const open = o.status === 'out';
    const blocked = open && hasPendingChoice(o);
    const d: Decision = dec[o.id] ?? 'delivered';
    const fee = open ? (fees[o.id] != null ? parseNum(fees[o.id]) ?? 0 : d === 'refused' ? 0 : o.deliveryFee || 0) : (o.feeCharged ?? o.deliveryFee ?? 0);
    const sim = open && !blocked ? simulate(o, d, fee) : o;
    const x = courierSplit(sim);
    const prepaid = (o.payments || []).filter((p) => p.receivedBy === 'shop').reduce((s, p) => s + p.amount, 0);
    return { o, open, blocked, d, fee, x, prepaid, on: !blocked && !off[o.id] };
  }), [b.pending, dec, fees, off]);

  const on = rows.filter((r) => r.on);
  const collect = on.reduce((t, r) => t + r.x.toCollect, 0);
  const feeKept = on.reduce((t, r) => t + r.x.feeKept, 0);
  const feeAll = on.reduce((t, r) => t + r.x.fee, 0);
  const feeOwed = on.reduce((t, r) => t + r.x.feeOwed, 0);
  const inHand = collect + feeKept;
  const handOver = b.carry + (mode === 'retenue' ? collect - feeOwed : inHand);
  const n = amount == null ? Math.max(0, handOver) : parseNum(amount) ?? 0;
  const payFees = mode === 'apart' ? feeAll : 0;
  const after = b.carry + collect - feeOwed - n + payFees; // après validation : + il doit encore ; − la boutique lui doit
  const blockedRows = rows.filter((r) => r.blocked);

  async function validate() {
    setBusy(true);
    try {
      for (const r of on) {
        if (!r.open) continue;
        const kept = Object.fromEntries(r.o.lines.map((l) => [l.id, r.d === 'delivered' && !l.isChoice ? l.qty : 0]));
        const rest = remaining({ ...r.o, status: r.d, lines: r.o.lines.map((l) => ({ ...l, qtyKept: kept[l.id] })), feeCharged: r.fee } as Order);
        await recordReturn(r.o, { kept, feeCharged: r.fee, collected: rest > 0 ? [{ amount: rest, method: 'cash' }] : [], note: r.d === 'refused' ? 'Refusée (retour livreur)' : undefined });
      }
      const label = mode === 'retenue' ? 'frais retenus par le livreur' : mode === 'apart' ? 'frais payés à part' : 'frais à payer plus tard (compte du livreur)';
      await settleCourier(courier, on.map((r) => r.o.id), n, account, [note.trim(), label].filter(Boolean).join(' · '));
      if (payFees > 0) await settleCourier(courier, [], -payFees, feeAccount, 'Frais de livraison payés au livreur');
      toast(`Retour de ${courier.name} enregistré`);
      setDec({}); setFees({}); setOff({}); setAmount(null); setNote('');
    } catch (e: any) { toast(e?.message ?? String(e), 'error'); }
    setBusy(false);
  }

  return (
    <>
      <div className="card card-flush">
        <div className="card-pad row-between">
          <div><h2>{courier.name}</h2><p className="small muted">{courier.phone ? fmtPhone(courier.phone) + ' · ' : ''}{b.pending.length} colis à régler{b.carry ? ` · reste des fois précédentes : ${b.carry > 0 ? `il doit ${fmtAr(b.carry)}` : `on lui doit ${fmtAr(-b.carry)}`}` : ''}</p></div>
        </div>
        {blockedRows.length > 0 && <div className="card-pad"><div className="notice notice-danger"><Icon name="alert" /><span>{blockedRows.length} colis avec un <strong>choix à préciser</strong> : touchez « Préciser le choix » pour indiquer ce que le client a gardé.</span></div></div>}
        {rows.length === 0 ? <p className="card-pad small muted">Aucun colis à régler.</p> : (
          <div className="table-wrap"><table className="table return-table">
            <thead><tr><th></th><th>Colis</th><th>Résultat</th><th className="t-num">Articles à encaisser</th><th className="t-num">Frais de livraison</th><th className="t-num">Déjà payé</th><th className="t-num">Il a en main</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.o.id} className={r.on ? 'is-checked' : ''}>
                <td><input type="checkbox" className="perm-check" checked={r.on} disabled={r.blocked} onChange={(e) => setOff({ ...off, [r.o.id]: !e.target.checked })} aria-label={`Régler ${r.o.number}`} /></td>
                <td><a href={`#/commandes/${r.o.id}`}><strong>{r.o.number}</strong></a> <span className="small">{orderLabel(r.o)}</span>
                  <div className="small muted">{get<Zone>('zones', r.o.zoneId || '')?.name}{r.o.place ? ` — ${r.o.place}` : ''} · parti le {fmtDateTime(r.o.dispatchedAt)}</div></td>
                <td>
                  {r.open ? (r.blocked ? <Button onClick={() => setRet(r.o)}>Préciser le choix ({choiceQty(r.o)})</Button> : (
                    <div className="stack-s">
                      <div className="segmented small-seg" role="group" aria-label={`Résultat ${r.o.number}`}>
                        <button type="button" aria-pressed={r.d === 'delivered'} onClick={() => setDec({ ...dec, [r.o.id]: 'delivered' })}>Livrée</button>
                        <button type="button" aria-pressed={r.d === 'refused'} onClick={() => setDec({ ...dec, [r.o.id]: 'refused' })}>Refusée</button>
                      </div>
                      <div className="row" style={{ gap: 4 }}>
                        <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => setRet(r.o)}>En partie / choix…</button>
                        <button type="button" className="link-btn" onClick={() => setToShop(r.o)}>Client en boutique…</button>
                      </div>
                    </div>
                  )) : <Badge tone={r.o.status === 'refused' ? 'danger' : 'ok'}>{r.o.status === 'refused' ? 'Refusée' : r.o.status === 'partial' ? 'Livrée en partie' : 'Livrée'}</Badge>}
                </td>
                <td className="t-num"><strong>{fmtAr(r.x.toCollect)}</strong></td>
                <td className="t-num">{r.open && !r.blocked ? <input className="cell-input num-input" inputMode="numeric" aria-label={`Frais ${r.o.number}`} value={fees[r.o.id] ?? String(r.fee)} onChange={(e) => setFees({ ...fees, [r.o.id]: e.target.value })} /> : fmtAr(r.fee)}
                  {r.open && r.fee !== (r.o.deliveryFee || 0) && <div className="small muted">prévu {fmtAr(r.o.deliveryFee)}</div>}</td>
                <td className="t-num">{r.prepaid ? <>{fmtAr(r.prepaid)}<div className="small muted">payé avant</div></> : '—'}</td>
                <td className="t-num"><strong>{fmtAr(r.x.toCollect + r.x.feeKept)}</strong></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {on.length > 0 && (
        <div className="card stack">
          <h2>Compte avec {courier.name}</h2>
          <table className="kv-table"><tbody>
            <tr><td>Prix des articles encaissés ({on.length} colis)</td><td>{fmtAr(collect)}</td></tr>
            <tr><td>Frais de livraison encaissés auprès des clients</td><td>{fmtAr(feeKept)}</td></tr>
            <tr className="total"><td>Total que le livreur a en main</td><td>{fmtAr(inHand)}</td></tr>
            <tr><td className="sub">Frais qui reviennent au livreur</td><td>{fmtAr(feeAll)}</td></tr>
            {feeOwed > 0 && <tr><td className="sub">dont déjà payés à la boutique par le client (à lui rendre)</td><td>{fmtAr(feeOwed)}</td></tr>}
            {b.carry !== 0 && <tr><td className="sub">Reste des fois précédentes</td><td>{b.carry > 0 ? '+ ' : '− '}{fmtAr(Math.abs(b.carry))}</td></tr>}
          </tbody></table>
          <div className="stack-s">
            <strong className="small">Frais du livreur :</strong>
            <div className="segmented" role="group" aria-label="Paiement des frais du livreur">
              <button type="button" aria-pressed={mode === 'retenue'} onClick={() => { setMode('retenue'); setAmount(null); }}>Retenus sur l’argent versé</button>
              <button type="button" aria-pressed={mode === 'apart'} onClick={() => { setMode('apart'); setAmount(null); }}>Payés à part</button>
              <button type="button" aria-pressed={mode === 'plustard'} onClick={() => { setMode('plustard'); setAmount(null); }}>Plus tard (son compte)</button>
            </div>
            <p className="small muted">{mode === 'retenue' ? `Il garde ses frais : il vous remet ${fmtAr(Math.max(0, handOver))}.` : mode === 'apart' ? `Il vous remet tout (${fmtAr(Math.max(0, handOver))}) et vous lui payez ses frais (${fmtAr(feeAll)}) à part.` : `Il vous remet tout (${fmtAr(Math.max(0, handOver))}) ; ses frais (${fmtAr(feeAll)}) restent sur son compte et seront payés un autre jour.`}</p>
          </div>
          <div className="grid-2">
            <TextField label="Montant remis par le livreur (Ar)" value={amount ?? String(Math.max(0, handOver))} onChange={setAmount} inputMode="numeric" />
            <SelectField label="Reçu sur" value={account} onChange={(v) => setAccount(v as AccountId)} options={ACCOUNT_IDS.map((a) => ({ value: a, label: ACCOUNTS[a] }))} />
            {mode === 'apart' && <SelectField label={`Frais (${fmtAr(feeAll)}) payés depuis`} value={feeAccount} onChange={(v) => setFeeAccount(v as AccountId)} options={ACCOUNT_IDS.map((a) => ({ value: a, label: ACCOUNTS[a] }))} />}
          </div>
          <TextField label="Remarque (facultatif)" value={note} onChange={setNote} />
          <p className="small">{after === 0 ? '✓ Après validation, le compte du livreur est à zéro.' : after > 0 ? `Il restera ${fmtAr(after)} à verser par le livreur (reporté au prochain retour).` : `La boutique lui devra ${fmtAr(-after)} (sur son compte, à payer plus tard).`}</p>
          <div className="row"><Button busy={busy} disabled={!canSettle} icon="check" onClick={() => setAsk(true)}>Valider le retour de {courier.name}</Button>{!canSettle && <span className="small muted">Réservé aux personnes qui font les règlements des livreurs.</span>}</div>
        </div>
      )}
      {ask && <Confirm title={`Valider le retour de ${courier.name} ?`} confirmLabel="Valider" onClose={() => setAsk(false)} onConfirm={validate}
        message={<div className="stack-s"><p>{on.length} colis seront enregistrés et réglés : {on.filter((r) => r.open).map((r) => `${r.o.number} ${r.d === 'delivered' ? 'livrée' : 'refusée'}`).join(', ') || 'déjà saisis'}.</p>
          <p><strong>{courier.name} vous remet {fmtAr(n)}</strong> ({ACCOUNTS[account]}){payFees ? <> ; vous lui payez <strong>{fmtAr(payFees)}</strong> de frais ({ACCOUNTS[feeAccount]})</> : ''}.</p>
          <p className="small muted">Après validation, ces colis ne peuvent plus changer de livreur. Une erreur se corrige ensuite par un nouveau versement.</p></div>} />}
      {ret && <ReturnModal order={ret} onClose={() => setRet(null)} />}
      {toShop && <Confirm title="Le client vient chercher en boutique" confirmLabel="Annuler la livraison" message={<p>Le colis {toShop.number} revient en boutique, réservé pour le client. Pas de frais de livraison, pas de dédommagement pour le livreur. La commande deviendra une vente sur place quand le client passera.</p>}
        onClose={() => setToShop(null)} onConfirm={async () => { await cancelDeliveryToShop(toShop); toast('Livraison annulée : la commande attend le client en boutique'); }} />}
    </>
  );
}

