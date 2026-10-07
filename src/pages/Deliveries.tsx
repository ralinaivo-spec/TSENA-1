// Livraisons : commandes prêtes par axe, en cours par livreur, comptes des livreurs, zones et frais.
import { useMemo, useState } from 'react';
import { audit, useCan } from '../lib/auth';
import { get, remove, save, useTable } from '../lib/db';
import { fmtAr, fmtNum, parseNum } from '../lib/catalog';
import { courierAccount, fmtPhone, isPickupZone, orderLabel, remaining, totalQty, type Courier, type Order, type Zone } from '../lib/orders';
import { Badge, Button, Confirm, Empty, IconButton, Modal, PageHead, SelectField, TextField, Toggle, fmtDateTime, navigate, toast, useRoute } from '../ui/kit';
import { Icon } from '../ui/icons';
import { PeriodPicker, defaultPeriod, type Period } from '../ui/period';
import { DispatchModal, ReassignModal, ReturnModal, OrderRow } from './Orders';
import { useCompany } from '../lib/settings';
import { deliveryNoteDoc, joinDocs, routeSheetDoc } from '../lib/print';
import { PrintButton } from '../ui/print';
import { ACCOUNTS, ACCOUNT_IDS, courierBalance, deliveryNet, settleCourier, type AccountId, type CourierSettlement } from '../lib/money';

const TABS = [
  { key: 'a-livrer', label: 'À livrer', perm: 'orders.dispatch' },
  { key: 'en-cours', label: 'En cours', perm: 'deliveries.manage' },
  { key: 'livreurs', label: 'Livreurs', perm: 'couriers.view' },
  { key: 'zones', label: 'Zones et frais', perm: 'couriers.view' },
];

export function DeliveriesPage() {
  const can = useCan();
  const route = useRoute();
  const tabs = TABS.filter((t) => can(t.perm));
  const cur = tabs.find((t) => route.endsWith('/' + t.key)) ?? tabs[0];
  if (!cur) return <Empty icon="lock" title="Accès réservé" />;
  return (
    <>
      <PageHead title="Livraisons" />
      <div className="tabs" role="tablist">{tabs.map((t) => <button key={t.key} role="tab" aria-selected={cur.key === t.key} onClick={() => navigate('/livraisons/' + t.key)}>{t.label}</button>)}</div>
      {cur.key === 'a-livrer' && <ToDeliver />}
      {cur.key === 'en-cours' && <OutNow />}
      {cur.key === 'livreurs' && <Couriers />}
      {cur.key === 'zones' && <Zones />}
    </>
  );
}

function ToDeliver() {
  const orders = useTable<Order>('orders');
  const zones = useTable<Zone>('zones');
  const [sel, setSel] = useState<string[]>([]);
  const [dispatch, setDispatch] = useState(false);
  const ready = orders.filter((o) => o.status === 'ready' && !isPickupZone(o.zoneId));
  const preparing = orders.filter((o) => o.status === 'confirmed').length;
  const groups = useMemo(() => {
    const m = new Map<string, Order[]>();
    for (const o of ready) { const k = o.zoneId || ''; if (!m.has(k)) m.set(k, []); m.get(k)!.push(o); }
    return [...m.entries()].sort((a, b) => (get<Zone>('zones', a[0])?.order ?? 99) - (get<Zone>('zones', b[0])?.order ?? 99));
  }, [orders, zones]);
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  return (
    <>
      <div className="card row-between">
        <p className="small">{ready.length} commande(s) prête(s){preparing ? ` · ${preparing} encore à préparer` : ''}. Cochez celles d’un même axe puis remettez-les au livreur.</p>
        <Button icon="truck" disabled={!sel.length} onClick={() => setDispatch(true)}>Remettre {sel.length || ''} au livreur</Button>
      </div>
      {groups.length === 0 ? <div className="card"><Empty icon="truck" title="Aucune commande prête"><Button variant="ghost" onClick={() => navigate('/commandes/preparer')}>Voir les commandes à préparer</Button></Empty></div> : groups.map(([zid, list]) => (
        <div key={zid} className="card card-flush">
          <div className="row-between card-pad">
            <h3>{get<Zone>('zones', zid)?.name || 'Zone non indiquée'} <span className="muted small">· {list.length} commande(s)</span></h3>
            <Button variant="quiet" onClick={() => setSel([...new Set([...sel, ...list.map((o) => o.id)])])}>Tout cocher</Button>
          </div>
          <ul className="list">
            {list.map((o) => (
              <li key={o.id} className="list-item">
                <input type="checkbox" className="perm-check" checked={sel.includes(o.id)} onChange={() => toggle(o.id)} aria-label={`Choisir ${o.number}`} />
                <a className="list-item-main" href={`#/commandes/${o.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className="list-item-title">{orderLabel(o)}</span>
                  <p className="small muted">{o.number} · {fmtPhone(o.phone)} · {o.place || 'lieu non précisé'} · {fmtNum(totalQty(o))} article(s){o.lines.some((l) => l.isChoice) ? ' + choix' : ''}</p>
                </a>
                <div className="list-item-side"><strong className="num">{fmtAr(Math.max(0, remaining(o)))}</strong><span className="small muted">à encaisser</span></div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {dispatch && <DispatchModal orders={ready.filter((o) => sel.includes(o.id))} onClose={() => { setDispatch(false); setSel([]); }} />}
    </>
  );
}

function OutNow() {
  const company = useCompany();
  const orders = useTable<Order>('orders');
  const couriers = useTable<Courier>('couriers');
  useTable<Zone>('zones');
  const [ret, setRet] = useState<Order | null>(null);
  const [move, setMove] = useState<Order | null>(null);
  const out = orders.filter((o) => o.status === 'out');
  const byCourier = new Map<string, Order[]>();
  for (const o of out) { const k = o.courierId || ''; if (!byCourier.has(k)) byCourier.set(k, []); byCourier.get(k)!.push(o); }
  return (
    <>
      {out.length === 0 ? <div className="card"><Empty icon="truck" title="Aucune livraison en cours" /></div> : [...byCourier.entries()].map(([cid, list]) => {
        const c = couriers.find((x) => x.id === cid);
        return (
          <div key={cid} className="card card-flush">
            <div className="row-between card-pad">
              <div><h3>{c?.name || 'Livreur ?'}</h3><p className="small muted">{list.length} commande(s) · {fmtNum(list.reduce((s, o) => s + o.lines.reduce((t, l) => t + l.qty, 0), 0))} article(s) dehors</p></div>
              <div className="row" style={{ alignItems: 'center' }}>
                <PrintButton label="Ticket livreur" docs={[
                  { key: 'route', label: 'Ticket des livraisons', build: () => routeSheetDoc(c, list, company) },
                  { key: 'bons', label: `Bons de livraison (${list.length})`, build: () => joinDocs(`Bons de livraison ${c?.name ?? ''}`, list.map((o) => deliveryNoteDoc(o, company))) },
                ]} />
                <div className="total-box"><span className="small muted">À encaisser</span><strong className="num">{fmtAr(list.reduce((s, o) => s + Math.max(0, remaining(o)), 0))}</strong></div>
              </div>
            </div>
            <ul className="list">
              {list.map((o) => (
                <li key={o.id} className="list-item">
                  <a className="list-item-main" href={`#/commandes/${o.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    <span className="list-item-title">{orderLabel(o)} <span className="muted small">{o.number}</span></span>
                    <p className="small muted">{get<Zone>('zones', o.zoneId || '')?.name}{o.place ? ` — ${o.place}` : ''} · à encaisser {fmtAr(Math.max(0, remaining(o)))}</p>
                  </a>
                  <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <Button variant="quiet" onClick={() => setMove(o)}>Changer de livreur</Button>
                    <Button variant="ghost" onClick={() => setRet(o)}>Retour</Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {ret && <ReturnModal order={ret} onClose={() => setRet(null)} />}
      {move && <ReassignModal order={move} onClose={() => setMove(null)} />}
    </>
  );
}

function Couriers() {
  const can = useCan();
  const company = useCompany();
  const couriers = useTable<Courier>('couriers');
  useTable<Order>('orders');
  const zones = useTable<Zone>('zones');
  const [period, setPeriod] = useState<Period>(defaultPeriod('today'));
  const [edit, setEdit] = useState<Courier | 'new' | null>(null);
  const [open, setOpen] = useState<Courier | null>(null);
  const [settle, setSettle] = useState<Courier | null>(null);
  useTable<CourierSettlement>('courierSettlements');
  const sorted = [...couriers].sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name));
  return (
    <>
      <div className="card stack">
        <div className="row-between"><p className="small muted">Les livreurs n’utilisent pas l’application : les vendeurs saisissent tout pour eux.</p>{can('couriers.manage') && <Button icon="plus" onClick={() => setEdit('new')}>Ajouter un livreur</Button>}</div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      <div className="card card-flush">
        {sorted.length === 0 ? <Empty icon="truck" title="Aucun livreur" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Livreur</th><th className="t-num">En cours</th><th className="t-num">Livrées</th><th className="t-num">Encaissé</th><th className="t-num">Frais gagnés</th><th className="t-num">Solde période</th><th className="t-num">À verser (compte)</th><th></th></tr></thead>
              <tbody>
                {sorted.map((c) => {
                  const a = courierAccount(c.id, period.from, period.to);
                  const bal = courierBalance(c.id).due;
                  return (
                    <tr key={c.id} style={{ opacity: c.active === false ? .55 : 1 }} className="row-link" onClick={() => setOpen(c)}>
                      <td><strong>{c.name}</strong><div className="small muted">{[fmtPhone(c.phone), (c.zoneIds || []).map((z) => zones.find((x) => x.id === z)?.name).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div></td>
                      <td className="t-num">{a.out || '—'}</td>
                      <td className="t-num">{a.deliveries || '—'}</td>
                      <td className="t-num">{fmtAr(a.collected)}</td>
                      <td className="t-num">{fmtAr(a.fees)}</td>
                      <td className={`t-num ${a.due > 0 ? '' : a.due < 0 ? 'neg' : ''}`}><strong>{a.due > 0 ? `rend ${fmtAr(a.due)}` : a.due < 0 ? `à lui verser ${fmtAr(-a.due)}` : '—'}</strong></td>
                      <td className={`t-num ${bal < 0 ? 'neg' : ''}`}><strong>{bal > 0 ? `doit ${fmtAr(bal)}` : bal < 0 ? `à lui verser ${fmtAr(-bal)}` : '✓ à jour'}</strong></td>
                      <td className="t-actions"><div className="row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'flex-end' }}><span onClick={(e) => e.stopPropagation()}><PrintButton variant="quiet" label="Ticket" docs={[{ key: 'liste', label: 'Livraisons à verser', build: () => routeSheetDoc(c, courierBalance(c.id).pending, company, 'LIVRAISONS À VERSER') }]} /></span>{can('couriers.settle') && <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setSettle(c); }}>Versement</Button>}{can('couriers.manage') && <IconButton icon="edit" label="Modifier" onClick={(e) => { e.stopPropagation(); setEdit(c); }} />}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="small muted">Solde = argent encaissé auprès des clients − frais de livraison gagnés. « Rend » : le livreur doit cette somme à la boutique. « À lui verser » : la boutique lui doit ses frais (ex. client qui a tout payé par MVola à la boutique). « À verser (compte) » : toutes les livraisons pas encore versées + le reste des versements précédents. « Ticket » imprime la liste à remettre au livreur ; « Versement » permet de cocher les livraisons effectuées.</p>
      {edit && <CourierForm courier={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {open && <CourierOrders courier={open} onClose={() => setOpen(null)} />}
      {settle && <SettleModal courier={settle} onClose={() => setSettle(null)} />}
    </>
  );
}

/**
 * Versement d'un livreur (admin) : on coche les livraisons réellement effectuées. Seules celles-ci sont réglées ;
 * les autres restent sur son compte et passent automatiquement au versement suivant.
 */
function SettleModal({ courier, onClose }: { courier: Courier; onClose: () => void }) {
  const company = useCompany();
  useTable<Order>('orders');
  const settlements = useTable<CourierSettlement>('courierSettlements').filter((s) => s.courierId === courier.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  const b = courierBalance(courier.id);
  const [checked, setChecked] = useState<string[]>([]);
  const [amount, setAmount] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountId>('cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [ret, setRet] = useState<Order | null>(null);
  const checkable = (o: Order) => !(o.status === 'out' && o.lines.some((l) => l.isChoice));
  const sel = b.pending.filter((o) => checked.includes(o.id));
  const selNet = sel.reduce((t, o) => t + deliveryNet(o).net, 0);
  const expected = b.carry + selNet;
  const n = amount == null ? Math.abs(expected) : parseNum(amount) || 0;
  const owesShop = expected >= 0;
  const after = owesShop ? expected - n : expected + n;
  const toggle = (id: string) => setChecked(checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id]);
  return (
    <Modal title={`Versement — ${courier.name}`} onClose={onClose} wide
      footer={<>
        <PrintButton label="Ticket des livraisons" docs={[{ key: 'liste', label: 'Livraisons à verser', build: () => routeSheetDoc(courier, b.pending, company, 'LIVRAISONS À VERSER') }]} />
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button busy={busy} disabled={!sel.length && !n} onClick={async () => {
          setBusy(true);
          try { await settleCourier(courier, sel.map((o) => o.id), owesShop ? n : -n, account, note.trim() || undefined); toast('Versement enregistré'); onClose(); } finally { setBusy(false); }
        }}>Valider le versement</Button></>}>
      <div className="stack">
        <p className="small">Cochez les livraisons <strong>réellement effectuées</strong> (d’après le ticket rapporté par le livreur). Les autres restent sur son compte et seront reportées au prochain versement. Pour une livraison pas faite, refusée ou un retour, touchez « Retour / anomalie ».</p>
        {b.pending.length === 0 ? <Empty icon="truck" title="Aucune livraison en attente de versement" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr>
              <th style={{ width: 40 }}><input type="checkbox" className="perm-check" aria-label="Tout cocher" checked={sel.length > 0 && sel.length === b.pending.filter(checkable).length} onChange={(e) => setChecked(e.target.checked ? b.pending.filter(checkable).map((o) => o.id) : [])} /></th>
              <th>Livraison</th><th>État</th><th className="t-num">Client paie</th><th className="t-num">Frais</th><th className="t-num">À verser</th><th></th>
            </tr></thead>
            <tbody>
              {b.pending.map((o) => {
                const d = deliveryNet(o);
                const ok = checkable(o);
                return (
                  <tr key={o.id} className={checked.includes(o.id) ? 'is-checked' : ''}>
                    <td><input type="checkbox" className="perm-check" disabled={!ok} checked={checked.includes(o.id)} onChange={() => toggle(o.id)} aria-label={`Livraison ${o.number} effectuée`} /></td>
                    <td><strong>{o.number}</strong> <span className="small muted">{orderLabel(o)} · {get<Zone>('zones', o.zoneId || '')?.name}{o.place ? ` — ${o.place}` : ''} · partie le {fmtDateTime(o.dispatchedAt)}</span></td>
                    <td>{o.status === 'out' ? <Badge tone="warn">{ok ? 'À confirmer' : 'Choix à préciser'}</Badge> : <Badge tone={o.status === 'refused' ? 'danger' : 'ok'}>{o.status === 'refused' ? 'Refusée' : o.status === 'partial' ? 'Livrée en partie' : 'Livrée'}</Badge>}</td>
                    <td className="t-num">{fmtAr(d.collect)}</td><td className="t-num">{fmtAr(d.fee)}</td><td className="t-num"><strong>{fmtAr(d.net)}</strong></td>
                    <td>{o.status === 'out' && <Button variant="quiet" onClick={() => setRet(o)}>Retour / anomalie</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
        <div className="stat-grid">
          {b.carry !== 0 && <div className="card stat"><span className="small muted">Reste des versements précédents</span><strong className={`stat-value num ${b.carry < 0 ? 'neg' : ''}`}>{fmtAr(b.carry)}</strong></div>}
          <div className="card stat"><span className="small muted">Livraisons cochées ({sel.length})</span><strong className="stat-value num">{fmtAr(selNet)}</strong></div>
          <div className="card stat stat-strong"><span className="small muted">{owesShop ? 'Le livreur doit verser' : 'La boutique lui doit'}</span><strong className="stat-value num">{fmtAr(Math.abs(expected))}</strong></div>
          <div className="card stat"><span className="small muted">Reporté (non cochées)</span><strong className="stat-value num">{fmtAr(b.pendingNet - selNet)}</strong></div>
        </div>
        <div className="grid-2">
          <TextField label={owesShop ? 'Montant versé par le livreur (Ar)' : 'Montant versé au livreur (Ar)'} value={amount ?? String(Math.abs(expected) || '')} onChange={setAmount} inputMode="numeric" />
          <SelectField label={owesShop ? 'Argent reçu sur' : 'Payé depuis'} value={account} onChange={(v) => setAccount(v as AccountId)} options={ACCOUNT_IDS.map((a) => ({ value: a, label: ACCOUNTS[a] }))} />
        </div>
        <TextField label="Note (remarques du ticket, facultatif)" value={note} onChange={setNote} />
        <p className="small">{after === 0 ? '✓ Après ce versement, les livraisons cochées sont soldées.' : after > 0 ? `Il restera ${fmtAr(after)} à verser par le livreur (ajouté au prochain versement).` : `La boutique lui devra encore ${fmtAr(-after)}.`}</p>
        {sel.some((o) => o.status === 'out') && <p className="small muted">Les livraisons cochées encore « à confirmer » seront marquées livrées : le client a payé au livreur tout ce qui restait.</p>}
        {settlements.length > 0 && (
          <div className="stack-s">
            <h3>Derniers versements</h3>
            <ul className="list">{settlements.map((s) => (
              <li key={s.id} className="list-item"><div className="list-item-main"><span className="list-item-title">{s.amount >= 0 ? `Versé ${fmtAr(s.amount)}` : `Payé au livreur ${fmtAr(-s.amount)}`}</span><p className="small muted">{fmtDateTime(s.at)} · {ACCOUNTS[s.account]} · attendu {fmtAr(s.balanceBefore)} · {s.orderIds.length} livraison(s){s.userName ? ` · ${s.userName}` : ''}{s.note ? ` · ${s.note}` : ''}</p></div></li>
            ))}</ul>
          </div>
        )}
      </div>
      {ret && <ReturnModal order={ret} onClose={() => setRet(null)} />}
    </Modal>
  );
}

function CourierOrders({ courier, onClose }: { courier: Courier; onClose: () => void }) {
  const orders = useTable<Order>('orders').filter((o) => o.courierId === courier.id).sort((a, b) => (b.dispatchedAt || '').localeCompare(a.dispatchedAt || '')).slice(0, 60);
  return (
    <Modal title={`Livraisons de ${courier.name}`} onClose={onClose} wide>
      {orders.length === 0 ? <Empty icon="truck" title="Aucune livraison" /> : <ul className="list">{orders.map((o) => <OrderRow key={o.id} o={o} />)}</ul>}
    </Modal>
  );
}

function CourierForm({ courier, onClose }: { courier?: Courier; onClose: () => void }) {
  const zones = useTable<Zone>('zones').filter((z) => z.active !== false);
  const [name, setName] = useState(courier?.name ?? '');
  const [phone, setPhone] = useState(courier?.phone ?? '');
  const [zoneIds, setZoneIds] = useState<string[]>(courier?.zoneIds ?? []);
  const [active, setActive] = useState(courier?.active !== false);
  const [notes, setNotes] = useState(courier?.notes ?? '');
  return (
    <Modal title={courier ? 'Modifier le livreur' : 'Nouveau livreur'} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={!name.trim()} onClick={async () => {
        await save('couriers', { id: courier?.id, name: name.trim(), phone: phone.trim() || undefined, zoneIds, active, notes: notes.trim() || undefined });
        await audit(courier ? 'Livreur modifié' : 'Livreur ajouté', name.trim());
        toast('Livreur enregistré'); onClose();
      }}>Enregistrer</Button></>}>
      <div className="stack">
        <TextField label="Nom" value={name} onChange={setName} autoFocus />
        <TextField label="Téléphone" value={phone} onChange={setPhone} type="tel" inputMode="tel" />
        <div className="stack-s"><strong className="small">Axes habituels</strong>
          <div className="row" style={{ gap: 6 }}>{zones.map((z) => <button key={z.id} type="button" className="chip" aria-pressed={zoneIds.includes(z.id)} onClick={() => setZoneIds(zoneIds.includes(z.id) ? zoneIds.filter((x) => x !== z.id) : [...zoneIds, z.id])}>{z.name}</button>)}</div>
        </div>
        <TextField label="Notes" value={notes} onChange={setNotes} />
        {courier && <Toggle checked={active} onChange={setActive} label="Livreur actif" />}
      </div>
    </Modal>
  );
}

export function Zones() {
  const can = useCan();
  const zones = useTable<Zone>('zones');
  const [form, setForm] = useState<Zone | 'new' | null>(null);
  const [del, setDel] = useState<Zone | null>(null);
  const sorted = [...zones].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
  const edit = can('couriers.manage') || can('settings.company');
  return (
    <>
      <div className="card row-between">
        <p className="small muted" style={{ flex: '1 1 260px' }}>Les frais de chaque zone sont proposés automatiquement dans les commandes, et restent modifiables commande par commande.</p>
        {edit ? <Button icon="plus" onClick={() => setForm('new')}>Ajouter une zone</Button> : <Badge>Modification réservée au gérant</Badge>}
      </div>
      <div className="card card-flush">
        {sorted.length === 0 ? <Empty icon="truck" title="Aucune zone">{edit && <Button icon="plus" onClick={() => setForm('new')}>Ajouter une zone</Button>}</Empty> : (
          <ul className="list">
            {sorted.map((z) => (
              <li key={z.id} className="list-item" style={{ opacity: z.active === false ? .55 : 1 }}>
                <span className="avatar"><Icon name={isPickupZone(z) ? 'store' : 'truck'} size={18} /></span>
                <div className="list-item-main">
                  <div className="row" style={{ gap: 8 }}><span className="list-item-title">{z.name}</span>{z.active === false && <Badge>Masquée</Badge>}</div>
                  <p className="small"><strong className="num">{fmtAr(z.fee)}</strong> <span className="muted">· {isPickupZone(z) ? 'Sur boutique, sans livreur' : 'Livraison'}</span></p>
                </div>
                {edit && <div className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                  <Button variant="ghost" icon="edit" className="btn-compact" onClick={() => setForm(z)}><span className="hide-sm">Modifier</span></Button>
                  {z.id !== 'zone-retrait' && <IconButton icon="trash" label="Supprimer" onClick={() => setDel(z)} />}
                </div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {form && <ZoneForm zone={form === 'new' ? undefined : form} count={sorted.length} onClose={() => setForm(null)} />}
      {del && <Confirm title="Supprimer la zone" danger confirmLabel="Supprimer" message={<p>La zone « {del.name} » sera supprimée. Les commandes déjà saisies gardent leurs frais.</p>} onClose={() => setDel(null)} onConfirm={async () => { await remove('zones', del.id); await audit('Zone supprimée', del.name); toast('Zone supprimée'); }} />}
    </>
  );
}

function ZoneForm({ zone, count, onClose }: { zone?: Zone; count: number; onClose: () => void }) {
  const [name, setName] = useState(zone?.name ?? '');
  const [fee, setFee] = useState(zone ? String(zone.fee) : '');
  const [pickup, setPickup] = useState(zone ? isPickupZone(zone) : false);
  const [active, setActive] = useState(zone?.active !== false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fixedPickup = zone?.id === 'zone-retrait';
  return (
    <Modal title={zone ? 'Modifier la zone' : 'Nouvelle zone de livraison'} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button busy={busy} onClick={async () => {
        setError(null);
        if (!name.trim()) return setError('Indiquez le nom de la zone.');
        const f = pickup ? 0 : parseNum(fee);
        if (!pickup && !(f != null && f > 0)) return setError('Indiquez les frais de livraison de cette zone.');
        setBusy(true);
        await save('zones', { id: zone?.id, name: name.trim(), fee: f ?? 0, pickup: pickup || undefined, active, order: zone?.order ?? count });
        await audit(zone ? 'Zone modifiée' : 'Zone ajoutée', `${name.trim()} — ${f ?? 0} Ar`);
        toast(zone ? 'Zone modifiée' : 'Zone ajoutée');
        setBusy(false); onClose();
      }}>{zone ? 'Enregistrer' : 'Ajouter la zone'}</Button></>}>
      <div className="stack">
        <TextField label="Nom de la zone / de l’axe" value={name} onChange={setName} placeholder="Ex. Ivandry – Ambatobe" autoFocus />
        {!pickup && <TextField label="Frais de livraison (Ar)" value={fee} onChange={setFee} inputMode="numeric" placeholder="Ex. 4000" />}
        <Toggle checked={pickup} onChange={setPickup} disabled={fixedPickup} label="Sur boutique (le client vient chercher : 0 Ar, sans livreur)" />
        {zone && <Toggle checked={active} onChange={setActive} label="Zone active (décochez pour la masquer dans les commandes)" />}
        {error && <div className="notice notice-danger"><Icon name="alert" /><span>{error}</span></div>}
      </div>
    </Modal>
  );
}
