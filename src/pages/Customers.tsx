// Clients : retrouvés par téléphone, historique des commandes, taux de refus.
import { useMyScope } from '../lib/scope';
import { ScopeBar } from '../ui/scope';
import { useMemo, useState } from 'react';
import { useCan } from '../lib/auth';
import { get, save, useTable } from '../lib/db';
import { fmtAr, fmtNum } from '../lib/catalog';
import { fmtPhone, keptTotal, normPhone, type Customer, type Order, type Zone } from '../lib/orders';
import { Badge, Button, Empty, Modal, PageHead, SelectField, TextField, navigate, toast, useRoute } from '../ui/kit';
import { OrderForm, OrderRow } from './Orders';

function stats(c: Customer, orders: Order[]) {
  const mine = orders.filter((o) => o.customerId === c.id || normPhone(o.phone) === normPhone(c.phone));
  const done = mine.filter((o) => ['delivered', 'partial'].includes(o.status));
  const refused = mine.filter((o) => o.status === 'refused').length;
  const finished = done.length + refused;
  return { mine, count: mine.length, spent: done.reduce((s, o) => s + keptTotal(o) - (o.credit || 0) - (o.discount || 0), 0), refused, refusalRate: finished ? refused / finished : 0, last: mine.map((o) => o.createdAt).sort().pop() };
}

export function CustomersPage() {
  const route = useRoute();
  const id = route.split('/')[2];
  if (id) return <CustomerDetail id={id} />;
  return <CustomerList />;
}

function CustomerList() {
  const customers = useTable<Customer>('customers');
  const orders = useTable<Order>('orders');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(80);
  const scope = useMyScope();
  const list = useMemo(() => {
    const n = q.trim().toLowerCase(); const np = normPhone(q);
    return customers
      .filter((c) => !scope.on || orders.some((o) => o.customerId === c.id && scope.mine(o)))
      .filter((c) => !n || (c.name || '').toLowerCase().includes(n) || (np.length >= 3 && normPhone(c.phone).includes(np)) || (c.place || '').toLowerCase().includes(n))
      .map((c) => ({ c, s: stats(c, orders) }))
      .sort((a, b) => (b.s.last || b.c.createdAt).localeCompare(a.s.last || a.c.createdAt));
  }, [customers, orders, q, scope.on]);
  return (
    <>
      <PageHead title="Clients" subtitle={`${customers.length} client(s) — créés automatiquement à chaque commande`} />
      <ScopeBar scope={scope} mineLabel="Mes clients" text="Vous voyez les clients de vos commandes et ventes." />
      <div className="card"><div className="field"><input aria-label="Rechercher" placeholder="Rechercher un téléphone, un nom, un lieu…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <div className="card card-flush">
        {list.length === 0 ? <Empty icon="users" title="Aucun client" /> : (
          <ul className="list">
            {list.slice(0, limit).map(({ c, s }) => (
              <li key={c.id}>
                <a className="list-item list-link" href={`#/clients/${c.id}`}>
                  <span className="avatar">{(c.name || '?').charAt(0).toUpperCase()}</span>
                  <div className="list-item-main">
                    <div className="row" style={{ gap: 8 }}><span className="list-item-title">{c.name || fmtPhone(c.phone)}</span>{s.refused >= 2 && s.refusalRate >= 0.3 && <Badge tone="danger">Refuse souvent</Badge>}</div>
                    <p className="small muted">{fmtPhone(c.phone)}{c.place ? ` · ${c.place}` : ''}</p>
                  </div>
                  <div className="list-item-side"><strong className="num">{s.count} cmd</strong><span className="small muted">{fmtAr(s.spent)}</span></div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      {list.length > limit && <Button variant="ghost" onClick={() => setLimit(limit + 200)}>Afficher plus</Button>}
    </>
  );
}

function CustomerDetail({ id }: { id: string }) {
  const can = useCan();
  const customers = useTable<Customer>('customers');
  const orders = useTable<Order>('orders');
  const zones = useTable<Zone>('zones');
  const c = customers.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);
  const [newOrder, setNewOrder] = useState(false);
  if (!c) return <Empty icon="users" title="Client introuvable" />;
  const s = stats(c, orders);
  return (
    <>
      <div className="row"><Button variant="quiet" icon="chevronRight" className="back-btn" onClick={() => navigate('/clients')}>Clients</Button></div>
      <div className="card stack">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div><h1 style={{ fontSize: '1.6rem' }}>{c.name || fmtPhone(c.phone)}</h1><p className="muted"><a href={`tel:${c.phone}`}>{fmtPhone(c.phone)}</a>{c.phone2 ? ` · ${fmtPhone(c.phone2)}` : ''}{c.facebook ? ` · ${c.facebook}` : ''}</p></div>
          <div className="page-actions">
            <Button variant="ghost" icon="edit" onClick={() => setEdit(true)}>Modifier</Button>
            {can('orders.create') && <Button icon="plus" onClick={() => setNewOrder(true)}>Nouvelle commande</Button>}
          </div>
        </div>
        <div className="kv-row">
          <div><span className="small muted">Commandes</span><strong className="num">{s.count}</strong></div>
          <div><span className="small muted">Achats livrés</span><strong className="num">{fmtAr(s.spent)}</strong></div>
          <div><span className="small muted">Refus</span><strong className={`num ${s.refusalRate >= 0.3 && s.refused >= 2 ? 'neg' : ''}`}>{s.refused} ({fmtNum(s.refusalRate * 100)} %)</strong></div>
          <div><span className="small muted">Lieu habituel</span><strong>{get<Zone>('zones', c.zoneId || '')?.name || '—'}{c.place ? ` — ${c.place}` : ''}</strong></div>
        </div>
        {c.notes && <p className="small">{c.notes}</p>}
      </div>
      <div className="card card-flush">
        <div className="card-pad"><h2>Commandes</h2></div>
        {s.mine.length === 0 ? <Empty icon="list" title="Aucune commande" /> : <ul className="list">{[...s.mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => <OrderRow key={o.id} o={o} />)}</ul>}
      </div>
      {edit && <CustomerForm customer={c} zones={zones} onClose={() => setEdit(false)} />}
      {newOrder && <OrderForm onClose={() => setNewOrder(false)} onSaved={(o) => navigate('/commandes/' + o.id)} />}
    </>
  );
}

function CustomerForm({ customer, zones, onClose }: { customer: Customer; zones: Zone[]; onClose: () => void }) {
  const [name, setName] = useState(customer.name ?? '');
  const [phone, setPhone] = useState(customer.phone);
  const [phone2, setPhone2] = useState(customer.phone2 ?? '');
  const [facebook, setFacebook] = useState(customer.facebook ?? '');
  const [zoneId, setZoneId] = useState(customer.zoneId ?? '');
  const [place, setPlace] = useState(customer.place ?? '');
  const [notes, setNotes] = useState(customer.notes ?? '');
  return (
    <Modal title="Modifier le client" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={normPhone(phone).length < 9} onClick={async () => {
        await save('customers', { id: customer.id, name: name.trim() || undefined, phone: normPhone(phone), phone2: phone2 ? normPhone(phone2) : undefined, facebook: facebook.trim() || undefined, zoneId: zoneId || undefined, place: place.trim() || undefined, notes: notes.trim() || undefined });
        toast('Client enregistré'); onClose();
      }}>Enregistrer</Button></>}>
      <div className="stack">
        <TextField label="Nom" value={name} onChange={setName} />
        <TextField label="Téléphone" value={phone} onChange={setPhone} type="tel" />
        <TextField label="Autre téléphone" value={phone2} onChange={setPhone2} type="tel" />
        <TextField label="Nom ou lien Facebook" value={facebook} onChange={setFacebook} />
        <SelectField label="Zone habituelle" value={zoneId} onChange={setZoneId} options={[{ value: '', label: '—' }, ...zones.map((z) => ({ value: z.id, label: z.name }))]} />
        <TextField label="Lieu habituel" value={place} onChange={setPlace} />
        <TextField label="Notes" value={notes} onChange={setNotes} />
      </div>
    </Modal>
  );
}
