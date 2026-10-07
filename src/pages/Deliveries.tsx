// Livraisons : commandes prêtes par axe, en cours par livreur, comptes des livreurs, zones et frais.
import { useMemo, useState } from 'react';
import { audit, useCan } from '../lib/auth';
import { get, remove, save, useTable } from '../lib/db';
import { fmtAr, fmtNum, parseNum } from '../lib/catalog';
import { courierAccount, fmtPhone, remaining, totalQty, type Courier, type Order, type Zone } from '../lib/orders';
import { Badge, Button, Confirm, Empty, IconButton, Modal, PageHead, TextField, Toggle, navigate, toast, useRoute } from '../ui/kit';
import { PeriodPicker, defaultPeriod, type Period } from '../ui/period';
import { DispatchModal, ReturnModal, OrderRow } from './Orders';

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
  const ready = orders.filter((o) => o.status === 'ready');
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
                  <span className="list-item-title">{o.name || fmtPhone(o.phone)}</span>
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
  const orders = useTable<Order>('orders');
  const couriers = useTable<Courier>('couriers');
  useTable<Zone>('zones');
  const [ret, setRet] = useState<Order | null>(null);
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
              <div className="total-box"><span className="small muted">À encaisser</span><strong className="num">{fmtAr(list.reduce((s, o) => s + Math.max(0, remaining(o)), 0))}</strong></div>
            </div>
            <ul className="list">
              {list.map((o) => (
                <li key={o.id} className="list-item">
                  <a className="list-item-main" href={`#/commandes/${o.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    <span className="list-item-title">{o.name || fmtPhone(o.phone)} <span className="muted small">{o.number}</span></span>
                    <p className="small muted">{get<Zone>('zones', o.zoneId || '')?.name}{o.place ? ` — ${o.place}` : ''} · à encaisser {fmtAr(Math.max(0, remaining(o)))}</p>
                  </a>
                  <Button variant="ghost" onClick={() => setRet(o)}>Retour</Button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {ret && <ReturnModal order={ret} onClose={() => setRet(null)} />}
    </>
  );
}

function Couriers() {
  const can = useCan();
  const couriers = useTable<Courier>('couriers');
  useTable<Order>('orders');
  const zones = useTable<Zone>('zones');
  const [period, setPeriod] = useState<Period>(defaultPeriod('today'));
  const [edit, setEdit] = useState<Courier | 'new' | null>(null);
  const [open, setOpen] = useState<Courier | null>(null);
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
              <thead><tr><th>Livreur</th><th className="t-num">En cours</th><th className="t-num">Livrées</th><th className="t-num">Encaissé</th><th className="t-num">Frais gagnés</th><th className="t-num">Solde</th><th></th></tr></thead>
              <tbody>
                {sorted.map((c) => {
                  const a = courierAccount(c.id, period.from, period.to);
                  return (
                    <tr key={c.id} style={{ opacity: c.active === false ? .55 : 1 }} className="row-link" onClick={() => setOpen(c)}>
                      <td><strong>{c.name}</strong><div className="small muted">{[fmtPhone(c.phone), (c.zoneIds || []).map((z) => zones.find((x) => x.id === z)?.name).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div></td>
                      <td className="t-num">{a.out || '—'}</td>
                      <td className="t-num">{a.deliveries || '—'}</td>
                      <td className="t-num">{fmtAr(a.collected)}</td>
                      <td className="t-num">{fmtAr(a.fees)}</td>
                      <td className={`t-num ${a.due > 0 ? '' : a.due < 0 ? 'neg' : ''}`}><strong>{a.due > 0 ? `rend ${fmtAr(a.due)}` : a.due < 0 ? `à lui verser ${fmtAr(-a.due)}` : '—'}</strong></td>
                      <td className="t-actions">{can('couriers.manage') && <IconButton icon="edit" label="Modifier" onClick={(e) => { e.stopPropagation(); setEdit(c); }} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="small muted">Solde = argent encaissé auprès des clients − frais de livraison gagnés. « Rend » : le livreur doit cette somme à la boutique. « À lui verser » : la boutique lui doit ses frais (ex. client qui a tout payé par MVola à la boutique). Les règlements seront enregistrés avec la trésorerie (étape 6).</p>
      {edit && <CourierForm courier={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {open && <CourierOrders courier={open} onClose={() => setOpen(null)} />}
    </>
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

function Zones() {
  const can = useCan();
  const zones = useTable<Zone>('zones');
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [del, setDel] = useState<Zone | null>(null);
  const [vals, setVals] = useState<Record<string, { name?: string; fee?: string }>>({});
  const sorted = [...zones].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
  const edit = can('couriers.manage');
  return (
    <>
      <div className="card stack">
        <p className="small muted">Les frais de chaque zone sont proposés automatiquement dans les commandes, et restent modifiables commande par commande.</p>
        {edit && (
          <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await save('zones', { name: name.trim(), fee: parseNum(fee) || 0, order: sorted.length, active: true });
            setName(''); setFee('');
          }}>
            <div style={{ flex: '2 1 220px' }}><TextField label="Nouvelle zone / axe" value={name} onChange={setName} placeholder="Ex. Ivandry – Ambatobe" /></div>
            <div style={{ flex: '1 1 120px' }}><TextField label="Frais (Ar)" value={fee} onChange={setFee} inputMode="numeric" /></div>
            <Button type="submit" icon="plus" disabled={!name.trim()}>Ajouter</Button>
          </form>
        )}
      </div>
      <div className="card card-flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Zone</th><th style={{ width: 140 }}>Frais (Ar)</th><th>État</th><th></th></tr></thead>
            <tbody>
              {sorted.map((z) => (
                <tr key={z.id} style={{ opacity: z.active === false ? .55 : 1 }}>
                  <td>{edit ? <input className="cell-input" aria-label="Nom" value={vals[z.id]?.name ?? z.name} onChange={(e) => setVals({ ...vals, [z.id]: { ...vals[z.id], name: e.target.value } })} onBlur={async () => { const v = vals[z.id]?.name; if (v != null && v.trim() && v !== z.name) await save('zones', { id: z.id, name: v.trim() }); }} /> : z.name}</td>
                  <td>{edit ? <input className="cell-input" inputMode="numeric" aria-label="Frais" value={vals[z.id]?.fee ?? String(z.fee)} onChange={(e) => setVals({ ...vals, [z.id]: { ...vals[z.id], fee: e.target.value } })} onBlur={async () => { const v = parseNum(vals[z.id]?.fee); if (v != null && v !== z.fee) { await save('zones', { id: z.id, fee: v }); toast('Frais enregistrés'); } }} /> : fmtAr(z.fee)}</td>
                  <td>{z.active === false ? <Badge>Masquée</Badge> : <Badge tone="ok">Active</Badge>}</td>
                  <td className="t-actions">{edit && <>
                    <Button variant="quiet" onClick={() => save('zones', { id: z.id, active: z.active === false })}>{z.active === false ? 'Réactiver' : 'Masquer'}</Button>
                    <IconButton icon="trash" label="Supprimer" onClick={() => setDel(z)} />
                  </>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {del && <Confirm title="Supprimer la zone" danger confirmLabel="Supprimer" message={<p>La zone « {del.name} » sera supprimée. Les commandes déjà saisies gardent leurs frais.</p>} onClose={() => setDel(null)} onConfirm={async () => { await remove('zones', del.id); }} />}
    </>
  );
}
