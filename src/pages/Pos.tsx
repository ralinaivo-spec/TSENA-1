// Vente sur place : écran de comptoir rapide (recherche, panier, encaissement, monnaie à rendre).
import { useMemo, useState } from 'react';
import { useCan } from '../lib/auth';
import { get, getMeta, newId, useTable } from '../lib/db';
import { fmtAr, fmtNum, parseNum, productVariants, todayYmd, useCatalog, variantLabel, type Product, type Variant } from '../lib/catalog';
import {
  availableOf, createWalkInSale, isOutsideHours, isWalkIn, linePrice, orderLabel, PAY_METHODS, paidTotal, keptTotal, repriceLines, reservedIndex, useWholesale,
  type Order, type OrderLine, type PayMethod,
} from '../lib/orders';
import { useCompany } from '../lib/settings';
import { Badge, Button, Empty, IconButton, Modal, PageHead, TextField, fmtDateTime, toast } from '../ui/kit';
import { Icon } from '../ui/icons';
import { ItemPicker } from './Orders';
import { defaultTarget, printTo, ticketDoc } from '../lib/print';
import { PrintButton, PrintDialog } from '../ui/print';
import { Thumb } from './Products';

export function PosPage() {
  const can = useCan();
  const company = useCompany();
  const { products } = useCatalog();
  const orders = useTable<Order>('orders');
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [wholesale, setWholesale] = useState<Order['wholesale']>('auto');
  const [discount, setDiscount] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [picking, setPicking] = useState<Product | null>(null);
  const [paying, setPaying] = useState(false);
  const [last, setLast] = useState<Order | null>(null);
  const [printFor, setPrintFor] = useState<Order | null>(null);
  const reserved = useMemo(() => reservedIndex(), [orders]);
  const minQty = company.wholesaleMinQty ?? 3;
  const isGros = useWholesale({ lines, wholesale }, minQty);
  const priced = repriceLines(lines, isGros);
  const items = priced.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const total = Math.max(0, items - (parseNum(discount) || 0));
  const count = priced.reduce((s, l) => s + l.qty, 0);

  const n = q.trim().toLowerCase();
  const found = useMemo(() => products
    .filter((p) => p.active !== false && (!n || `${p.code} ${p.name} ${productVariants(p.id).map((v) => v.sku).join(' ')}`.toLowerCase().includes(n)))
    .map((p) => ({ p, avail: productVariants(p.id).reduce((s, v) => s + Math.max(0, availableOf(v.id, reserved)), 0) }))
    .sort((a, b) => Number(b.avail > 0) - Number(a.avail > 0) || a.p.code.localeCompare(b.p.code, 'fr', { numeric: true }))
    .slice(0, 48), [products, n, reserved]);

  const today = todayYmd();
  const todaySales = orders.filter((o) => isWalkIn(o) && o.createdAt.slice(0, 10) === today && o.status !== 'cancelled').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const todayTotal = todaySales.reduce((s, o) => s + Math.max(0, keptTotal(o) - (o.discount || 0)), 0);

  function add(a: { variantId: string; qty: number }[]) {
    const merged = [...lines];
    for (const x of a) {
      const ex = merged.find((l) => l.variantId === x.variantId);
      if (ex) ex.qty += x.qty; else merged.push({ id: newId(), variantId: x.variantId, qty: x.qty, unitPrice: linePrice(x.variantId, false) });
    }
    setLines(merged);
  }
  function pick(p: Product) {
    const vs = productVariants(p.id).filter((v) => v.active !== false);
    if (vs.length === 1) add([{ variantId: vs[0].id, qty: 1 }]); else setPicking(p);
  }
  const setLine = (id: string, patch: Partial<OrderLine>) => setLines(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)).filter((l) => l.qty > 0));
  const reset = () => { setLines([]); setDiscount(''); setPhone(''); setName(''); setWholesale('auto'); setQ(''); };

  if (!can('pos.sell')) return <Empty icon="lock" title="Accès réservé" />;
  return (
    <>
      <PageHead title="Vente sur place" subtitle={`Aujourd’hui : ${todaySales.length} vente(s) · ${fmtAr(todayTotal)}`} />
      {last && (
        <div className="notice notice-ok"><Icon name="check" /><span style={{ flex: 1 }}><strong>Vente {last.number} enregistrée</strong> — {fmtAr(Math.max(0, keptTotal(last) - (last.discount || 0)))}. Le stock est mis à jour.</span><PrintButton label="Ticket" docs={[{ key: 'ticket', label: 'Ticket de caisse', build: () => ticketDoc(get<Order>('orders', last.id) ?? last, company) }]} /></div>
      )}
      <div className="pos-layout">
        <section className="pos-catalog card stack">
          <div className="field"><input aria-label="Rechercher un article" placeholder="Rechercher un code ou un nom…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
          {found.length === 0 ? <Empty icon="search" title="Aucun article trouvé" /> : (
            <div className="pos-grid">
              {found.map(({ p, avail }) => (
                <button key={p.id} className={`pos-tile ${avail <= 0 ? 'is-out' : ''}`} onClick={() => pick(p)}>
                  <Thumb src={p.photo} size={64} />
                  <span className="pos-tile-name">{p.name}</span>
                  <span className="small muted">{p.code}</span>
                  <span className="pos-tile-foot"><strong className="num">{fmtAr(p.priceRetail)}</strong><span className={`stock-pill ${avail <= 0 ? 'is-out' : ''}`}>{avail}</span></span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="pos-cart card stack">
          <div className="row-between"><h2>Panier</h2>{lines.length > 0 && <Button variant="quiet" onClick={reset}>Vider</Button>}</div>
          {priced.length === 0 ? <Empty icon="store" title="Touchez un article pour l’ajouter" /> : (
            <ul className="list">
              {priced.map((l) => {
                const v = get<Variant>('variants', l.variantId); const p = v && get<Product>('products', v.productId);
                return (
                  <li key={l.id} className="cart-line">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong className="cart-name">{p?.name}</strong>
                      <div className="small muted">{p?.code} · {variantLabel(v)}</div>
                      <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'nowrap' }}>
                        <IconButton icon="x" label="Retirer un" onClick={() => setLine(l.id, { qty: l.qty - 1 })} />
                        <span className="num" style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{l.qty}</span>
                        <IconButton icon="plus" label="Ajouter un" onClick={() => setLine(l.id, { qty: l.qty + 1 })} />
                        <input className="cell-input" style={{ maxWidth: 110 }} inputMode="numeric" aria-label="Prix unitaire" value={l.unitPrice || ''} onChange={(e) => setLine(l.id, { unitPrice: parseNum(e.target.value) || 0, priceManual: true })} />
                      </div>
                    </div>
                    <strong className="num">{fmtAr(l.qty * l.unitPrice)}</strong>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="segmented" role="group" aria-label="Prix">
            {([['auto', `Gros dès ${minQty} pcs`], ['yes', 'Prix de gros'], ['no', 'Prix détail']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={wholesale === k} onClick={() => setWholesale(k)}>{l}</button>)}
          </div>
          {isGros && <Badge tone="brand">Prix de gros appliqué</Badge>}
          <div className="grid-2">
            <TextField label="Remise (Ar)" value={discount} onChange={setDiscount} inputMode="numeric" />
            <TextField label="Téléphone client (facultatif)" value={phone} onChange={setPhone} type="tel" inputMode="tel" />
          </div>
          <TextField label="Nom du client (facultatif)" value={name} onChange={setName} />
          <div className="summary-box" style={{ maxWidth: 'none' }}>
            <div><span>{fmtNum(count)} article(s)</span><strong className="num">{fmtAr(items)}</strong></div>
            {(parseNum(discount) || 0) > 0 && <div><span>Remise</span><strong className="num">− {fmtAr(parseNum(discount))}</strong></div>}
            <div className="summary-total"><span>Total</span><strong className="num pos-total">{fmtAr(total)}</strong></div>
          </div>
          <Button block icon="check" disabled={!priced.length} onClick={() => setPaying(true)}>Encaisser {fmtAr(total)}</Button>
        </aside>
      </div>

      <div className="card card-flush">
        <div className="card-pad"><h2>Ventes du jour</h2></div>
        {todaySales.length === 0 ? <Empty icon="list" title="Aucune vente sur place aujourd’hui" /> : (
          <ul className="list">
            {todaySales.map((o) => (
              <li key={o.id} className="li-with-action">
                <a className="list-item list-link" href={`#/commandes/${o.id}`}>
                  <div className="list-item-main">
                    <span className="list-item-title">{o.number} · {orderLabel(o)}</span>
                    <p className="small muted">{fmtDateTime(o.createdAt)} · {o.lines.reduce((s, l) => s + l.qty, 0)} article(s) · {[...new Set(o.payments.map((p) => PAY_METHODS[p.method]))].join(' + ') || 'non payé'}{o.createdByName ? ` · ${o.createdByName}` : ''}</p>
                  </div>
                  <div className="list-item-side"><strong className="num">{fmtAr(Math.max(0, keptTotal(o) - (o.discount || 0)))}</strong>{paidTotal(o) < keptTotal(o) - (o.discount || 0) && <span className="small neg">reste {fmtAr(keptTotal(o) - (o.discount || 0) - paidTotal(o))}</span>}</div>
                </a>
                <IconButton icon="printer" label={`Imprimer le ticket ${o.number}`} onClick={() => setPrintFor(o)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {picking && <ItemPicker noChoice initialProduct={picking} onClose={() => setPicking(null)} onAdd={add} />}
      {paying && <PayDialog total={total} onClose={() => setPaying(false)} onPaid={async (payments, cashGiven) => {
        const o = await createWalkInSale({ lines: priced, discount: parseNum(discount) || 0, wholesale, phone: phone.trim() || undefined, name: name.trim() || undefined, payments, cashGiven, outsideHours: isOutsideHours(new Date(), company) });
        setLast(o); reset(); setPaying(false); toast(`Vente ${o.number} enregistrée`);
        if (getMeta('printAutoTicket', false)) {
          printTo(defaultTarget(), ticketDoc(o, company)).then((m) => toast(m)).catch((e) => toast(`Ticket non imprimé : ${e?.message ?? e}`, 'error'));
        }
      }} />}
      {printFor && <PrintDialog docs={[{ key: 'ticket', label: 'Ticket de caisse', build: () => ticketDoc(printFor, company) }]} onClose={() => setPrintFor(null)} />}
    </>
  );
}

/** Encaissement : un ou plusieurs moyens de paiement, calcul de la monnaie à rendre. */
function PayDialog({ total, onClose, onPaid }: { total: number; onClose: () => void; onPaid: (p: { amount: number; method: PayMethod; ref?: string }[], cashGiven?: number) => Promise<void> }) {
  const [pays, setPays] = useState<{ method: PayMethod; amount: string; ref: string }[]>([{ method: 'cash', amount: String(total), ref: '' }]);
  const [given, setGiven] = useState('');
  const [busy, setBusy] = useState(false);
  const sum = pays.reduce((s, p) => s + (parseNum(p.amount) || 0), 0);
  const cash = pays.filter((p) => p.method === 'cash').reduce((s, p) => s + (parseNum(p.amount) || 0), 0);
  const change = given ? (parseNum(given) || 0) - cash : 0;
  const missing = total - sum;
  const set = (i: number, patch: Partial<{ method: PayMethod; amount: string; ref: string }>) => setPays(pays.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <Modal title={`Encaisser ${fmtAr(total)}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button busy={busy} disabled={sum <= 0 || sum > total} onClick={async () => {
        setBusy(true);
        try { await onPaid(pays.map((p) => ({ amount: parseNum(p.amount) || 0, method: p.method, ref: p.ref.trim() || undefined })), parseNum(given) || undefined); } finally { setBusy(false); }
      }}>{missing > 0 ? `Valider (reste ${fmtAr(missing)})` : 'Valider la vente'}</Button></>}>
      <div className="stack">
        {pays.map((p, i) => (
          <div key={i} className="card stack-s" style={{ background: 'var(--surface-2)' }}>
            <div className="segmented" role="group" aria-label="Moyen de paiement">
              {(Object.keys(PAY_METHODS) as PayMethod[]).map((m) => <button key={m} type="button" aria-pressed={p.method === m} onClick={() => set(i, { method: m })}>{PAY_METHODS[m]}</button>)}
            </div>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><TextField label="Montant (Ar)" value={p.amount} onChange={(v) => set(i, { amount: v })} inputMode="numeric" /></div>
              {p.method !== 'cash' && <div style={{ flex: 1 }}><TextField label="Référence" value={p.ref} onChange={(v) => set(i, { ref: v })} /></div>}
              {pays.length > 1 && <IconButton icon="x" label="Retirer" onClick={() => setPays(pays.filter((_, j) => j !== i))} />}
            </div>
          </div>
        ))}
        {missing > 0 && <Button variant="ghost" icon="plus" onClick={() => setPays([...pays, { method: 'mvola', amount: String(missing), ref: '' }])}>Ajouter un autre moyen ({fmtAr(missing)} restants)</Button>}
        {sum > total && <div className="notice notice-danger"><Icon name="alert" /><span>Le total des paiements dépasse le montant de la vente.</span></div>}
        {cash > 0 && (
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><TextField label="Espèces données par le client (Ar)" value={given} onChange={setGiven} inputMode="numeric" /></div>
            <div className="total-box" style={{ flex: 1 }}><span className="small muted">Monnaie à rendre</span><strong className={`num ${change < 0 ? 'neg' : ''}`}>{given ? fmtAr(Math.abs(change)) : '—'}</strong>{change < 0 && <span className="small neg">il manque</span>}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
