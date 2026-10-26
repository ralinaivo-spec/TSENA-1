// Livraisons et livreurs → « Livraisons effectuées » : les colis revenus (livrés, livrés en partie, refusés),
// par période et par livreur, pour vérifier après un retour livreur sans changer d'écran.
import { useTable } from '../lib/db';
import { fmtAr, matchQuery } from '../lib/catalog';
import { courierSplit, isPickupZone, isWalkIn, keptTotal, orderLabel, type Courier, type Order, type Zone } from '../lib/orders';
import { Badge, Empty, FilterSelect, TextField, fmtDateTime, navigate, useKeep } from '../ui/kit';
import { PeriodPicker, defaultPeriod, inPeriod, type Period } from '../ui/period';
import { useMyScope } from '../lib/scope';

type St = 'all' | 'delivered' | 'partial' | 'refused';
const ST_LABEL: Record<Exclude<St, 'all'>, { label: string; tone: 'ok' | 'warn' | 'danger' }> = {
  delivered: { label: 'Livrée', tone: 'ok' },
  partial: { label: 'En partie', tone: 'warn' },
  refused: { label: 'Refusée', tone: 'danger' },
};

export function DoneDeliveries() {
  const orders = useTable<Order>('orders');
  const zones = useTable<Zone>('zones');
  const couriers = useTable<Courier>('couriers').filter((c) => !c.removed).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const scope = useMyScope();
  // Filtres gardés pendant la session : on peut ouvrir une commande et revenir sans les perdre.
  const [period, setPeriod] = useKeep<Period>('done.period', defaultPeriod('today'));
  const [cid, setCid] = useKeep<string>('done.courier', '');
  const [st, setSt] = useKeep<St>('done.status', 'all');
  const [settled, setSettled] = useKeep<'all' | 'yes' | 'no'>('done.settled', 'all');
  const [q, setQ] = useKeep<string>('done.q', '');

  const doneAt = (o: Order) => o.returnedAt || o.statusDates?.[o.status as 'delivered'] || '';
  const list = orders
    .filter((o) => ['delivered', 'partial', 'refused'].includes(o.status) && !!o.courierId && !!o.dispatchedAt && !isPickupZone(o.zoneId) && !isWalkIn(o))
    .filter((o) => inPeriod(doneAt(o), period))
    .filter((o) => !cid || o.courierId === cid)
    .filter((o) => st === 'all' || o.status === st)
    .filter((o) => settled === 'all' || (settled === 'yes' ? !!o.courierSettledAt : !o.courierSettledAt))
    .filter((o) => !scope.strict || scope.mine(o))
    .filter((o) => !q.trim() || matchQuery(`${o.number} ${o.name ?? ''} ${o.phone ?? ''} ${o.place ?? ''}`, q))
    .sort((a, b) => doneAt(b).localeCompare(doneAt(a)));

  const rows = list.map((o) => {
    const x = courierSplit(o);
    const items = o.status === 'refused' ? 0 : Math.max(0, keptTotal(o) - (o.discount || 0));
    return { o, x, items };
  });
  const tot = rows.reduce((t, r) => ({ items: t.items + r.items, fee: t.fee + r.x.fee, got: t.got + r.x.clientPays, net: t.net + r.x.net }), { items: 0, fee: 0, got: 0, net: 0 });
  const byStatus = (s: Exclude<St, 'all'>) => list.filter((o) => o.status === s).length;
  const courierName = (id?: string) => couriers.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="stack">
      <div className="card stack-s">
        <PeriodPicker value={period} onChange={setPeriod} allowFuture={false} />
        <div className="filters-row row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 170px' }}><label>Livreur</label><FilterSelect label="Livreur" value={cid} onChange={setCid} options={[{ value: '', label: 'Tous les livreurs' }, ...couriers.map((c) => ({ value: c.id, label: c.name }))]} /></div>
          <div className="field" style={{ flex: '1 1 170px' }}><label>État</label><FilterSelect label="État" value={st} onChange={(v) => setSt(v as St)} options={[{ value: 'all', label: 'Tous les états' }, { value: 'delivered', label: 'Livrées' }, { value: 'partial', label: 'Livrées en partie' }, { value: 'refused', label: 'Refusées' }]} /></div>
          <div className="field" style={{ flex: '1 1 190px' }}><label>Versement</label><FilterSelect label="Versement" value={settled} onChange={(v) => setSettled(v as 'all')} options={[{ value: 'all', label: 'Réglées ou non' }, { value: 'yes', label: 'Réglées (versement fait)' }, { value: 'no', label: 'Pas encore réglées' }]} /></div>
          <div style={{ flex: '1 1 200px' }}><TextField label="Rechercher" value={q} onChange={setQ} placeholder="N°, client, téléphone, lieu" /></div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Date prise en compte : jour du retour du livreur (livraison confirmée).</p>
      </div>

      <div className="stat-grid">
        <div className="card stat stat-strong"><span className="small muted">Livraisons effectuées</span><strong className="stat-value num">{list.length}</strong><span className="small muted">{byStatus('delivered')} livrée(s) · {byStatus('partial')} en partie · {byStatus('refused')} refusée(s)</span></div>
        <div className="card stat"><span className="small muted">Articles vendus</span><strong className="stat-value num">{fmtAr(tot.items)}</strong></div>
        <div className="card stat"><span className="small muted">Frais de livraison (livreurs)</span><strong className="stat-value num">{fmtAr(tot.fee)}</strong></div>
        <div className="card stat"><span className="small muted">Net à verser par les livreurs</span><strong className="stat-value num">{fmtAr(tot.net)}</strong><span className="small muted">encaissé {fmtAr(tot.got)} − frais gardés</span></div>
      </div>

      <div className="card card-flush">
        {rows.length === 0 ? <Empty icon="truck" title="Aucune livraison effectuée sur cette période">Changez la période ou le livreur.</Empty> : (
          <div className="table-wrap"><table className="table review-table">
            <thead><tr><th>Retour</th><th>N°</th><th>Client</th><th>Lieu</th><th>Livreur</th><th>État</th><th className="t-num">Articles</th><th className="t-num">Frais</th><th className="t-num">Encaissé par le livreur</th><th className="t-num">À verser</th><th>Versement</th></tr></thead>
            <tbody>
              {rows.map(({ o, x, items }) => (
                <tr key={o.id}>
                  <td className="small">{fmtDateTime(doneAt(o))}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><a href={`#/commandes/${o.id}`} onClick={(e) => { e.preventDefault(); navigate(`/commandes/${o.id}`); }}>{o.number}</a></td>
                  <td className="small">{orderLabel(o)}</td>
                  <td className="small">{zones.find((z) => z.id === o.zoneId)?.name ?? ''}{o.place ? ` — ${o.place}` : ''}</td>
                  <td className="small">{courierName(o.courierId)}</td>
                  <td><Badge tone={ST_LABEL[o.status as 'delivered'].tone}>{ST_LABEL[o.status as 'delivered'].label}</Badge></td>
                  <td className="t-num">{fmtAr(items)}</td>
                  <td className="t-num">{fmtAr(x.fee)}</td>
                  <td className="t-num">{fmtAr(x.clientPays)}{x.clientPays === 0 && (o.payments || []).some((p) => p.receivedBy === 'shop') ? <div className="small muted">payé à la boutique</div> : null}</td>
                  <td className={`t-num ${x.net < 0 ? 'neg' : ''}`}><strong>{fmtAr(x.net)}</strong></td>
                  <td className="small">{o.courierSettledAt ? <Badge tone="ok">Réglée {new Date(o.courierSettledAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</Badge> : <Badge tone="warn">À régler</Badge>}</td>
                </tr>
              ))}
              <tr className="t-total"><td colSpan={6}>Total ({rows.length})</td><td className="t-num">{fmtAr(tot.items)}</td><td className="t-num">{fmtAr(tot.fee)}</td><td className="t-num">{fmtAr(tot.got)}</td><td className="t-num">{fmtAr(tot.net)}</td><td /></tr>
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
