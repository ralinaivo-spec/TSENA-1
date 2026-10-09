// Espace du livreur (rôle « Livreur ») : seulement ses colis et son compte. Lecture seule.
import { useMe } from '../lib/auth';
import { get, save, useTable } from '../lib/db';
import { fmtAr, fmtNum, variantLabel, type Product, type Variant } from '../lib/catalog';
import { courierSplit, fmtPhone, orderLabel, remaining, type Courier, type Order, type Zone } from '../lib/orders';
import { courierBalance, type CourierSettlement } from '../lib/money';
import { Badge, Button, Empty, PageHead, fmtDateTime, toast } from '../ui/kit';
import { Icon } from '../ui/icons';

const itemName = (variantId: string) => {
  const v = get<Variant>('variants', variantId); const p = v && get<Product>('products', v.productId);
  const vl = variantLabel(v);
  return [p?.name ?? 'Article', vl && vl !== 'Unique' && !p?.attrs ? vl : ''].filter(Boolean).join(' ');
};

export function MyDeliveriesPage() {
  const me = useMe();
  const orders = useTable<Order>('orders');
  useTable<Zone>('zones'); useTable<Courier>('couriers');
  const settlements = useTable<CourierSettlement>('courierSettlements');
  const courier = me.courierId ? get<Courier>('couriers', me.courierId) : undefined;
  if (!courier) return <Empty icon="truck" title="Aucune fiche livreur reliée à votre compte">Demandez au gérant de relier votre compte à votre fiche livreur (Utilisateurs).</Empty>;
  const out = orders.filter((o) => o.courierId === courier.id && o.status === 'out').sort((a, b) => (a.dispatchedAt || '').localeCompare(b.dispatchedAt || ''));
  const done = orders.filter((o) => o.courierId === courier.id && ['delivered', 'partial', 'refused'].includes(o.status)).sort((a, b) => (b.returnedAt || '').localeCompare(a.returnedAt || '')).slice(0, 15);
  const bal = courierBalance(courier.id);
  const toCollect = out.reduce((t, o) => t + Math.max(0, remaining(o)), 0);
  const fees = out.reduce((t, o) => t + courierSplit(o).fee, 0);
  const mine = settlements.filter((s) => s.courierId === courier.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  return (
    <>
      <PageHead title="Mes livraisons" subtitle={courier.name} />
      <div className="stat-grid">
        <div className="card stat"><span className="small muted">Colis à livrer</span><strong className="stat-value num">{out.length}</strong></div>
        <div className="card stat stat-strong"><span className="small muted">À encaisser auprès des clients</span><strong className="stat-value num">{fmtAr(toCollect)}</strong></div>
        <div className="card stat"><span className="small muted">Mes frais de livraison (colis en cours)</span><strong className="stat-value num">{fmtAr(fees)}</strong></div>
        <div className="card stat"><span className="small muted">{bal.due >= 0 ? 'À rendre à la boutique (colis en cours compris)' : 'La boutique me doit'}</span><strong className={`stat-value num ${bal.due < 0 ? 'pos' : ''}`}>{fmtAr(Math.abs(bal.due))}</strong></div>
      </div>
      {bal.carry < 0 && (
        <div className="notice notice-warn" style={{ flexWrap: 'wrap', alignItems: 'center' }}><Icon name="wallet" /><span style={{ flex: '1 1 220px' }}><strong>La boutique vous doit {fmtAr(-bal.carry)} de frais de livraison.</strong> {courier.feeClaimAt ? `Réclamé le ${new Date(courier.feeClaimAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} : le gérant est prévenu.` : 'Si on oublie de vous payer, réclamez-les.'}</span>
          <Button variant="ghost" onClick={async () => { await save('couriers', { id: courier.id, feeClaimAt: new Date().toISOString() }); toast('Réclamation envoyée au gérant'); }}>{courier.feeClaimAt ? 'Réclamer de nouveau' : 'Réclamer mes frais'}</Button></div>
      )}
      <div className="card card-flush">
        <div className="card-pad"><h2>Colis à livrer</h2></div>
        {out.length === 0 ? <Empty icon="truck" title="Aucun colis en cours" /> : (
          <ul className="list">{out.map((o) => {
            const x = courierSplit(o); const rest = Math.max(0, remaining(o));
            return (
              <li key={o.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                <div className="list-item-main stack-s">
                  <span className="list-item-title">{orderLabel(o)} <span className="muted small">{o.number}</span>{o.lines.some((l) => l.isChoice) && <> <Badge tone="warn">avec choix</Badge></>}</span>
                  <p className="small"><Icon name="truck" size={14} /> {get<Zone>('zones', o.zoneId || '')?.name}{o.place ? ` — ${o.place}` : ''}</p>
                  {o.phone && <p className="small"><a href={`tel:${o.phone}`}><strong>{fmtPhone(o.phone)}</strong></a></p>}
                  <p className="small muted">{o.lines.map((l) => `${fmtNum(l.qty)} × ${itemName(l.variantId)}${l.isChoice ? ' (choix)' : ''}`).join(' · ')}</p>
                  {o.notes && <p className="small">Obs. : {o.notes}</p>}
                </div>
                <div className="list-item-side">
                  <strong className="num">{rest ? fmtAr(rest) : 'Déjà payé'}</strong>
                  {rest > 0 && <span className="small muted">articles {fmtAr(x.toCollect)}{x.feeKept ? ` + frais ${fmtAr(x.feeKept)}` : ''}</span>}
                </div>
              </li>
            );
          })}</ul>
        )}
      </div>
      <div className="card card-flush">
        <div className="card-pad"><h2>Dernières livraisons</h2></div>
        {done.length === 0 ? <p className="card-pad small muted">Aucune.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Colis</th><th>Résultat</th><th className="t-num">Encaissé pour la boutique</th><th className="t-num">Mes frais</th><th>Réglé</th></tr></thead>
            <tbody>{done.map((o) => { const x = courierSplit(o); return (
              <tr key={o.id}><td><strong>{o.number}</strong> <span className="small muted">{orderLabel(o)} · {fmtDateTime(o.returnedAt)}</span></td>
                <td><Badge tone={o.status === 'refused' ? 'danger' : 'ok'}>{o.status === 'refused' ? 'Refusée' : o.status === 'partial' ? 'En partie' : 'Livrée'}</Badge></td>
                <td className="t-num">{fmtAr(x.toCollect)}</td><td className="t-num">{fmtAr(x.fee)}</td><td>{o.courierSettledAt ? '✓' : <span className="small muted">à régler</span>}</td></tr>
            ); })}</tbody>
          </table></div>
        )}
      </div>
      {mine.length > 0 && (
        <div className="card card-flush">
          <div className="card-pad"><h2>Mes versements</h2></div>
          <ul className="list">{mine.map((s) => <li key={s.id} className="list-item"><div className="list-item-main"><span className="list-item-title">{s.amount >= 0 ? `Remis à la boutique : ${fmtAr(s.amount)}` : `Reçu de la boutique : ${fmtAr(-s.amount)}`}</span><p className="small muted">{fmtDateTime(s.at)}{s.note ? ` · ${s.note}` : ''}</p></div></li>)}</ul>
        </div>
      )}
    </>
  );
}
