// Stock : état par variante, valeur, mouvements filtrables, inventaire physique.
import { useMyScope } from '../lib/scope';
import { ScopeBar } from '../ui/scope';
import { useMemo, useState } from 'react';
import { audit, useCan, type User } from '../lib/auth';
import { get, useTable } from '../lib/db';
import {
  addMoves, categoryPath, fmtAr, fmtNum, incomingOf, MOVE_LABELS, parseNum, stockOf, useCatalog, variantLabel,
  type Category, type MoveType, type Product, type StockMove, type Variant, photoOf, matchQuery, productText, searchItems } from '../lib/catalog';
import { Button, FilterSelect, Confirm, Empty, PageHead, TextField, fmtDateTime, navigate, toast, useRoute, MoreMatches, useKeep } from '../ui/kit';
import { ListDates, PeriodPicker, defaultPeriod, inPeriod, type ListOrder, type Period } from '../ui/period';
import { categoryOptions, Thumb } from './Products';
import { downloadBlob, writeXlsx } from '../lib/xlsx';
import { cancelMove } from '../lib/corrections';
import { InventoryTab, VariantDetail } from './Inventory';
import { reservedIndex, type Order } from '../lib/orders';
import { Badge, IconButton } from '../ui/kit';
import { ADVICE, BOOST_DAYS, HEALTH, SALES_DAYS, coverDays, healthOf, soldByVariant, stockByPage, type Health } from '../lib/stockRank';
import { SortSelect, compareBy, useSortPref } from '../ui/stockSort';
const coverText = (d: number) => d === Infinity ? 'aucune vente' : d <= 0 ? '—' : d > 365 ? '> 1 an' : `${d} j`;

const TABS = [
  { key: 'etat', label: 'État du stock', perm: '' },
  { key: 'mouvements', label: 'Mouvements', perm: '' },
  { key: 'inventaire', label: 'Inventaire', perm: 'stock.adjust' },
];

export function StockPage() {
  const can = useCan();
  const route = useRoute();
  const tabs = TABS.filter((t) => !t.perm || can(t.perm));
  const cur = tabs.find((t) => route.endsWith('/' + t.key)) ?? tabs[0];
  return (
    <>
      <PageHead title="Stock" />
      <div className="tabs" role="tablist">
        {tabs.map((t) => <button key={t.key} role="tab" aria-selected={cur.key === t.key} onClick={() => navigate('/stock/' + t.key)}>{t.label}</button>)}
      </div>
      {cur.key === 'etat' && <StockState />}
      {cur.key === 'mouvements' && <MovesTab />}
      {cur.key === 'inventaire' && <InventoryTab />}
    </>
  );
}

function inCategory(p: Product | undefined, cat: string) {
  if (!cat) return true;
  let c = p?.categoryId ? get<Category>('categories', p.categoryId) : undefined;
  while (c) { if (c.id === cat) return true; c = c.parentId ? get<Category>('categories', c.parentId) : undefined; }
  return false;
}

function StockState() {
  const can = useCan();
  const showCost = can('costs.view');
  const { variants, categories } = useCatalog();
  const [q, setQ] = useKeep('stock.q', '');
  const [cat, setCat] = useKeep('stock.cat', '');
  const [f, setF] = useKeep<'' | 'in' | 'out' | 'neg'>('stock.f', 'in');
  const [limit, setLimit] = useKeep('stock.limit', 150);
  const scope = useMyScope();
  const [allMatches, setAllMatches] = useKeep('stock.all', false);
  const [others, setOthers] = useState(0);
  const [detail, setDetail] = useState<string | null>(null);
  const [sort, setSort, sortDef] = useSortPref('stock', showCost);
  const [health, setHealth] = useKeep<'' | Health>('stock.health', '');

  const orders = useTable<Order>('orders');
  const reserved = useMemo(() => reservedIndex(), [orders]);
  const sold = useMemo(() => soldByVariant(), [orders]);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const sr = searchItems(variants
      .map((v) => ({ v, p: get<Product>('products', v.productId), stock: stockOf(v.id), incoming: incomingOf(v.id), held: reserved.get(v.id) ?? 0 }))
      .filter((r) => r.p && r.p.active !== false && r.v.active !== false)
      .filter((r) => scope.product(r.p!.id))
      .filter((r) => inCategory(r.p, cat)), (r) => `${r.v.sku} ${productText(r.p!)}`, n, allMatches);
    queueMicrotask(() => setOthers(sr.others));
    return sr.list
      .filter((r) => f === 'in' ? r.stock > 0 : f === 'out' ? r.stock === 0 : f === 'neg' ? r.stock < 0 : true)
      .map((r) => { const s30 = sold.get(r.v.id) ?? 0; return { ...r, value: Math.max(0, r.stock) * (r.v.costAvg ?? 0), sold: s30, cover: coverDays(r.stock, s30), health: healthOf(r.stock, s30) }; })
      .filter((r) => !health || r.health === health)
      .map((r) => ({ r, k: { value: r.value, qty: r.stock, sold: r.sold, createdAt: r.p!.createdAt, name: r.p!.name, code: r.v.sku } }))
      .sort((a, b) => compareBy(sort)(a.k, b.k))
      .map((x) => x.r);
  }, [variants, q, cat, f, scope.on, allMatches, reserved, sold, sort, health]);

  const anyHeld = rows.some((r) => r.held);
  const anyIncoming = rows.some((r) => r.incoming);
  const allRows = variants.filter((v) => { const p = get<Product>('products', v.productId); return p && p.active !== false && scope.product(p.id) && inCategory(p, cat); });
  const totals = allRows.reduce((t, v) => {
    const s = stockOf(v.id);
    t.pcs += Math.max(0, s); t.value += Math.max(0, s) * (v.costAvg ?? 0);
    if (s < 0) t.neg++; if (s === 0) t.out++;
    return t;
  }, { pcs: 0, value: 0, neg: 0, out: 0 });

  async function exportXlsx() {
    const blob = await writeXlsx([{
      name: 'Stock',
      columns: [{ header: 'Catégorie', width: 22 }, { header: 'Code article', width: 14 }, { header: 'Article', width: 36 }, { header: 'Couleur', width: 14 }, { header: 'Taille', width: 9 }, { header: 'Code variante', width: 22 }, { header: 'Stock', width: 9, number: true }, { header: 'Réservé (commandes en cours)', width: 14, number: true }, { header: 'Disponible', width: 11, number: true }, { header: 'En arrivage', width: 11, number: true }, { header: `Vendus ${SALES_DAYS} j`, width: 11, number: true }, { header: 'Jours pour écouler', width: 12 }, { header: 'Marque', width: 14 },
        ...(showCost ? [{ header: 'Coût moyen (Ar)', width: 14, number: true }, { header: 'Valeur (Ar)', width: 14, number: true }] : [])],
      rows: rows.map((r) => [categoryPath(r.p!.categoryId), r.p!.code, r.p!.name, r.v.color ?? '', r.v.size ?? '', r.v.sku, r.stock, r.held, r.stock - r.held, r.incoming, r.sold, coverText(r.cover), r.health ? HEALTH[r.health].label : '', ...(showCost ? [Math.round(r.v.costAvg ?? 0), Math.round(r.value)] : [])]),
    }]);
    downloadBlob(blob, `Tresor-en-ligne-stock-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <>
      <ScopeBar scope={scope} />
      <div className="stat-grid">
        <div className="card stat"><span className="muted small">Pièces en stock</span><span className="stat-value">{fmtNum(totals.pcs)}</span></div>
        {showCost && <div className="card stat"><span className="muted small">Valeur du stock (coût)</span><span className="stat-value">{fmtAr(totals.value)}</span></div>}
        <div className="card stat"><span className="muted small">Variantes en rupture</span><span className="stat-value">{fmtNum(totals.out)}</span></div>
        {totals.neg > 0 && <button className="card stat stat-warn" onClick={() => setF('neg')}><span className="muted small">Stocks négatifs à corriger</span><span className="stat-value">{totals.neg}</span></button>}
      </div>
      <PageStockCard showCost={showCost} keep={(p) => scope.product(p.id)} />
      <div className="card stack-s filter-compact">
        <div className="row filter-row">
          <div className="field fc-search"><input aria-label="Rechercher" placeholder="Rechercher un code ou un article" value={q} onChange={(e) => { setQ(e.target.value); setAllMatches(false); }} /></div>
          <div className="field fc-select">
            <FilterSelect label="Catégorie" value={cat} onChange={setCat} options={categoryOptions(categories, 'Toutes les catégories')} />
          </div>
          <SortSelect compact value={sort} onChange={setSort} def={sortDef} showCost={showCost} />
          <div className="field fc-select">
            <select aria-label="Marque" value={health} onChange={(e) => setHealth(e.target.value as '' | Health)} title={`Dormant : aucune vente depuis ${SALES_DAYS} jours (promotion, ou ne plus en racheter). À booster : plus de ${BOOST_DAYS} jours pour écouler le stock (faire de la publicité). Rotation OK : se vend bien.`}>
              <option value="">Marque : toutes</option>
              {(Object.keys(HEALTH) as Health[]).map((h) => <option key={h} value={h}>Marque : {HEALTH[h].label}</option>)}
            </select>
          </div>
        </div>
        <div className="row-between filter-row">
          <div className="row" style={{ gap: 8 }}>
            <div className="segmented segmented-sm" role="group">
              {([['in', 'En stock'], ['out', 'En rupture'], ['neg', 'Négatifs'], ['', 'Tout']] as const).map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
            </div>
            {(q || cat || health) && <Button variant="quiet" className="btn-sm" icon="x" onClick={() => { setQ(''); setCat(''); setHealth(''); }}>Effacer les filtres</Button>}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <details className="fc-legend"><summary className="small">Que veulent dire les marques ?</summary>
              <p className="small muted">« Dormant » : en stock, aucune vente depuis {SALES_DAYS} jours (promotion, ou ne plus en racheter). « À booster » : il faudrait plus de {BOOST_DAYS} jours pour écouler le stock au rythme actuel (faire de la publicité). « Rotation OK » : se vend bien.</p></details>
            <Button variant="ghost" className="btn-sm" icon="download" onClick={exportXlsx}>Excel</Button>
          </div>
        </div>
        <MoreMatches n={others} onShow={() => setAllMatches(true)} />
      </div>
      <div className="card card-flush">
        {rows.length === 0 ? <Empty icon="store" title="Aucune variante ne correspond" /> : (
          <div className="table-wrap">
            <table className="table table-compact stock-table">
              <thead><tr><th>Article</th><th>Variante</th><th className="t-num">Stock</th>{anyHeld && <th className="t-num" title="Pièces promises à des commandes pas encore remises au livreur">Réservé</th>}{anyHeld && <th className="t-num">Dispo.</th>}{anyIncoming && <th className="t-num">Arrivage</th>}{showCost && <th className="t-num" title="Stock × coût moyen">Valeur</th>}<th className="t-num">Vendus {SALES_DAYS} j</th><th className="t-num" title="Au rythme des ventes des 30 derniers jours">Pour écouler</th><th></th></tr></thead>
              <tbody>
                {rows.slice(0, limit).map((r) => (
                  <tr key={r.v.id} className="row-link" onClick={() => navigate('/articles/' + r.p!.id)}>
                    <td><div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><Thumb src={photoOf(r.v)} size={44} zoom alt={r.p!.name} /><div><strong>{r.p!.name}</strong><div className="small muted">{r.v.sku}</div>{r.health ? <span title={HEALTH[r.health].hint}><Badge tone={HEALTH[r.health].tone}>{HEALTH[r.health].label}</Badge></span> : null}</div></div></td>
                    <td>{variantLabel(r.v)}</td>
                    <td className="t-num"><span className={`stock-pill ${r.stock <= 0 ? 'is-out' : ''}`}>{fmtNum(r.stock)}</span></td>
                    {anyHeld && <td className="t-num">{r.held ? <button type="button" className="link-btn" style={{ padding: 0 }} title="Voir les commandes qui réservent" onClick={(e) => { e.stopPropagation(); setDetail(r.v.id); }}>{fmtNum(r.held)}</button> : '—'}</td>}
                    {anyHeld && <td className={`t-num ${r.stock - r.held < 0 ? 'neg' : ''}`}>{r.held ? fmtNum(r.stock - r.held) : fmtNum(r.stock)}</td>}
                    {anyIncoming && <td className="t-num">{r.incoming || '—'}</td>}
                    {showCost && <td className="t-num nowrap"><strong>{fmtAr(r.value)}</strong><div className="small muted">{fmtAr(r.v.costAvg)} / pce</div></td>}
                    <td className="t-num">{fmtNum(r.sold)}</td>
                    <td className="t-num small nowrap">{coverText(r.cover)}</td>
                    <td className="t-act"><IconButton icon="eye" label="Détail du stock (mouvements, réservations)" onClick={(e) => { e.stopPropagation(); setDetail(r.v.id); }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {rows.length > limit && <Button variant="ghost" onClick={() => setLimit(limit + 300)}>Afficher plus ({rows.length - limit})</Button>}
      {detail && <VariantDetail variantId={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

/** Résumé par page : où dort l'argent, et quelles pages mériteraient un boost. */
function PageStockCard({ showCost, keep }: { showCost: boolean; keep: (p: Product) => boolean }) {
  const orders = useTable<Order>('orders'); const boosts = useTable('boosts'); const moves = useTable('stockMoves');
  const [open, setOpen] = useKeep('stock.pages.open', false);
  const list = useMemo(() => stockByPage(keep), [orders, boosts, moves]);
  if (!list.length) return null;
  return (
    <div className="card card-flush page-stock">
      <div className="card-pad row-between">
        <div><h2>Stock par page — pour décider et choisir les publicités</h2>
          <p className="small muted">{open ? `Valeur au prix de revient · ventes des ${SALES_DAYS} derniers jours · boosts actifs aujourd’hui.` : `${list.length} page(s) · ${list.filter((r) => r.advice === 'boost').length} à booster · ${list.filter((r) => r.advice === 'promo').length} promotion à envisager`}</p></div>
        <Button variant="ghost" className="btn-sm" onClick={() => setOpen(!open)}>{open ? 'Masquer' : 'Afficher'}</Button>
      </div>
      {open && <div className="table-wrap"><table className="table">
        <thead><tr><th>Page</th>{showCost && <th className="t-num">Valeur stock</th>}<th className="t-num">Pièces</th><th className="t-num">Vendus {SALES_DAYS} j</th><th className="t-num">Pour écouler</th>{showCost && <th className="t-num">Dont dormant</th>}<th>Boost</th><th>Conseil</th></tr></thead>
        <tbody>{list.map((r) => (
          <tr key={r.id}>
            <td><strong>{r.name}</strong></td>
            {showCost && <td className="t-num"><strong>{fmtAr(r.value)}</strong></td>}
            <td className="t-num">{fmtNum(r.pieces)}</td>
            <td className="t-num">{fmtNum(r.sold)}</td>
            <td className="t-num small">{coverText(r.cover)}</td>
            {showCost && <td className={`t-num ${r.dormantValue ? 'neg' : ''}`}>{r.dormantValue ? fmtAr(r.dormantValue) : '—'}</td>}
            <td>{r.boosts ? <Badge tone="brand">{r.boosts} actif(s)</Badge> : <span className="small muted">Aucun</span>}</td>
            <td><Badge tone={ADVICE[r.advice].tone}>{ADVICE[r.advice].label}</Badge></td>
          </tr>
        ))}</tbody>
      </table></div>}
    </div>
  );
}

function MovesTab() {
  const can = useCan();
  const moves = useTable<StockMove>('stockMoves');
  const users = useTable<User>('users');
  useCatalog();
  const [period, setPeriod] = useKeep<Period>('moves.period', defaultPeriod('today'));
  const [mOrder, setMOrder] = useKeep<ListOrder>('moves.order', 'new');
  const [type, setType] = useKeep('moves.type', '');
  const [dir, setDir] = useKeep<'' | 'in' | 'out'>('moves.dir', '');
  const [userId, setUserId] = useKeep('moves.user', '');
  const [q, setQ] = useKeep('moves.q', '');
  const [limit, setLimit] = useState(150);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return moves
      .filter((m) => inPeriod(m.at, period))
      .filter((m) => !type || m.type === type)
      .filter((m) => !dir || (dir === 'in' ? m.qty > 0 : m.qty < 0))
      .filter((m) => !userId || m.userId === userId)
      .filter((m) => { if (!n) return true; const v = get<Variant>('variants', m.variantId); const p = v && get<Product>('products', v.productId); return `${v?.sku} ${p?.name} ${m.reason}`.toLowerCase().includes(n); })
      .sort((a, b) => (mOrder === 'new' ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at)));
  }, [moves, period, type, dir, userId, q, mOrder]);
  const [undo, setUndo] = useState<StockMove | null>(null);
  const [undoWhy, setUndoWhy] = useState('');
  const cancelledIds = useMemo(() => new Set(moves.filter((m) => m.refType === 'cancel' && m.refId).map((m) => m.refId!)), [moves]);
  const tin = list.filter((m) => m.qty > 0).reduce((s, m) => s + m.qty, 0);
  const tout = list.filter((m) => m.qty < 0).reduce((s, m) => s - m.qty, 0);

  return (
    <>
      <div className="card stack">
        <ListDates period={period} onPeriod={setPeriod} order={mOrder} onOrder={setMOrder} what="Date du mouvement" />
        <div className="row">
          <div className="field" style={{ flex: '1 1 200px' }}><input aria-label="Rechercher" placeholder="Rechercher un article, un motif" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="field" style={{ flex: '0 1 170px' }}>
            <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Tous les types</option>{Object.entries(MOVE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '0 1 150px' }}>
            <select aria-label="Sens" value={dir} onChange={(e) => setDir(e.target.value as any)}><option value="">Entrées et sorties</option><option value="in">Entrées</option><option value="out">Sorties</option></select>
          </div>
          <div className="field" style={{ flex: '0 1 170px' }}>
            <select aria-label="Utilisateur" value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Tous les utilisateurs</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
          </div>
        </div>
        <p className="small"><strong className="pos">+{fmtNum(tin)}</strong> entrées · <strong className="neg">−{fmtNum(tout)}</strong> sorties · {list.length} mouvement(s)</p>
      </div>
      <div className="card card-flush">
        {list.length === 0 ? <Empty icon="list" title="Aucun mouvement sur cette période" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Article</th><th>Type</th><th className="t-num">Qté</th>{can('costs.view') && <th className="t-num">Coût unit.</th>}<th>Détail</th><th>Par</th>{can('records.correct') && <th></th>}</tr></thead>
              <tbody>
                {list.slice(0, limit).map((m) => {
                  const v = get<Variant>('variants', m.variantId); const p = v && get<Product>('products', v.productId);
                  return (
                    <tr key={m.id}>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(m.at)}</td>
                      <td><strong>{p?.name ?? '?'}</strong><div className="small muted">{v?.sku}</div></td>
                      <td>{MOVE_LABELS[m.type as MoveType]}</td>
                      <td className={`t-num num ${m.qty > 0 ? 'pos' : 'neg'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</td>
                      {can('costs.view') && <td className="t-num">{m.unitCost ? fmtAr(m.unitCost) : '—'}</td>}
                      <td className="small">{m.reason}</td>
                      <td className="small muted">{m.userName}</td>
                      {can('records.correct') && <td>{(!m.refType || m.refType === 'inventory' || m.refType === 'adjust') ? (cancelledIds.has(m.id) ? <span className="small muted">annulé</span> : <Button variant="danger" icon="x" className="btn-sm" onClick={() => setUndo(m)}>Annuler</Button>) : null}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {list.length > limit && <Button variant="ghost" onClick={() => setLimit(limit + 300)}>Afficher plus</Button>}
      {undo && <Confirm title="Annuler ce mouvement de stock" danger confirmLabel="Annuler le mouvement" onClose={() => { setUndo(null); setUndoWhy(''); }}
        message={<div className="stack-s"><p>Un mouvement inverse ({undo.qty > 0 ? '−' : '+'}{Math.abs(undo.qty)}) remet le stock comme avant. Les deux restent dans l’historique.</p><TextField label="Raison" value={undoWhy} onChange={setUndoWhy} required /></div>}
        onConfirm={async () => { if (!undoWhy.trim()) throw new Error('Indiquez la raison.'); await cancelMove(undo, undoWhy.trim()); toast('Mouvement annulé'); }} />}
    </>
  );
}
