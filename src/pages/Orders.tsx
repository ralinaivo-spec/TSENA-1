// Commandes clients : saisie (comme le cahier), préparation, remise au livreur, retour, échanges.
import { useMyScope } from '../lib/scope';
import { ScopeBar } from '../ui/scope';
import { useMemo, useState } from 'react';
import { audit, currentUser, useCan } from '../lib/auth';
import { bizNow, get, newId, save, useTable } from '../lib/db';
import { fmtAr, fmtNum, nextNumber, parseNum, productVariants, useCatalog, variantLabel, type Product, type Variant , photoOf } from '../lib/catalog';
import {
  addPayment, availableOf, backToPrepare, cancelOrder, CHANNELS, completeAtShop, confirmOrder, dispatchOrder, exchangeBalance, findCustomer, fmtPhone,
  canReassign, customerIdFor, choiceQty, hasPendingChoice, reassignCourier, isOutsideHours, isPickupZone, isWalkIn, orderLabel, handOverAtShop, itemsTotal, keptTotal, linePrice, markReady, normPhone, ORDER_STATUS, orderTotal, paidTotal, PAY_METHODS, recordReturn, remaining,
  repriceLines, reservedIndex, totalQty, useWholesale, editPayment, courierSplit,
  type Courier, type Customer, type Order, type OrderLine, type OrderStatus, type PayMethod, type Payment, type Zone,
} from '../lib/orders';
import { useCompany } from '../lib/settings';
import { Badge, Button, Confirm, Empty, IconButton, Modal, PageHead, SelectField, TextField, fmtDate, fmtDateTime, navigate, toast, useRoute } from '../ui/kit';
import { Icon } from '../ui/icons';
import { PeriodPicker, defaultPeriod, inPeriod, type Period } from '../ui/period';
import { Thumb } from './Products';
import { deliveryNoteDoc, ticketDoc } from '../lib/print';
import { PrintButton, type DocChoice } from '../ui/print';

const TABS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: 'confirmer', label: 'À confirmer', statuses: ['new'] },
  { key: 'preparer', label: 'À préparer', statuses: ['confirmed'] },
  { key: 'pretes', label: 'Prêtes', statuses: ['ready'] },
  { key: 'livraison', label: 'En livraison', statuses: ['out'] },
  { key: 'terminees', label: 'Terminées', statuses: ['delivered', 'partial', 'refused'] },
  { key: 'annulees', label: 'Annulées', statuses: ['cancelled'] },
];

export function OrdersPage() {
  const route = useRoute();
  const seg = route.split('/')[2]?.split('?')[0];
  if (seg && !TABS.some((t) => t.key === seg)) return <OrderDetail id={seg} />;
  return <OrderList tabKey={seg} />;
}

export function OrderStatusBadge({ o }: { o: Order }) {
  const st = ORDER_STATUS[o.status];
  return <>
    <Badge tone={st.tone}>{o.kind === 'exchange' ? `Échange · ${st.label}` : st.label}</Badge>
    {hasPendingChoice(o) && <Badge tone="danger">Choix à préciser ({choiceQty(o)})</Badge>}
  </>;
}

function OrderList({ tabKey }: { tabKey?: string }) {
  const can = useCan();
  const orders = useTable<Order>('orders');
  useTable<Zone>('zones');
  useTable<Courier>('couriers');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [period, setPeriod] = useState<Period>(defaultPeriod('30d'));
  const scope = useMyScope();
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS.find((t) => orders.some((o) => !isWalkIn(o) && t.statuses.includes(o.status) && !['delivered', 'partial', 'refused', 'cancelled'].includes(o.status))) ?? TABS[0];
  const done = ['terminees', 'annulees'].includes(tab.key);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase(); const np = normPhone(q);
    return orders
      .filter((o) => !isWalkIn(o) && scope.mine(o))
      .filter((o) => (n ? true : tab.statuses.includes(o.status)))
      .filter((o) => !done || n || inPeriod(o.createdAt, period))
      .filter((o) => !n || o.number.toLowerCase().includes(n) || (o.name || '').toLowerCase().includes(n) || (np.length >= 3 && normPhone(o.phone).includes(np)) || (o.place || '').toLowerCase().includes(n))
      .sort((a, b) => (done ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
  }, [orders, tab.key, q, period, scope.on]);

  return (
    <>
      <PageHead title="Commandes" subtitle="Commandes Facebook, téléphone et autres, jusqu’à la livraison."
        actions={can('orders.create') && <Button icon="plus" onClick={() => setCreating(true)}>Nouvelle commande</Button>} />
      <ScopeBar scope={scope} mineLabel="Mes commandes" text="Vous voyez les commandes que vous avez enregistrées. Les livraisons du jour restent visibles par tous dans Livraisons." />
      <div className="tabs" role="tablist">
        {TABS.map((t) => {
          const n = orders.filter((o) => !isWalkIn(o) && scope.mine(o) && t.statuses.includes(o.status)).length;
          return <button key={t.key} role="tab" aria-selected={tab.key === t.key} onClick={() => navigate('/commandes/' + t.key)}>{t.label}{!['terminees', 'annulees'].includes(t.key) && n ? <span className="tab-count">{n}</span> : null}</button>;
        })}
      </div>
      <div className="card stack">
        <div className="field"><input aria-label="Rechercher" placeholder="Rechercher un téléphone, un nom, un n° de commande, un lieu…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {done && !q && <PeriodPicker value={period} onChange={setPeriod} />}
      </div>
      <div className="card card-flush">
        {list.length === 0 ? <Empty icon="list" title={q ? 'Aucune commande trouvée' : 'Aucune commande ici'}>{tab.key === 'confirmer' && can('orders.create') && !q && <Button icon="plus" onClick={() => setCreating(true)}>Saisir une commande</Button>}</Empty> : (
          <ul className="list">{list.map((o) => <OrderRow key={o.id} o={o} />)}</ul>
        )}
      </div>
      {creating && <OrderForm onClose={() => setCreating(false)} onSaved={(o) => navigate('/commandes/' + o.id)} />}
    </>
  );
}

export function OrderRow({ o }: { o: Order }) {
  const zone = get<Zone>('zones', o.zoneId || '');
  const courier = get<Courier>('couriers', o.courierId || '');
  const firstV = o.lines[0] && get<Variant>('variants', o.lines[0].variantId);
  const firstP = firstV && get<Product>('products', firstV.productId);
  const rest = remaining(o);
  return (
    <li>
      <a className="list-item list-link" href={`#/commandes/${o.id}`}>
        <Thumb src={firstP?.photo} />
        <div className="list-item-main">
          <div className="row" style={{ gap: 8 }}>
            <span className="list-item-title">{orderLabel(o)}</span>
            <OrderStatusBadge o={o} />
            {o.outsideHours && ['new', 'confirmed'].includes(o.status) && <Badge>Hors heures</Badge>}
            {isPickupZone(o.zoneId) && !['delivered', 'partial', 'refused', 'cancelled'].includes(o.status) && <Badge>Sur boutique</Badge>}
          </div>
          <p className="small muted">{o.number}{o.phone ? ` · ${fmtPhone(o.phone)}` : ''} · {zone?.name || 'Zone ?'}{o.place ? ` — ${o.place}` : ''}</p>
          <p className="small muted">{fmtNum(totalQty(o))} article(s){o.lines.some((l) => l.isChoice) ? ` + ${o.lines.filter((l) => l.isChoice).reduce((s, l) => s + l.qty, 0)} en choix` : ''}{courier ? ` · ${courier.name}` : ''} · {fmtDateTime(o.createdAt)}</p>
        </div>
        <div className="list-item-side">
          <strong className="num">{fmtAr(o.kind === 'exchange' ? exchangeBalance(o) : orderTotal(o))}</strong>
          {paidTotal(o) > 0 && <span className="small muted">payé {fmtAr(paidTotal(o))}</span>}
          {rest > 0 && !['cancelled', 'refused'].includes(o.status) && <span className="small">reste {fmtAr(rest)}</span>}
        </div>
      </a>
    </li>
  );
}

// ---------- Saisie d'une commande ----------
export function OrderForm({ order, exchangeOf, onClose, onSaved }: { order?: Order; exchangeOf?: { parent: Order; returnLines: { variantId: string; qty: number; unitPrice: number }[] }; onClose: () => void; onSaved?: (o: Order) => void }) {
  const company = useCompany();
  const zones = useTable<Zone>('zones').filter((z) => z.active !== false).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
  useCatalog();
  const base = exchangeOf?.parent;
  const [phone, setPhone] = useState(order?.phone ?? base?.phone ?? '');
  const [name, setName] = useState(order?.name ?? base?.name ?? '');
  const [channel, setChannel] = useState<Order['channel']>(order?.channel ?? base?.channel ?? 'facebook');
  const [zoneId, setZoneId] = useState(order?.zoneId ?? base?.zoneId ?? '');
  const [place, setPlace] = useState(order?.place ?? base?.place ?? '');
  const couriers = useTable<Courier>('couriers').filter((c) => c.active !== false);
  const [courierId, setCourierId] = useState(order?.courierId ?? '');
  const [newCourier, setNewCourier] = useState('');
  const [fee, setFee] = useState(String(order?.deliveryFee ?? (base ? get<Zone>('zones', base.zoneId || '')?.fee ?? '' : '')));
  const [wantedDate, setWantedDate] = useState(order?.wantedDate ?? '');
  const [lines, setLines] = useState<OrderLine[]>(order?.lines ?? []);
  const [wholesale, setWholesale] = useState<Order['wholesale']>(order?.wholesale ?? 'auto');
  const [discount, setDiscount] = useState(order?.discount ? String(order.discount) : '');
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [prepay, setPrepay] = useState('');
  const [prepayMethod, setPrepayMethod] = useState<PayMethod>('mvola');
  const [prepayRef, setPrepayRef] = useState('');
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const known = useMemo(() => findCustomer(phone), [phone]);
  const minQty = company.wholesaleMinQty ?? 3;
  const isGros = useWholesale({ lines, wholesale }, minQty);
  const priced = repriceLines(lines, isGros);
  const draft = { lines: priced, discount: parseNum(discount) || 0, deliveryFee: parseNum(fee) || 0, payments: [], status: 'new', kind: exchangeOf ? 'exchange' : 'order', credit: exchangeOf ? exchangeOf.returnLines.reduce((s, r) => s + r.qty * r.unitPrice, 0) : 0 } as unknown as Order;
  const total = exchangeOf ? exchangeBalance(draft) : orderTotal(draft);

  function onPhone(v: string) {
    setPhone(v);
    const c = findCustomer(v);
    if (c && !order) {
      if (!name) setName(c.name || '');
      if (!zoneId && c.zoneId) { setZoneId(c.zoneId); setFee(String(get<Zone>('zones', c.zoneId)?.fee ?? '')); }
      if (!place && c.place) setPlace(c.place);
    }
  }
  const pickup = isPickupZone(zoneId);
  const walkIn = false;
  function onChannel(v: string) {
    setChannel(v as Order['channel']);
    if (v === 'shop') {
      const z = zones.find((x) => isPickupZone(x));
      if (z) { setZoneId(z.id); setFee('0'); }
    }
  }
  function onZone(id: string) {
    setZoneId(id);
    const z = get<Zone>('zones', id);
    if (z) setFee(isPickupZone(z) ? '0' : String(z.fee));
    if (!courierId && z && !isPickupZone(z)) { const c = couriers.find((x) => x.zoneIds?.includes(z.id)); if (c) setCourierId(c.id); }
  }

  async function submit() {
    setError(null);
    const p = normPhone(phone);
    if (!walkIn && p.length < 9) return setError('Le contact du client est obligatoire (numéro de téléphone).');
    if (walkIn && phone.trim() && p.length < 9) return setError('Numéro de téléphone incomplet (ou laissez-le vide).');
    if (!zoneId) return setError('Le lieu de livraison est obligatoire : choisissez une zone (ou « Sur boutique »).');
    if (!pickup) {
      if (!place.trim()) return setError('Indiquez le lieu précis de livraison.');
      if (!((parseNum(fee) ?? 0) > 0)) return setError('Les frais de livraison sont obligatoires pour une livraison.');
      if (!courierId || (courierId === '__new' && !newCourier.trim())) return setError('Choisissez le livreur de cette commande.');
    }
    if (!priced.length && !exchangeOf) return setError('Ajoutez au moins un article.');
    if (priced.some((l) => l.qty <= 0)) return setError('Chaque article doit avoir une quantité.');
    setBusy(true);
    try {
      // Fiche client : créée ou complétée automatiquement.
      let cid = courierId;
      if (!pickup && cid === '__new') { const [c] = await save('couriers', { name: newCourier.trim(), active: true }); cid = c.id; }
      let cust = p ? findCustomer(p) : undefined;
      if (p && !cust) { const [c] = await save('customers', { id: customerIdFor(p), phone: p, name: name.trim() || undefined, zoneId: zoneId || undefined, place: place.trim() || undefined }); cust = c as Customer; }
      else if (cust) await save('customers', { id: cust.id, name: cust.name || name.trim() || undefined, zoneId: zoneId || cust.zoneId, place: place.trim() || cust.place });
      const data: Partial<Order> = {
        phone: p, name: name.trim() || undefined, channel, customerId: cust?.id, zoneId: zoneId || undefined, place: pickup ? (place.trim() || undefined) : place.trim(), placeToConfirm: false,
        courierId: pickup ? undefined : cid, deliveryFee: pickup ? 0 : parseNum(fee) || 0, wantedDate: wantedDate || undefined, lines: priced, wholesale, discount: parseNum(discount) || 0, notes: notes.trim() || undefined,
      };
      if (order) {
        await save('orders', { id: order.id, ...data });
        await audit('Commande modifiée', order.number, 'orders', order.id);
        toast('Commande enregistrée'); onClose();
      } else {
        const u = currentUser();
        const now = new Date(bizNow());
        const payments = parseNum(prepay) ? [{ id: newId(), at: now.toISOString(), amount: parseNum(prepay)!, method: prepayMethod, ref: prepayRef.trim() || undefined, receivedBy: 'shop' as const, userName: u?.fullName }] : [];
        const [o] = await save('orders', {
          ...data, number: nextNumber(exchangeOf ? 'ECH' : 'C', 'orders'), kind: exchangeOf ? 'exchange' : 'order', parentId: exchangeOf?.parent.id,
          returnLines: exchangeOf?.returnLines, credit: draft.credit || undefined, payments, status: 'new', statusDates: { new: now.toISOString() },
          outsideHours: isOutsideHours(now, company), createdBy: u?.id, createdByName: u?.fullName,
        });
        await audit(exchangeOf ? 'Échange créé' : 'Commande créée', `${(o as Order).number} — ${fmtPhone(p)} — ${fmtAr(total)}`, 'orders', o.id);
        toast(`Commande ${(o as Order).number} enregistrée`); onClose(); onSaved?.(o as Order);
      }
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  const setLine = (id: string, patch: Partial<OrderLine>) => setLines(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <Modal title={order ? `Modifier ${order.number}` : exchangeOf ? `Échange — ${exchangeOf.parent.number}` : 'Nouvelle commande'} onClose={onClose} wide
      footer={<><span className="small" style={{ marginRight: 'auto' }}>{exchangeOf ? (total >= 0 ? 'Le client paie ' : 'À rendre au client ') : 'Total à payer '}<strong className="num">{fmtAr(Math.abs(total))}</strong></span><Button variant="ghost" onClick={onClose}>Annuler</Button><Button busy={busy} onClick={submit}>{order ? 'Enregistrer' : 'Enregistrer la commande'}</Button></>}>
      <div className="stack">
        <div className="grid-2">
          <SelectField label="Commande reçue par" value={channel} onChange={onChannel} options={Object.entries(CHANNELS).filter(([k]) => k !== 'shop').map(([value, label]) => ({ value, label }))} />
          <div />
          <div className="stack-s">
            <TextField label={walkIn ? 'Contact du client (facultatif)' : 'Contact du client (obligatoire)'} value={phone} onChange={onPhone} type="tel" inputMode="tel" autoFocus={!order} placeholder="034 00 000 00" />
            {known && !order && <p className="small"><Icon name="check" size={14} /> Client connu : <strong>{known.name || fmtPhone(known.phone)}</strong>{known.place ? ` · ${known.place}` : ''}</p>}
          </div>
          <TextField label="Nom du client (facultatif)" value={name} onChange={setName} />
          <SelectField label="Zone de livraison" value={zoneId} onChange={onZone} options={[{ value: '', label: '— Choisir —' }, ...zones.map((z) => ({ value: z.id, label: `${z.name} (${fmtAr(z.fee)})` }))]} />
          <TextField label={pickup ? 'Lieu (facultatif)' : 'Lieu précis (obligatoire)'} value={place} onChange={setPlace} placeholder={pickup ? 'Boutique' : 'Ex. Analakely, devant la pharmacie'} />
          <TextField label="Frais de livraison (Ar)" value={pickup ? '0' : fee} onChange={setFee} inputMode="numeric" disabled={pickup} hint={pickup ? 'Retrait en boutique : pas de frais.' : 'Obligatoire. Rempli selon la zone, modifiable.'} />
          {!pickup && <SelectField label="Livreur (obligatoire)" value={courierId} onChange={setCourierId} options={[{ value: '', label: '— Choisir —' }, ...couriers.map((c) => ({ value: c.id, label: c.name })), { value: '__new', label: '+ Nouveau livreur…' }]} />}
          {!pickup && courierId === '__new' && <TextField label="Nom du nouveau livreur" value={newCourier} onChange={setNewCourier} />}
        </div>
        <p className="small muted">Zone manquante ou frais à changer ? <a href="#/parametres/zones" onClick={onClose}>Gérer les zones de livraison</a></p>

        {exchangeOf && (
          <div className="notice"><Icon name="refresh" /><span>Articles repris au client : {exchangeOf.returnLines.map((r) => `${r.qty} × ${variantLabel(get<Variant>('variants', r.variantId))}`).join(', ')} — valeur {fmtAr(draft.credit)} déduite.</span></div>
        )}

        <div className="row-between"><h3>{exchangeOf ? 'Nouveaux articles' : 'Articles'}</h3><Button variant="ghost" icon="plus" onClick={() => setPicking(true)}>Ajouter un article</Button></div>
        {priced.length === 0 ? <Empty icon="store" title="Aucun article" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Article</th><th style={{ width: 90 }}>Qté</th><th style={{ width: 120 }}>Prix (Ar)</th><th className="t-num">Montant</th><th></th></tr></thead>
              <tbody>
                {priced.map((l) => {
                  const v = get<Variant>('variants', l.variantId); const p = v && get<Product>('products', v.productId);
                  return (
                    <tr key={l.id}>
                      <td>
                        <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><Thumb src={photoOf(v)} size={48} zoom alt={p?.name} /><div><strong>{p?.name}</strong><div className="small muted">{p?.code} · {variantLabel(v)}</div></div></div>
                        <label className="small row" style={{ gap: 6, marginTop: 4 }}><input type="checkbox" checked={!!l.isChoice} onChange={(e) => setLine(l.id, { isChoice: e.target.checked })} /> Envoyé en choix (pas encore vendu)</label>
                      </td>
                      <td><input className="cell-input" inputMode="numeric" aria-label="Quantité" value={l.qty || ''} onChange={(e) => setLine(l.id, { qty: parseNum(e.target.value) || 0 })} /></td>
                      <td><input className="cell-input" inputMode="numeric" aria-label="Prix" value={l.unitPrice || ''} onChange={(e) => setLine(l.id, { unitPrice: parseNum(e.target.value) || 0, priceManual: true })} /></td>
                      <td className="t-num">{l.isChoice ? <span className="muted">choix</span> : fmtAr(l.qty * l.unitPrice)}</td>
                      <td className="t-actions"><IconButton icon="x" label="Retirer" onClick={() => setLines(lines.filter((x) => x.id !== l.id))} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="row-between">
          <div className="segmented" role="group" aria-label="Prix de gros">
            {([['auto', `Gros auto (dès ${minQty} pcs)`], ['yes', 'Prix de gros'], ['no', 'Prix détail']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={wholesale === k} onClick={() => setWholesale(k)}>{l}</button>)}
          </div>
          <span className="small">{isGros ? <Badge tone="brand">Prix de gros appliqué</Badge> : <Badge>Prix détail</Badge>}</span>
        </div>

        <div className="grid-2">
          <TextField label="Remise (Ar)" value={discount} onChange={setDiscount} inputMode="numeric" />
          <TextField label="Date de livraison souhaitée" type="date" value={wantedDate} onChange={setWantedDate} />
        </div>
        {!order && (
          <div className="card stack" style={{ background: 'var(--surface-2)' }}>
            <strong className="small">Paiement déjà reçu (facultatif)</strong>
            <p className="small muted">Par défaut, le client paie tout à la livraison. S’il a déjà payé (tout ou une partie) par Mobile Money, indiquez-le : le livreur n’encaissera que le reste.</p>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="chip" onClick={() => setPrepay(String(Math.max(0, total - draft.deliveryFee)))}>Articles payés</button>
              {draft.deliveryFee > 0 && <button type="button" className="chip" onClick={() => setPrepay(String(Math.max(0, total)))}>Tout payé (articles + frais)</button>}
              {prepay && <button type="button" className="chip" onClick={() => setPrepay('')}>Rien payé</button>}
            </div>
            <div className="grid-2">
              <TextField label="Montant (Ar)" value={prepay} onChange={setPrepay} inputMode="numeric" />
              <SelectField label="Moyen" value={prepayMethod} onChange={(v) => setPrepayMethod(v as PayMethod)} options={Object.entries(PAY_METHODS).map(([value, label]) => ({ value, label }))} />
              {prepayMethod !== 'cash' && <TextField label="Référence de la transaction" value={prepayRef} onChange={setPrepayRef} />}
            </div>
          </div>
        )}
        <TextField label="Observations" value={notes} onChange={setNotes} placeholder="Ex. appeler avant de venir, client au bureau jusqu’à 16 h…" />

        <div className="summary-box">
          <div><span>Articles</span><strong className="num">{fmtAr(itemsTotal(draft))}</strong></div>
          {draft.discount > 0 && <div><span>Remise</span><strong className="num">− {fmtAr(draft.discount)}</strong></div>}
          {exchangeOf && <div><span>Articles repris</span><strong className="num">− {fmtAr(draft.credit)}</strong></div>}
          <div><span>Frais de livraison</span><strong className="num">{fmtAr(draft.deliveryFee)}</strong></div>
          <div className="summary-total"><span>{exchangeOf ? (total >= 0 ? 'Le client paie' : 'À rendre au client') : 'Total à payer'}</span><strong className="num">{fmtAr(Math.abs(total))}</strong></div>
          {parseNum(prepay) ? <div><span>Déjà payé</span><strong className="num">− {fmtAr(parseNum(prepay))}</strong></div> : null}
          {parseNum(prepay) ? <div className="summary-total"><span>Reste à payer par le client</span><strong className="num">{fmtAr(Math.max(0, total - (parseNum(prepay) || 0)))}</strong></div> : null}
          {draft.deliveryFee > 0 && !exchangeOf && (() => { const x = courierSplit({ ...draft, payments: parseNum(prepay) ? [{ id: 'x', at: '', amount: parseNum(prepay)!, method: prepayMethod, receivedBy: 'shop' }] : [] } as Order); return (
            <div className="small muted" style={{ display: 'block' }}>Le livreur encaissera <strong>{fmtAr(x.toCollect)}</strong> pour la boutique{x.feeKept ? <> + ses frais {fmtAr(x.feeKept)}</> : null}{x.feeOwed ? <> ; frais {fmtAr(x.feeOwed)} déjà payés, à lui reverser en espèces</> : null}.</div>
          ); })()}
        </div>
        {error && <div className="notice notice-danger"><Icon name="alert" /><span>{error}</span></div>}
      </div>
      {picking && <ItemPicker excludeOrderId={order?.id} onClose={() => setPicking(false)} onAdd={(add) => {
        const merged = [...lines];
        for (const a of add) {
          const ex = merged.find((l) => l.variantId === a.variantId && !!l.isChoice === !!a.isChoice);
          if (ex) ex.qty += a.qty; else merged.push({ id: newId(), variantId: a.variantId, qty: a.qty, isChoice: a.isChoice, unitPrice: linePrice(a.variantId, false) });
        }
        setLines(merged);
      }} />}
    </Modal>
  );
}

/** Choisir des articles : recherche, puis quantité par taille/couleur avec le stock disponible. */
export function ItemPicker({ excludeOrderId, onClose, onAdd, noChoice, initialProduct }: { excludeOrderId?: string; onClose: () => void; onAdd: (a: { variantId: string; qty: number; isChoice?: boolean }[]) => void; noChoice?: boolean; initialProduct?: Product }) {
  const { products } = useCatalog();
  const reserved = useMemo(() => reservedIndex(excludeOrderId), [excludeOrderId]);
  const [q, setQ] = useState('');
  const [prod, setProd] = useState<Product | null>(initialProduct ?? null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState<Record<string, string>>({});
  const scope = useMyScope();
  const n = q.trim().toLowerCase();
  const found = products.filter((p) => p.active !== false && scope.product(p.id) && (!n || `${p.code} ${p.name}`.toLowerCase().includes(n))).sort((a, b) => a.code.localeCompare(b.code, 'fr', { numeric: true })).slice(0, 40);
  const variants = prod ? productVariants(prod.id).filter((v) => v.active !== false) : [];
  const picked = variants.flatMap((v) => [
    ...(parseNum(qty[v.id] ?? '') ? [{ variantId: v.id, qty: parseNum(qty[v.id])! }] : []),
    ...(parseNum(choice[v.id] ?? '') ? [{ variantId: v.id, qty: parseNum(choice[v.id])!, isChoice: true }] : []),
  ]);
  return (
    <Modal title={prod ? prod.name : 'Ajouter un article'} onClose={onClose} wide
      footer={prod ? <><Button variant="ghost" onClick={() => { setProd(null); setQty({}); setChoice({}); }}>Autre article</Button><Button disabled={!picked.length} onClick={() => { onAdd(picked); onClose(); }}>Ajouter</Button></> : undefined}>
      {!prod ? (
        <div className="stack">
          <ScopeBar scope={scope} />
          <div className="field"><input autoFocus aria-label="Rechercher un article" placeholder="Rechercher un code ou un nom" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <ul className="list card" style={{ padding: 0 }}>
            {found.map((p) => {
              const avail = productVariants(p.id).reduce((s, v) => s + Math.max(0, availableOf(v.id, reserved)), 0);
              return (
                <li key={p.id}><button className="list-item list-link btn-reset" onClick={() => setProd(p)}>
                  <Thumb src={p.photo} size={72} zoom alt={p.name} />
                  <div className="list-item-main"><span className="list-item-title">{p.name}</span><p className="small muted">{p.code} · {fmtAr(p.priceRetail)}{p.priceWholesale ? ` · gros ${fmtAr(p.priceWholesale)}` : ''}</p></div>
                  <span className={`stock-pill ${avail <= 0 ? 'is-out' : ''}`}>{avail}</span>
                </button></li>
              );
            })}
            {!found.length && <Empty icon="search" title="Aucun article trouvé" />}
          </ul>
        </div>
      ) : (
        <div className="stack">
          <div className="row" style={{ gap: 12 }}><Thumb src={prod.photo} size={120} zoom alt={prod.name} /><div><strong>{prod.code}</strong> {prod.name}<p className="small muted">{fmtAr(prod.priceRetail)}{prod.priceWholesale ? ` · gros ${fmtAr(prod.priceWholesale)}` : ''}</p></div></div>
          {!noChoice && <p className="small muted">« Vendu » : ce que le client achète. « En choix » : les tailles ou couleurs envoyées en plus pour qu’il choisisse sur place.</p>}
          <div className="variant-grid">
            {variants.map((v) => {
              const a = availableOf(v.id, reserved);
              return (
                <div key={v.id} className={`variant-cell ${a <= 0 ? 'is-out' : ''}`}>
                  {variants.some((x) => x.photo) && <Thumb src={photoOf(v)} size={84} zoom alt={`${prod.code} ${variantLabel(v)}`} />}
                  <span className="small"><strong>{variantLabel(v)}</strong> · <span className={a <= 0 ? 'neg' : 'muted'}>{a > 0 ? `${a} dispo` : 'épuisé'}</span></span>
                  <label className="small">{noChoice ? 'Quantité' : 'Vendu'}<input className="cell-input" inputMode="numeric" placeholder="0" value={qty[v.id] ?? ''} onChange={(e) => setQty({ ...qty, [v.id]: e.target.value })} /></label>
                  {!noChoice && <label className="small">En choix<input className="cell-input" inputMode="numeric" placeholder="0" value={choice[v.id] ?? ''} onChange={(e) => setChoice({ ...choice, [v.id]: e.target.value })} /></label>}
                </div>
              );
            })}
          </div>
          {picked.some((p) => availableOf(p.variantId, reserved) < p.qty) && <div className="notice"><Icon name="alert" /><span>Attention : certaines quantités dépassent le stock disponible.</span></div>}
        </div>
      )}
    </Modal>
  );
}

// ---------- Détail d'une commande ----------
/** Documents imprimables d'une commande : ticket, et bon de livraison si elle part avec un livreur. */
function printDocs(o: Order, company: ReturnType<typeof useCompany>): DocChoice[] {
  const d: DocChoice[] = [{ key: 'ticket', label: isWalkIn(o) ? 'Ticket de caisse' : 'Ticket client', build: () => ticketDoc(o, company) }];
  if (!isWalkIn(o) && !isPickupZone(o.zoneId)) d.unshift({ key: 'bon', label: 'Bon de livraison', build: () => deliveryNoteDoc(o, company) });
  return d;
}

function OrderDetail({ id }: { id: string }) {
  const can = useCan();
  const company = useCompany();
  useCatalog();
  const orders = useTable<Order>('orders');
  const couriers = useTable<Courier>('couriers');
  useTable<Zone>('zones');
  const o = orders.find((x) => x.id === id);
  const [editPay, setEditPay] = useState<Payment | null>(null);
  const [modal, setModal] = useState<'' | 'edit' | 'dispatch' | 'return' | 'pay' | 'cancel' | 'exchange' | 'shop' | 'pickup' | 'reassign'>('');
  if (!o) return <Empty icon="list" title="Commande introuvable"><Button variant="ghost" onClick={() => navigate('/commandes')}>Retour</Button></Empty>;
  const zone = get<Zone>('zones', o.zoneId || '');
  const courier = couriers.find((c) => c.id === o.courierId);
  const closed = ['delivered', 'partial', 'refused'].includes(o.status);
  const due = o.kind === 'exchange' ? exchangeBalance(o) : orderTotal(o);
  const rest = due - paidTotal(o);
  const parent = o.parentId ? orders.find((x) => x.id === o.parentId) : undefined;
  const children = orders.filter((x) => x.parentId === o.id);
  const act = (fn: () => Promise<void>, msg: string) => async () => { await fn(); toast(msg); };

  return (
    <>
      <div className="row"><Button variant="quiet" icon="chevronRight" className="back-btn" onClick={() => history.back()}>Commandes</Button></div>
      <div className="card stack">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div className="stack-s">
            <div className="row" style={{ gap: 8 }}><h1 style={{ fontSize: '1.6rem' }}>{o.number}</h1><OrderStatusBadge o={o} />{o.outsideHours && <Badge>Reçue hors heures</Badge>}</div>
            <p className="muted">{o.internal ? `Vente interne — employé : ${o.employeeName || '?'} (prix de revient arrondi)` : CHANNELS[o.channel]} · {fmtDateTime(o.createdAt)}{o.createdByName ? ` · par ${o.createdByName}` : ''}</p>
          </div>
          <div className="page-actions">
            <PrintButton docs={printDocs(o, company)} />
            {can('orders.create') && ['new', 'confirmed', 'ready'].includes(o.status) && <Button variant="ghost" icon="edit" onClick={() => setModal('edit')}>Modifier</Button>}
          </div>
        </div>
        <div className="kv-row">
          <div><span className="small muted">Client</span><strong>{orderLabel(o)}</strong></div>
          {o.phone && <div><span className="small muted">Contact</span><a href={`tel:${o.phone}`}><strong>{fmtPhone(o.phone)}</strong></a></div>}
          <div><span className="small muted">Livraison</span><strong>{zone?.name || '—'}{o.place && !isPickupZone(zone) ? ` — ${o.place}` : ''}</strong></div>
          {o.wantedDate && <div><span className="small muted">Souhaitée le</span><strong>{fmtDate(o.wantedDate)}</strong></div>}
          {courier && <div><span className="small muted">Livreur</span><strong>{courier.name}</strong>{canReassign(o) && can('orders.dispatch') && <button className="link-btn" onClick={() => setModal('reassign')}>Changer</button>}</div>}
        </div>
        {o.notes && <p className="small" style={{ whiteSpace: 'pre-line' }}><strong>Observations :</strong> {o.notes}</p>}
        {parent && <p className="small">Échange de la commande <a href={`#/commandes/${parent.id}`}>{parent.number}</a></p>}
        {children.map((c) => <p key={c.id} className="small">Échange lié : <a href={`#/commandes/${c.id}`}>{c.number}</a> ({ORDER_STATUS[c.status].label})</p>)}
        {hasPendingChoice(o) && <div className="notice notice-danger"><Icon name="alert" /><span style={{ flex: 1 }}><strong>Choix du client à préciser</strong> : {choiceQty(o)} pièce(s) sont parties en choix. Dès que le livreur revient, touchez « Préciser le choix du client » et indiquez ce que le client a gardé. Tant que ce n’est pas fait, le versement du livreur pour cette livraison est bloqué.</span></div>}

        <div className="action-bar">
          {o.status === 'new' && can('orders.prepare') && <Button icon="check" onClick={act(async () => { await confirmOrder(o); }, 'Commande confirmée')}>Confirmer (client joint)</Button>}
          {o.status === 'confirmed' && can('orders.prepare') && <Button icon="package" onClick={act(async () => { await markReady(o); }, 'Commande prête')}>Commande préparée</Button>}
          {o.status === 'ready' && !isPickupZone(o.zoneId) && can('orders.dispatch') && <Button icon="truck" onClick={() => setModal('dispatch')}>Remettre au livreur</Button>}
          {(o.status === 'ready' || (isWalkIn(o) && ['new', 'confirmed'].includes(o.status))) && isPickupZone(o.zoneId) && can('orders.create') && <Button icon="store" onClick={() => setModal('pickup')}>Remis au client en boutique</Button>}
          {o.status === 'ready' && can('orders.prepare') && <Button variant="ghost" onClick={act(async () => { await backToPrepare(o); }, 'Remise en préparation')}>Revenir à « à préparer »</Button>}
          {o.status === 'out' && can('deliveries.manage') && <Button icon="inbox" onClick={() => setModal('return')}>{hasPendingChoice(o) ? 'Préciser le choix du client' : 'Enregistrer le retour du livreur'}</Button>}
          {o.kind === 'exchange' && ['new', 'confirmed', 'ready'].includes(o.status) && can('returns.manage') && <Button variant="ghost" onClick={() => setModal('shop')}>Échange fait en boutique</Button>}
          {((!closed && o.status !== 'cancelled') || rest !== 0) && o.status !== 'cancelled' && can('orders.create') && <Button variant="ghost" icon="plus" onClick={() => setModal('pay')}>{rest < 0 ? 'Rendre l’argent au client' : 'Paiement reçu'}</Button>}
          {closed && o.status !== 'refused' && can('returns.manage') && <Button variant="ghost" icon="refresh" onClick={() => setModal('exchange')}>Retour / échange</Button>}
          {!closed && o.status !== 'cancelled' && can('orders.create') && <Button variant="quiet" onClick={() => setModal('cancel')}>Annuler</Button>}
        </div>
      </div>

      <div className="card card-flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Article</th><th className="t-num">Qté</th>{closed && <th className="t-num">Gardé</th>}<th className="t-num">Prix</th><th className="t-num">Montant</th></tr></thead>
            <tbody>
              {o.lines.map((l) => {
                const v = get<Variant>('variants', l.variantId); const p = v && get<Product>('products', v.productId);
                const q = closed ? (l.qtyKept ?? 0) : l.isChoice ? 0 : l.qty;
                return (
                  <tr key={l.id}>
                    <td><div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><Thumb src={photoOf(v)} size={56} zoom alt={p?.name} /><div><strong>{p?.name}</strong><div className="small muted">{p?.code} · {variantLabel(v)}{l.isChoice ? ' · en choix' : ''}</div></div></div></td>
                    <td className="t-num num">{l.qty}</td>
                    {closed && <td className={`t-num num ${(l.qtyKept ?? 0) < l.qty && !l.isChoice ? 'neg' : ''}`}>{l.qtyKept ?? 0}</td>}
                    <td className="t-num">{fmtAr(l.unitPrice)}</td>
                    <td className="t-num">{q ? fmtAr(q * l.unitPrice) : '—'}</td>
                  </tr>
                );
              })}
              {(o.returnLines || []).map((r, i) => {
                const v = get<Variant>('variants', r.variantId); const p = v && get<Product>('products', v.productId);
                return <tr key={'r' + i}><td><span className="small">↩ Repris : <strong>{p?.name}</strong> {variantLabel(v)}</span></td><td className="t-num num">{r.qty}</td>{closed && <td></td>}<td className="t-num">{fmtAr(r.unitPrice)}</td><td className="t-num">− {fmtAr(r.qty * r.unitPrice)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="summary-box" style={{ margin: 16 }}>
          <div><span>Articles</span><strong className="num">{fmtAr(closed ? keptTotal(o) : itemsTotal(o))}</strong></div>
          {o.discount > 0 && <div><span>Remise</span><strong className="num">− {fmtAr(o.discount)}</strong></div>}
          {o.credit ? <div><span>Articles repris</span><strong className="num">− {fmtAr(o.credit)}</strong></div> : null}
          <div><span>Frais de livraison{closed && o.feeCharged !== o.deliveryFee ? ` (prévu ${fmtAr(o.deliveryFee)})` : ''}</span><strong className="num">{fmtAr(closed ? o.feeCharged ?? 0 : o.deliveryFee)}</strong></div>
          <div className="summary-total"><span>{o.kind === 'exchange' && due < 0 ? 'À rendre au client' : 'Total'}</span><strong className="num">{fmtAr(Math.abs(due))}</strong></div>
          <div><span>Payé</span><strong className="num">{fmtAr(paidTotal(o))}</strong></div>
          {o.status !== 'cancelled' && <div className="summary-total"><span>{rest >= 0 ? 'Reste à encaisser' : 'Trop perçu / à rendre'}</span><strong className={`num ${rest > 0 ? '' : rest < 0 ? 'neg' : 'pos'}`}>{fmtAr(Math.abs(rest))}</strong></div>}
          {!isWalkIn(o) && !isPickupZone(o.zoneId) && !['cancelled', 'delivered', 'partial', 'refused'].includes(o.status) && (() => { const x = courierSplit(o); return (
            <p className="small muted" style={{ margin: 0 }}>Le livreur encaisse <strong>{fmtAr(x.toCollect)}</strong> pour la boutique{x.feeKept ? ` + ses frais ${fmtAr(x.feeKept)}` : ''}{x.feeOwed ? ` ; frais ${fmtAr(x.feeOwed)} déjà payés : à lui reverser` : ''}.</p>
          ); })()}
        </div>
      </div>

      {(o.payments || []).length > 0 && (
        <div className="card stack-s">
          <h2>Paiements</h2>
          <ul className="list">
            {o.payments.map((p) => (
              <li key={p.id} className="list-item" style={{ padding: '10px 0' }}>
                <div className="list-item-main"><strong className="num">{fmtAr(p.amount)}</strong> · {PAY_METHODS[p.method]}{p.ref ? ` · réf. ${p.ref}` : ''}
                  <p className="small muted">{fmtDateTime(p.at)} · {p.receivedBy === 'shop' ? 'reçu par la boutique' : `encaissé par ${get<Courier>('couriers', p.courierId || '')?.name || 'le livreur'}`}{p.userName ? ` · saisi par ${p.userName}` : ''}</p>
                  {(p.edits || []).map((e, i) => <p key={i} className="small" style={{ color: 'var(--warn, #9a6700)' }}>Corrigé le {fmtDateTime(e.at)} par {e.user || '—'} : {fmtAr(e.fromAmount)}{e.fromMethod !== e.toMethod ? ` (${PAY_METHODS[e.fromMethod]})` : ''} → {fmtAr(e.toAmount)}{e.fromMethod !== e.toMethod ? ` (${PAY_METHODS[e.toMethod]})` : ''}{e.reason ? ` — ${e.reason}` : ''}</p>)}
                </div>
                {can('users.manage') && <IconButton icon="edit" label="Corriger ce paiement" onClick={() => setEditPay(p)} />}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card stack-s">
        <h2>Historique</h2>
        <ul className="timeline">
          {[
            ...(Object.entries(o.statusDates || {}) as [OrderStatus, string][]).map(([s, at]) => ({ at, text: ORDER_STATUS[s].label, user: '' })),
            ...(o.events || []),
          ].sort((a, b) => a.at.localeCompare(b.at)).map((e, i) => <li key={i}><strong>{e.text}</strong> <span className="small muted">{fmtDateTime(e.at)}{e.user ? ` · ${e.user}` : ''}</span></li>)}
        </ul>
      </div>

      {modal === 'edit' && <OrderForm order={o} onClose={() => setModal('')} />}
      {modal === 'dispatch' && <DispatchModal orders={[o]} onClose={() => setModal('')} />}
      {modal === 'return' && <ReturnModal order={o} onClose={() => setModal('')} />}
      {modal === 'pay' && <PayModal order={o} onClose={() => setModal('')} />}
      {modal === 'exchange' && <ExchangeStart order={o} onClose={() => setModal('')} />}
      {modal === 'shop' && <ShopExchangeModal order={o} onClose={() => setModal('')} />}
      {modal === 'pickup' && <PickupModal order={o} onClose={() => setModal('')} />}
      {modal === 'reassign' && <ReassignModal order={o} onClose={() => setModal('')} />}
      {editPay && <EditPaymentModal order={o} payment={editPay} onClose={() => setEditPay(null)} />}
      {modal === 'cancel' && <CancelModal order={o} onClose={() => setModal('')} />}
    </>
  );
}

export function DispatchModal({ orders, onClose }: { orders: Order[]; onClose: () => void }) {
  const couriers = useTable<Courier>('couriers').filter((c) => c.active !== false);
  const zoneIds = new Set(orders.map((o) => o.zoneId));
  const preset = orders.every((o) => o.courierId && o.courierId === orders[0].courierId) ? orders[0].courierId : undefined;
  const suggested = couriers.find((c) => c.id === preset) ?? couriers.find((c) => c.zoneIds?.some((z) => zoneIds.has(z)));
  const [courierId, setCourierId] = useState(suggested?.id ?? couriers[0]?.id ?? '');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={orders.length > 1 ? `Remettre ${orders.length} commandes au livreur` : `Remettre ${orders[0].number} au livreur`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button busy={busy} disabled={!courierId || (courierId === '__new' && !newName.trim())} onClick={async () => {
        setBusy(true);
        let cid = courierId;
        if (cid === '__new') { const [c] = await save('couriers', { name: newName.trim(), active: true }); cid = c.id; }
        for (const o of orders) await dispatchOrder(o, cid);
        toast(`${orders.length} commande(s) remise(s) au livreur`); setBusy(false); onClose();
      }}>Remettre</Button></>}>
      <div className="stack">
        <SelectField label="Livreur" value={courierId} onChange={setCourierId} options={[...couriers.map((c) => ({ value: c.id, label: c.name })), { value: '__new', label: '+ Nouveau livreur…' }]} />
        {courierId === '__new' && <TextField label="Nom du livreur" value={newName} onChange={setNewName} autoFocus />}
        <p className="small muted">Les articles (y compris ceux en choix) sortent du stock de la boutique. Ce qui revient sera remis en stock au retour du livreur.</p>
        <ul className="small">{orders.map((o) => <li key={o.id}>{o.number} — {orderLabel(o)} — à encaisser {fmtAr(Math.max(0, remaining(o)))}</li>)}</ul>
      </div>
    </Modal>
  );
}

export function ReturnModal({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const [kept, setKept] = useState<Record<string, string>>(() => Object.fromEntries(o.lines.map((l) => [l.id, l.isChoice ? '' : String(l.qty)])));
  const hasChoice = o.lines.some((l) => l.isChoice);
  const choiceMissing = o.lines.filter((l) => l.isChoice && (kept[l.id] ?? '').trim() === '');
  const keptNum = Object.fromEntries(o.lines.map((l) => [l.id, Math.max(0, Math.min(l.qty, parseNum(kept[l.id]) ?? 0))]));
  const anyKept = Object.values(keptNum).some((n) => n > 0);
  const [fee, setFee] = useState<string | null>(null);
  const feeVal = fee == null ? (anyKept || (o.kind === 'exchange' && !o.lines.length) ? o.deliveryFee : 0) : parseNum(fee) ?? 0;
  const sim = { ...o, status: 'delivered', lines: o.lines.map((l) => ({ ...l, qtyKept: keptNum[l.id] })), feeCharged: feeVal } as Order;
  const toCollect = Math.max(0, (o.kind === 'exchange' ? exchangeBalance(sim) : orderTotal(sim)) - paidTotal(o));
  const [amount, setAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const amountVal = amount == null ? toCollect : parseNum(amount) ?? 0;
  return (
    <Modal title={hasChoice ? `Préciser le choix du client — ${o.number}` : `Retour du livreur — ${o.number}`} onClose={onClose} wide
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button busy={busy} disabled={choiceMissing.length > 0} onClick={async () => {
        setBusy(true);
        await recordReturn(o, { kept: keptNum, feeCharged: feeVal, collected: [{ amount: amountVal, method, ref: ref.trim() || undefined }], note: note.trim() || undefined });
        toast(hasChoice ? 'Choix du client enregistré' : 'Retour enregistré'); setBusy(false); onClose();
      }}>{choiceMissing.length ? `Indiquez le choix (${choiceMissing.length} ligne(s))` : hasChoice ? 'Valider le choix et le retour' : 'Valider le retour'}</Button></>}>
      <div className="stack">
        {hasChoice && <div className="notice"><Icon name="alert" /><span>Cette livraison contient des articles <strong>en choix</strong>. Pour chaque ligne « choix », indiquez combien de pièces le client a <strong>gardées</strong> (0 s’il les a toutes rendues). Le versement du livreur pour cette livraison n’est possible qu’après cette étape.</span></div>}
        <div className="row">
          <Button variant="ghost" onClick={() => setKept(Object.fromEntries(o.lines.map((l) => [l.id, String(l.isChoice ? 0 : l.qty)])))}>{hasChoice ? 'Tout livré, choix tous rendus' : 'Tout livré'}</Button>
          <Button variant="ghost" onClick={() => setKept(Object.fromEntries(o.lines.map((l) => [l.id, '0'])))}>Tout refusé</Button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Article</th><th className="t-num">Parti</th><th style={{ width: 110 }}>Gardé par le client</th><th className="t-num">Revient en stock</th></tr></thead>
            <tbody>
              {o.lines.map((l) => {
                const v = get<Variant>('variants', l.variantId); const p = v && get<Product>('products', v.productId);
                return (
                  <tr key={l.id} className={l.isChoice ? 'is-choice' : ''}>
                    <td><strong>{p?.code}</strong> {variantLabel(v)} {l.isChoice && <Badge tone="warn">choix</Badge>}<div className="small muted">{fmtAr(l.unitPrice)}</div></td>
                    <td className="t-num num">{l.qty}</td>
                    <td><input className="cell-input" inputMode="numeric" aria-label="Gardé" placeholder={l.isChoice ? 'à préciser' : ''} aria-invalid={l.isChoice && (kept[l.id] ?? '').trim() === ''} value={kept[l.id]} onChange={(e) => setKept({ ...kept, [l.id]: e.target.value })} /></td>
                    <td className="t-num num">{l.qty - keptNum[l.id]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid-2">
          <TextField label="Frais de livraison facturés (Ar)" value={fee ?? String(feeVal)} onChange={setFee} inputMode="numeric" hint={!anyKept ? 'Commande refusée : mettez les frais si le client les a quand même payés.' : 'Ces frais reviennent au livreur.'} />
          <TextField label="Argent encaissé par le livreur (Ar)" value={amount ?? String(amountVal)} onChange={setAmount} inputMode="numeric" hint={`À encaisser selon la commande : ${fmtAr(toCollect)}`} />
          <SelectField label="Moyen de paiement" value={method} onChange={(v) => setMethod(v as PayMethod)} options={Object.entries(PAY_METHODS).map(([value, label]) => ({ value, label }))} />
          {method !== 'cash' && <TextField label="Référence de la transaction" value={ref} onChange={setRef} />}
        </div>
        <TextField label="Remarque (motif de refus, etc.)" value={note} onChange={setNote} placeholder="Ex. taille trop petite, client absent…" />
      </div>
    </Modal>
  );
}

function EditPaymentModal({ order: o, payment: p, onClose }: { order: Order; payment: Payment; onClose: () => void }) {
  const [amount, setAmount] = useState(String(p.amount));
  const [method, setMethod] = useState<PayMethod>(p.method);
  const [reason, setReason] = useState('Erreur de saisie');
  const n = parseNum(amount) ?? NaN;
  return (
    <Modal title={`Corriger un paiement — ${o.number}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={isNaN(n) || (n === p.amount && method === p.method)} onClick={async () => { await editPayment(o, p.id, n, method, reason.trim() || undefined); toast('Paiement corrigé'); onClose(); }}>Enregistrer la correction</Button></>}>
      <div className="stack">
        <p className="small">Montant actuel : <strong>{fmtAr(p.amount)}</strong> ({PAY_METHODS[p.method]}, {p.receivedBy === 'shop' ? 'reçu par la boutique' : 'encaissé par le livreur'}) le {fmtDateTime(p.at)}.</p>
        <div className="grid-2">
          <TextField label="Nouveau montant (Ar)" value={amount} onChange={setAmount} inputMode="numeric" hint="0 pour annuler ce paiement" />
          <SelectField label="Moyen" value={method} onChange={(v) => setMethod(v as PayMethod)} options={Object.entries(PAY_METHODS).map(([value, label]) => ({ value, label }))} />
        </div>
        <TextField label="Motif" value={reason} onChange={setReason} />
        <p className="small muted">L’ancien montant, le nouveau, la date et votre nom restent visibles sous le paiement et dans le journal d’activité. Le reste à payer et le compte du livreur se recalculent tout seuls.</p>
      </div>
    </Modal>
  );
}

function PayModal({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const refund = remaining(o) < 0;
  const [amount, setAmount] = useState(String(Math.abs(remaining(o))));
  const [method, setMethod] = useState<PayMethod>(refund ? 'cash' : 'mvola');
  const [ref, setRef] = useState('');
  const [by, setBy] = useState<'shop' | 'courier'>('shop');
  return (
    <Modal title={refund ? `Argent rendu au client — ${o.number}` : `Paiement reçu — ${o.number}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={!parseNum(amount)} onClick={async () => {
        await addPayment(o, { amount: refund ? -parseNum(amount)! : parseNum(amount)!, method, ref: ref.trim() || undefined, receivedBy: by, courierId: by === 'courier' ? o.courierId : undefined });
        toast(refund ? 'Remboursement enregistré' : 'Paiement enregistré'); onClose();
      }}>Enregistrer</Button></>}>
      <div className="stack">
        {refund && <p className="small">Le client a trop payé (ex. échange contre un article moins cher) : ce montant sort de la caisse ou du compte choisi.</p>}
        <TextField label="Montant (Ar)" value={amount} onChange={setAmount} inputMode="numeric" />
        <SelectField label="Moyen" value={method} onChange={(v) => setMethod(v as PayMethod)} options={Object.entries(PAY_METHODS).map(([value, label]) => ({ value, label }))} />
        {method !== 'cash' && <TextField label="Référence de la transaction" value={ref} onChange={setRef} />}
        {o.courierId && <SelectField label="Reçu par" value={by} onChange={(v) => setBy(v as any)} options={[{ value: 'shop', label: 'La boutique' }, { value: 'courier', label: 'Le livreur' }]} />}
      </div>
    </Modal>
  );
}

function CancelModal({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const [reason, setReason] = useState('Client injoignable');
  return (
    <Confirm title={`Annuler ${o.number}`} danger confirmLabel="Annuler la commande" onClose={onClose}
      message={<div className="stack"><p>{o.status === 'out' ? 'Les articles partis avec le livreur seront remis en stock.' : 'La commande ne réservera plus de stock.'}</p>
        <SelectField label="Motif" value={reason} onChange={setReason} options={['Client injoignable', 'Client a annulé', 'Article indisponible', 'Erreur de saisie', 'Doublon', 'Autre'].map((r) => ({ value: r, label: r }))} /></div>}
      onConfirm={async () => { await cancelOrder(o, reason); toast('Commande annulée'); }} />
  );
}

/** Retour / échange après livraison : choisir ce que le client rend, puis les nouveaux articles. */
function ExchangeStart({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const [ret, setRet] = useState<Record<string, string>>({});
  const [next, setNext] = useState<{ variantId: string; qty: number; unitPrice: number }[] | null>(null);
  const keptLines = o.lines.filter((l) => (l.qtyKept ?? 0) > 0);
  const returnLines = keptLines.map((l) => ({ variantId: l.variantId, qty: Math.min(l.qtyKept ?? 0, parseNum(ret[l.id]) ?? 0), unitPrice: l.unitPrice })).filter((r) => r.qty > 0);
  if (next) return <OrderForm exchangeOf={{ parent: o, returnLines: next }} onClose={onClose} onSaved={(x) => navigate('/commandes/' + x.id)} />;
  return (
    <Modal title={`Retour / échange — ${o.number}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={!returnLines.length} onClick={() => setNext(returnLines)}>Continuer</Button></>}>
      <div className="stack">
        <p className="small muted">Indiquez ce que le client rend. À l’étape suivante, ajoutez les articles qu’il prend à la place (ou aucun pour un simple retour). La différence de prix est calculée automatiquement.</p>
        {keptLines.map((l) => {
          const v = get<Variant>('variants', l.variantId); const p = v && get<Product>('products', v.productId);
          return (
            <div key={l.id} className="row" style={{ flexWrap: 'nowrap' }}>
              <Thumb src={p?.photo} size={40} />
              <div style={{ flex: 1 }}><strong>{p?.code}</strong> {variantLabel(v)}<div className="small muted">acheté {l.qtyKept} × {fmtAr(l.unitPrice)}</div></div>
              <input className="cell-input" style={{ width: 90 }} inputMode="numeric" placeholder="0" aria-label="Quantité rendue" value={ret[l.id] ?? ''} onChange={(e) => setRet({ ...ret, [l.id]: e.target.value })} />
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function ShopExchangeModal({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const bal = exchangeBalance({ ...o, deliveryFee: 0 }) - paidTotal(o);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [ref, setRef] = useState('');
  return (
    <Modal title={`Échange en boutique — ${o.number}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={async () => {
        await completeAtShop(o, bal !== 0 ? { amount: bal, method, ref: ref.trim() || undefined } : undefined);
        toast('Échange terminé'); onClose();
      }}>Valider l’échange</Button></>}>
      <div className="stack">
        <p>Le client est en boutique : les articles repris reviennent en stock, les nouveaux articles sortent, sans frais de livraison.</p>
        <p><strong>{bal > 0 ? `Le client paie ${fmtAr(bal)}` : bal < 0 ? `À rendre au client : ${fmtAr(-bal)}` : 'Aucune différence à payer.'}</strong></p>
        {bal !== 0 && <SelectField label="Moyen" value={method} onChange={(v) => setMethod(v as PayMethod)} options={Object.entries(PAY_METHODS).map(([value, label]) => ({ value, label }))} />}
        {bal !== 0 && method !== 'cash' && <TextField label="Référence" value={ref} onChange={setRef} />}
      </div>
    </Modal>
  );
}

function PickupModal({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const rest = Math.max(0, remaining(o));
  const [amount, setAmount] = useState(String(rest));
  const [method, setMethod] = useState<PayMethod>('cash');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Remis au client — ${o.number}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button busy={busy} onClick={async () => {
        setBusy(true);
        await handOverAtShop(o, parseNum(amount) ? { amount: parseNum(amount)!, method, ref: ref.trim() || undefined } : undefined);
        toast('Commande remise au client'); setBusy(false); onClose();
      }}>Valider</Button></>}>
      <div className="stack">
        <p>Le client est venu chercher sa commande en boutique. Les articles sortent du stock, sans frais de livraison.</p>
        <TextField label="Montant encaissé (Ar)" value={amount} onChange={setAmount} inputMode="numeric" hint={`Reste à payer : ${fmtAr(rest)}`} />
        <SelectField label="Moyen de paiement" value={method} onChange={(v) => setMethod(v as PayMethod)} options={Object.entries(PAY_METHODS).map(([value, label]) => ({ value, label }))} />
        {method !== 'cash' && <TextField label="Référence de la transaction" value={ref} onChange={setRef} />}
      </div>
    </Modal>
  );
}

/** Changer de livreur avant son versement : la commande, ses frais et l'argent encaissé passent au nouveau. */
export function ReassignModal({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const couriers = useTable<Courier>('couriers').filter((c) => c.active !== false && c.id !== o.courierId);
  const current = get<Courier>('couriers', o.courierId || '');
  const [courierId, setCourierId] = useState(couriers.find((c) => c.zoneIds?.includes(o.zoneId || ''))?.id ?? couriers[0]?.id ?? '__new');
  const [newName, setNewName] = useState('');
  const [reason, setReason] = useState('Zone d’un autre livreur');
  const [busy, setBusy] = useState(false);
  const collected = (o.payments || []).filter((p) => p.receivedBy === 'courier' && p.courierId === o.courierId).reduce((s, p) => s + p.amount, 0);
  return (
    <Modal title={`Changer de livreur — ${o.number}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button busy={busy} disabled={courierId === '__new' && !newName.trim()} onClick={async () => {
        setBusy(true);
        try {
          let cid = courierId;
          if (cid === '__new') { const [c] = await save('couriers', { name: newName.trim(), active: true }); cid = c.id; }
          await reassignCourier(o, cid, reason.trim() || undefined);
          toast('Livreur changé'); onClose();
        } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
      }}>Changer de livreur</Button></>}>
      <div className="stack">
        <p>Livreur actuel : <strong>{current?.name ?? '—'}</strong></p>
        <SelectField label="Nouveau livreur" value={courierId} onChange={setCourierId} options={[...couriers.map((c) => ({ value: c.id, label: c.name })), { value: '__new', label: '+ Nouveau livreur…' }]} />
        {courierId === '__new' && <TextField label="Nom du nouveau livreur" value={newName} onChange={setNewName} autoFocus />}
        <SelectField label="Motif" value={reason} onChange={setReason} options={['Zone d’un autre livreur', 'Livreur indisponible', 'Erreur d’attribution', 'Autre'].map((r) => ({ value: r, label: r }))} />
        <div className="notice"><Icon name="refresh" /><span>La commande est retirée du compte de {current?.name ?? 'l’ancien livreur'} et passe au nouveau{['delivered', 'partial', 'refused'].includes(o.status) ? `, avec ses frais (${fmtAr(o.feeCharged ?? 0)})` : ''}{collected ? ` et l’argent encaissé (${fmtAr(collected)})` : ''}. Le changement est noté dans l’historique.</span></div>
      </div>
    </Modal>
  );
}
