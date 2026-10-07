// Récapitulatifs : journée et semaine (lundi → samedi) — ventes sur place, livraisons, comptes livreurs,
// paiements reçus, dépenses et autres mouvements, à envoyer au responsable.
import { useMemo, useState } from 'react';
import { useCan } from '../lib/auth';
import { useTable } from '../lib/db';
import { fmtAr } from '../lib/catalog';
import { useCompany } from '../lib/settings';
import { fmtPhone, normPhone, orderLabel, ORDER_STATUS, PAY_METHODS, keptTotal, type Order, type Zone } from '../lib/orders';
import { ACCOUNTS, MOVE_TYPES, addDays, mondayOf, report, today, type AccountId, type Report } from '../lib/money';
import { dayText, daySections, longDate, sectionsDoc, totals, weekDays, weekSections, weekText, type Section } from '../lib/recap';
import { get } from '../lib/db';
import { Badge, Button, Empty, IconButton, PageHead, fmtDate, toast } from '../ui/kit';
import { Icon } from '../ui/icons';
import { PrintDialog } from '../ui/print';

export function RecapPage() {
  const can = useCan();
  const company = useCompany();
  const o = useTable<Order>('orders'); const m = useTable('cashMoves'); const s = useTable('courierSettlements'); useTable('couriers'); useTable('financeCategories');
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(today());
  const withProfit = can('costs.view');
  const monday = mondayOf(date);
  const saturday = addDays(monday, 5);
  const days = useMemo(() => (mode === 'week' ? weekDays(monday) : []), [mode, monday, o, m, s]);
  const end = mode === 'week' ? days[days.length - 1]?.date ?? saturday : date;
  const r = useMemo(() => report(mode === 'week' ? monday : date, end), [mode, date, monday, end, o, m, s]);
  if (!can('treasury.view') && !can('reports.view')) return <Empty icon="lock" title="Accès réservé" />;
  const t = totals(r);
  const step = (n: number) => setDate(addDays(date, mode === 'week' ? 7 * n : n));
  const isFuture = (mode === 'week' ? addDays(monday, 7) : addDays(date, 1)) > today();
  const sections = mode === 'week' ? weekSections(r, days, withProfit) : daySections(r, withProfit);
  const text = mode === 'week' ? weekText(r, days, company, withProfit) : dayText(r, company, withProfit);

  return (
    <>
      <PageHead title="Récapitulatifs" subtitle="Ventes sur place, livraisons, comptes livreurs, paiements et dépenses" />
      <div className="card row" style={{ alignItems: 'center' }}>
        <div className="segmented" role="group" aria-label="Période">
          <button type="button" aria-pressed={mode === 'day'} onClick={() => setMode('day')}>Journée</button>
          <button type="button" aria-pressed={mode === 'week'} onClick={() => setMode('week')}>Semaine (lun. → sam.)</button>
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 6 }}>
          <IconButton icon="chevronLeft" label="Précédent" onClick={() => step(-1)} />
          <strong>{mode === 'week' ? `Du ${fmtDate(monday)} au ${fmtDate(end)}` : longDate(date)}</strong>
          <IconButton icon="chevronRight" label="Suivant" disabled={isFuture} onClick={() => step(1)} />
          <input type="date" className="cell-input" style={{ maxWidth: 160 }} value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Choisir une date" />
          {date !== today() && <Button variant="quiet" onClick={() => setDate(today())}>Aujourd’hui</Button>}
        </div>
      </div>

      <div className="stat-grid">
        <Stat label={`Ventes sur place (${t.walkInCount})`} value={t.walkIn} />
        <Stat label={`Livraisons (${t.delivCount})`} value={t.deliv} />
        <Stat label="Total des ventes" value={r.netSales} strong />
        <Stat label="Mobile Money reçu" value={t.mmIn} />
        <Stat label="Espèces reçues en boutique" value={t.cashIn} />
        <Stat label="Dépenses" value={r.expenses} neg />
        <Stat label={mode === 'week' ? 'Total à verser par les livreurs' : 'À verser par les livreurs'} value={r.courierDue} strong />
        {withProfit && <Stat label="Bénéfice brut" value={r.grossProfit} />}
      </div>

      {mode === 'week' ? <WeekTables days={days} r={r} /> : <DayTables r={r} />}
      <MoneyCard r={r} />
      <Share text={text} title={mode === 'week' ? 'Récapitulatif de la semaine' : 'Récapitulatif du jour'} sub={mode === 'week' ? `${fmtDate(monday)} au ${fmtDate(end)}` : fmtDate(date)} sections={sections} />
    </>
  );
}

function Stat({ label, value, strong, neg }: { label: string; value: number; strong?: boolean; neg?: boolean }) {
  return <div className={`card stat ${strong ? 'stat-strong' : ''}`}><span className="small muted">{label}</span><strong className={`stat-value num ${neg && value ? 'neg' : ''}`}>{fmtAr(value)}</strong></div>;
}

function DayTables({ r }: { r: Report }) {
  const byCourier = new Map<string, typeof r.deliveries>();
  for (const d of r.deliveries) { const k = d.courierId; if (!byCourier.has(k)) byCourier.set(k, []); byCourier.get(k)!.push(d); }
  return (
    <>
      <div className="card card-flush">
        <div className="card-pad row-between"><h2>Ventes sur place</h2><strong className="num">{fmtAr(r.sales.shopAmount)}</strong></div>
        {r.walkIns.length === 0 ? <p className="card-pad small muted">Aucune vente sur place.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Vente</th><th>Heure</th><th className="t-num">Articles</th><th>Paiement</th><th className="t-num">Montant</th></tr></thead>
            <tbody>{r.walkIns.map((o) => (
              <tr key={o.id}><td><a href={`#/commandes/${o.id}`}>{o.number}</a> <span className="muted small">{o.name || ''}</span></td><td>{new Date(o.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="t-num">{o.lines.reduce((s, l) => s + (l.qtyKept ?? l.qty), 0)}</td><td>{[...new Set(o.payments.map((p) => PAY_METHODS[p.method]))].join(' + ') || 'non payé'}</td><td className="t-num">{fmtAr(keptTotal(o) - (o.discount || 0))}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <div className="card card-flush">
        <div className="card-pad row-between"><h2>Livraisons du jour</h2><strong className="num">{fmtAr(r.deliveries.reduce((s, d) => s + d.value, 0))}</strong></div>
        {r.deliveries.length === 0 ? <p className="card-pad small muted">Aucune commande partie ce jour.</p> : [...byCourier.entries()].map(([cid, list]) => (
          <div key={cid}>
            <h3 className="card-pad" style={{ paddingBottom: 0 }}>{cid ? get<any>('couriers', cid)?.name ?? 'Livreur ?' : 'Retirées en boutique'} <span className="muted small">· {list.length} commande(s)</span></h3>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Commande</th><th>Lieu</th><th>État</th><th className="t-num">Client paie</th><th className="t-num">Frais</th><th className="t-num">À verser</th></tr></thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.o.id}>
                    <td><a href={`#/commandes/${d.o.id}`}>{d.o.number}</a> <span className="small muted">{orderLabel(d.o)}</span></td>
                    <td className="small">{get<Zone>('zones', d.o.zoneId || '')?.name}{d.o.place ? ` — ${d.o.place}` : ''}</td>
                    <td><Badge tone={ORDER_STATUS[d.o.status].tone}>{d.o.status === 'out' ? 'Pas encore confirmée' : ORDER_STATUS[d.o.status].label}</Badge>{d.settled && <span className="small pos"> · versée</span>}</td>
                    <td className="t-num">{fmtAr(d.collect)}</td><td className="t-num">{fmtAr(d.fee)}</td><td className="t-num"><strong>{fmtAr(d.net)}</strong></td>
                  </tr>
                ))}
                <tr className="t-total"><td colSpan={3}>Sous-total</td><td className="t-num">{fmtAr(list.reduce((s, d) => s + d.collect, 0))}</td><td className="t-num">{fmtAr(list.reduce((s, d) => s + d.fee, 0))}</td><td className="t-num"><strong>{fmtAr(list.reduce((s, d) => s + d.net, 0))}</strong></td></tr>
              </tbody>
            </table></div>
          </div>
        ))}
      </div>
      <CourierTable r={r} />
    </>
  );
}

function CourierTable({ r, week }: { r: Report; week?: boolean }) {
  return (
    <div className="card card-flush">
      <div className="card-pad"><h2>Comptes livreurs{week ? ' de la semaine' : ''}</h2><p className="small muted">« À verser » = argent des clients − frais du livreur, pour les livraisons {week ? 'de la semaine' : 'du jour'}. « Compte à ce jour » comprend aussi les livraisons non encore versées des jours précédents.</p></div>
      {r.couriers.length === 0 ? <p className="card-pad small muted">Aucun livreur concerné.</p> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Livreur</th><th className="t-num">Livraisons</th><th className="t-num">Client paie</th><th className="t-num">Frais</th><th className="t-num">À verser</th><th className="t-num">Déjà versé</th><th className="t-num">Compte à ce jour</th></tr></thead>
          <tbody>
            {r.couriers.map((c) => (
              <tr key={c.courierId}>
                <td><strong>{c.name}</strong>{c.out ? <div className="small muted">{c.out} pas encore confirmée(s)</div> : null}{c.refused ? <div className="small neg">{c.refused} refusée(s)</div> : null}</td>
                <td className="t-num">{c.count}</td><td className="t-num">{fmtAr(c.collect)}</td><td className="t-num">{fmtAr(c.fees)}</td><td className="t-num"><strong>{fmtAr(c.net)}</strong></td>
                <td className="t-num">{fmtAr(c.paidIn)}</td><td className={`t-num ${c.balance < 0 ? 'neg' : ''}`}><strong>{c.balance >= 0 ? fmtAr(c.balance) : `on lui doit ${fmtAr(-c.balance)}`}</strong></td>
              </tr>
            ))}
            <tr className="t-total"><td>Total</td><td className="t-num">{r.couriers.reduce((s, c) => s + c.count, 0)}</td><td className="t-num">{fmtAr(r.couriers.reduce((s, c) => s + c.collect, 0))}</td><td className="t-num">{fmtAr(r.couriers.reduce((s, c) => s + c.fees, 0))}</td><td className="t-num">{fmtAr(r.couriers.reduce((s, c) => s + c.net, 0))}</td><td className="t-num">{fmtAr(r.couriers.reduce((s, c) => s + c.paidIn, 0))}</td><td className="t-num"><strong>{fmtAr(r.courierDue)}</strong></td></tr>
          </tbody>
        </table></div>
      )}
    </div>
  );
}

function WeekTables({ days, r }: { days: ReturnType<typeof weekDays>; r: Report }) {
  return (
    <>
      <div className="card card-flush">
        <div className="card-pad"><h2>Jour par jour</h2></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Jour</th><th className="t-num">Sur place</th><th className="t-num">Livraisons</th><th className="t-num">Total ventes</th><th className="t-num">Espèces reçues</th><th className="t-num">Mobile Money</th><th className="t-num">Versé par livreurs</th><th className="t-num">Dépenses</th></tr></thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <td><strong>{new Date(`${d.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</strong></td>
                <td className="t-num">{fmtAr(d.t.walkIn)}</td><td className="t-num">{fmtAr(d.t.deliv)}</td><td className="t-num"><strong>{fmtAr(d.r.netSales)}</strong></td>
                <td className="t-num">{fmtAr(d.t.cashIn)}</td><td className="t-num">{fmtAr(d.t.mmIn)}</td><td className="t-num">{fmtAr(d.t.fromCouriers)}</td><td className="t-num neg">{d.t.expenses ? fmtAr(d.t.expenses) : '—'}</td>
              </tr>
            ))}
            <tr className="t-total"><td>Semaine</td>
              {(['walkIn', 'deliv'] as const).map((k) => <td key={k} className="t-num">{fmtAr(days.reduce((s, d) => s + d.t[k], 0))}</td>)}
              <td className="t-num"><strong>{fmtAr(r.netSales)}</strong></td>
              {(['cashIn', 'mmIn', 'fromCouriers'] as const).map((k) => <td key={k} className="t-num">{fmtAr(days.reduce((s, d) => s + d.t[k], 0))}</td>)}
              <td className="t-num neg">{fmtAr(r.expenses)}</td>
            </tr>
          </tbody>
        </table></div>
      </div>
      <CourierTable r={r} week />
      <div className="card stack-s">
        <h2>Fin de semaine : espèces</h2>
        <table className="kv-table"><tbody>
          <tr><td>Caisse espèces (selon TSENA)</td><td>{fmtAr(r.balancesEnd.cash)}</td></tr>
          <tr><td>À verser en espèces par les livreurs</td><td>{fmtAr(r.courierDue)}</td></tr>
          <tr className="total"><td>Total des espèces attendues</td><td>{fmtAr(r.balancesEnd.cash + r.courierDue)}</td></tr>
        </tbody></table>
      </div>
    </>
  );
}

function MoneyCard({ r }: { r: Report }) {
  const accounts: AccountId[] = ['cash', 'mvola', 'orange', 'airtel', 'bank'];
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card stack-s">
        <h2>Paiements reçus</h2>
        <table className="kv-table"><tbody>
          {accounts.filter((a) => a !== 'bank' || r.receipts.bank || r.fromCouriers.bank).map((a) => <tr key={a}><td>{ACCOUNTS[a]}{r.fromCouriers[a] ? <span className="muted small"> (dont versements livreurs {fmtAr(r.fromCouriers[a])})</span> : ''}</td><td>{fmtAr(r.receipts[a] + r.fromCouriers[a])}</td></tr>)}
          <tr className="total"><td>Total reçu</td><td>{fmtAr(accounts.reduce((s, a) => s + r.receipts[a] + r.fromCouriers[a], 0))}</td></tr>
        </tbody></table>
        <h3 style={{ marginTop: 10 }}>Soldes en fin de période</h3>
        <table className="kv-table"><tbody>
          {accounts.filter((a) => a !== 'bank' || r.balancesEnd.bank).map((a) => <tr key={a}><td>{ACCOUNTS[a]}</td><td className={r.balancesEnd[a] < 0 ? 'neg' : ''}>{fmtAr(r.balancesEnd[a])}</td></tr>)}
        </tbody></table>
      </div>
      <div className="card stack-s">
        <h2>Dépenses et autres mouvements</h2>
        {r.expenseMoves.length + r.otherMoves.length === 0 ? <p className="small muted">Aucun.</p> : (
          <table className="kv-table"><tbody>
            {r.expenseMoves.map((m) => <tr key={m.id}><td>{m.label || 'Dépense'} <span className="muted small">· {ACCOUNTS[m.account]}</span></td><td className="neg">− {fmtAr(-m.amount)}</td></tr>)}
            {r.expenseMoves.length > 0 && <tr className="total"><td>Total dépenses</td><td className="neg">− {fmtAr(r.expenses)}</td></tr>}
            {r.otherMoves.map((m) => <tr key={m.id}><td>{m.label || MOVE_TYPES[m.type]} <span className="muted small">· {MOVE_TYPES[m.type]} · {ACCOUNTS[m.account]}</span></td><td className={m.amount < 0 ? 'neg' : 'pos'}>{m.amount < 0 ? '− ' : '+ '}{fmtAr(Math.abs(m.amount))}</td></tr>)}
          </tbody></table>
        )}
      </div>
    </div>
  );
}

function Share({ text, title, sub, sections }: { text: string; title: string; sub: string; sections: Section[] }) {
  const company = useCompany();
  const [print, setPrint] = useState(false);
  const phone = normPhone(company.bossPhone || '');
  const intl = phone ? '261' + phone.replace(/^0/, '') : '';
  const enc = encodeURIComponent(text);
  const nav = navigator as any;
  return (
    <div className="card stack-s">
      <h2>Envoyer au responsable</h2>
      <pre className="recap-text">{text}</pre>
      <div className="row">
        <a className="btn btn-primary" href={`https://wa.me/${intl}?text=${enc}`} target="_blank" rel="noreferrer"><Icon name="share" />WhatsApp{company.bossPhone ? ` (${fmtPhone(company.bossPhone)})` : ''}</a>
        <a className="btn btn-ghost" href={`sms:${phone}${/iPhone|iPad/.test(navigator.userAgent) ? '&' : '?'}body=${enc}`}>SMS</a>
        <a className="btn btn-ghost" href={`mailto:${company.bossEmail || ''}?subject=${encodeURIComponent(`${title} — ${company.name} — ${sub}`)}&body=${enc}`}>E-mail</a>
        {nav.share && <Button variant="ghost" onClick={() => nav.share({ title, text }).catch(() => {})}>Partager (Messenger…)</Button>}
        <Button variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(text); toast('Récapitulatif copié'); } catch { toast('Copie impossible sur cet appareil', 'error'); } }}>Copier</Button>
        <Button variant="ghost" icon="printer" onClick={() => setPrint(true)}>Imprimer / PDF</Button>
      </div>
      {!company.bossPhone && <p className="small muted">Enregistrez le numéro WhatsApp du responsable dans Paramètres → Société pour l’envoyer en un clic.</p>}
      {print && <PrintDialog docs={[{ key: 'recap', label: title, build: () => sectionsDoc(title, sub, sections, company) }]} onClose={() => setPrint(false)} />}
    </div>
  );
}
