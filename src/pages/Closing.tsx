// Clôture de journée (« Z de caisse ») et récapitulatif pour le patron.
import { useMemo, useState } from 'react';
import { useCan } from '../lib/auth';
import { useTable } from '../lib/db';
import { fmtAr, parseNum } from '../lib/catalog';
import { useCompany } from '../lib/settings';
import { normPhone, type Courier, type Order } from '../lib/orders';
import { ACCOUNTS, NOTES, closeDay, courierBalance, dayStats, endOf, getClosing, reopenDay, today, type AccountId, type Closing, type DayStats } from '../lib/money';
import { recapDoc, recapLines, recapText } from '../lib/recap';
import { Badge, Button, Confirm, Empty, PageHead, SelectField, TextField, fmtDate, fmtDateTime, toast } from '../ui/kit';
import { Icon } from '../ui/icons';
import { PrintDialog } from '../ui/print';

const MOBILE: AccountId[] = ['mvola', 'orange', 'airtel', 'bank'];

export function ClosingPage() {
  const can = useCan();
  const company = useCompany();
  const ordersT = useTable<Order>('orders'); const movesT = useTable('cashMoves'); const settT = useTable('courierSettlements'); useTable<Courier>('couriers');
  const closings = useTable<Closing>('closings');
  const [date, setDate] = useState(today());
  const closing = getClosing(date);
  const live = useMemo(() => dayStats(date), [date, closings, ordersT, movesT, settT]);
  const stats = closing?.stats ?? live;
  const canClose = can('closing.do');
  const withProfit = can('costs.view');
  if (!canClose && !can('reports.view') && !can('treasury.view')) return <Empty icon="lock" title="Accès réservé" />;
  const recent = [...closings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  return (
    <>
      <PageHead title="Clôture de journée" subtitle="Comptage de la caisse, vérification des soldes et récapitulatif pour le patron" />
      <div className="card row" style={{ alignItems: 'flex-end' }}>
        <div style={{ maxWidth: 220 }}><TextField label="Journée" type="date" value={date} max={today()} onChange={(v) => v && setDate(v)} /></div>
        {closing ? <Badge tone="ok">Clôturée le {fmtDateTime(closing.closedAt)} par {closing.closedBy}</Badge> : <Badge tone="warn">Pas encore clôturée</Badge>}
        {recent.length > 0 && <div className="row" style={{ gap: 6 }}>{recent.map((c) => <button key={c.id} className="chip" aria-pressed={c.date === date} onClick={() => setDate(c.date)}>{fmtDate(c.date).slice(0, 5)}</button>)}</div>}
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <DayFigures s={stats} closing={closing} withProfit={withProfit} />
        <Recap s={stats} closing={closing} withProfit={withProfit} />
      </div>

      {closing ? <ClosedView c={closing} /> : canClose ? <CloseForm date={date} s={live} /> : <div className="card"><p className="small muted">La clôture est faite par l’admin ou le gérant.</p></div>}
    </>
  );
}

function DayFigures({ s, closing, withProfit }: { s: DayStats; closing?: Closing; withProfit: boolean }) {
  return (
    <div className="card stack-s">
      <h2>Chiffres de la journée{closing ? '' : ' (en direct)'}</h2>
      {recapLines(s, closing, withProfit).map((sec) => (
        <div key={sec.title}>
          <h3 className="small muted" style={{ margin: '10px 0 2px' }}>{sec.title}</h3>
          <table className="kv-table"><tbody>
            {sec.lines.map((l) => <tr key={l.label} className={l.strong ? 'total' : ''}><td className={l.sub ? 'sub' : ''}>{l.label}</td><td>{l.value}</td></tr>)}
          </tbody></table>
        </div>
      ))}
      {s.expensesByCat.length > 0 && <p className="small muted">Dépenses : {s.expensesByCat.map((e) => `${e.name} ${fmtAr(e.amount)}`).join(' · ')}</p>}
      <p className="small muted">Les articles partis chez un livreur (hors choix) comptent comme vendus le jour du départ ; ce qui revient ensuite est compté en « retour » le jour du retour. Les frais de livraison ({fmtAr(s.courierFees)} aujourd’hui) appartiennent aux livreurs et ne sont pas dans les ventes.</p>
    </div>
  );
}

function Recap({ s, closing, withProfit }: { s: DayStats; closing?: Closing; withProfit: boolean }) {
  const company = useCompany();
  const [print, setPrint] = useState(false);
  const text = recapText(s, closing, company, withProfit);
  const phone = normPhone(company.bossPhone || '');
  const intl = phone ? '261' + phone.replace(/^0/, '') : '';
  const enc = encodeURIComponent(text);
  const nav = navigator as any;
  return (
    <div className="card stack-s">
      <div className="row-between"><h2>Récapitulatif pour le patron</h2>{!closing && <Badge tone="warn">provisoire</Badge>}</div>
      <pre className="recap-text">{text}</pre>
      <div className="row">
        <a className="btn btn-primary" href={`https://wa.me/${intl}?text=${enc}`} target="_blank" rel="noreferrer"><Icon name="share" />WhatsApp</a>
        <a className="btn btn-ghost" href={`sms:${phone}${/iPhone|iPad/.test(navigator.userAgent) ? '&' : '?'}body=${enc}`}>SMS</a>
        <a className="btn btn-ghost" href={`mailto:${company.bossEmail || ''}?subject=${encodeURIComponent(`Récap ${company.name} du ${fmtDate(s.date)}`)}&body=${enc}`}>E-mail</a>
        {nav.share && <Button variant="ghost" onClick={() => nav.share({ title: `Récap du ${fmtDate(s.date)}`, text }).catch(() => {})}>Partager (Messenger…)</Button>}
        <Button variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(text); toast('Récapitulatif copié'); } catch { toast('Copie impossible sur cet appareil', 'error'); } }}>Copier</Button>
        <Button variant="ghost" icon="printer" onClick={() => setPrint(true)}>Imprimer / PDF</Button>
      </div>
      {!company.bossPhone && <p className="small muted">Astuce : enregistrez le numéro WhatsApp et l’e-mail du patron dans Paramètres → Société pour l’envoyer en un clic.</p>}
      {print && <PrintDialog docs={[{ key: 'recap', label: 'Récapitulatif', build: () => recapDoc(s, closing, company, withProfit) }]} onClose={() => setPrint(false)} />}
    </div>
  );
}

function CloseForm({ date, s }: { date: string; s: DayStats }) {
  const couriers = useTable<Courier>('couriers');
  const orders = useTable<Order>('orders');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [coins, setCoins] = useState('');
  const [mobile, setMobile] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const counted = NOTES.reduce((t, n) => t + n * (parseNum(notes[n]) || 0), 0) + (parseNum(coins) || 0);
  const theoretical = s.balancesEnd.cash;
  const touched = Object.values(notes).some(Boolean) || !!coins;
  const gap = counted - theoretical;
  const mobileGaps = MOBILE.filter((a) => mobile[a] !== undefined && mobile[a] !== '' && (parseNum(mobile[a]) ?? 0) !== s.balancesEnd[a]);
  const needReason = (touched && gap !== 0) || mobileGaps.length > 0;
  const end = endOf(date);
  const cd = couriers.map((c) => ({ c, b: courierBalance(c.id, end) })).filter((x) => x.b.due || x.b.outOrders);
  const pending = date === today() ? orders.filter((o) => ['new', 'confirmed', 'ready'].includes(o.status)).length : 0;
  const shownMobile = MOBILE.filter((a) => a !== 'bank' || s.balancesEnd.bank);

  return (
    <div className="card stack">
      <h2>Clôturer la journée du {fmtDate(date)}</h2>

      <section className="stack-s">
        <h3>1. Comptez les espèces dans la caisse</h3>
        <div className="count-grid">
          {NOTES.map((n) => (
            <label key={n} className="count-cell"><span>{n.toLocaleString('fr-FR')} ×</span><input inputMode="numeric" aria-label={`Billets de ${n} Ar`} value={notes[n] ?? ''} onChange={(e) => setNotes({ ...notes, [n]: e.target.value.replace(/\D/g, '') })} placeholder="0" /></label>
          ))}
          <label className="count-cell"><span>Pièces (Ar)</span><input inputMode="numeric" aria-label="Pièces" value={coins} onChange={(e) => setCoins(e.target.value.replace(/\D/g, ''))} placeholder="0" /></label>
        </div>
        <table className="kv-table"><tbody>
          <tr><td>Espèces théoriques (selon TSENA)</td><td>{fmtAr(theoretical)}</td></tr>
          <tr><td>Espèces comptées</td><td>{touched ? fmtAr(counted) : '—'}</td></tr>
          <tr className="total"><td>Écart</td><td className={!touched ? '' : gap > 0 ? 'pos' : gap < 0 ? 'neg' : ''}>{touched ? `${gap > 0 ? '+' : gap < 0 ? '−' : ''}${fmtAr(Math.abs(gap))}${gap > 0 ? ' (en trop)' : gap < 0 ? ' (manque)' : ' ✓'}` : '—'}</td></tr>
        </tbody></table>
      </section>

      <section className="stack-s">
        <h3>2. Vérifiez les soldes mobile money</h3>
        <p className="small muted">Regardez le solde sur chaque téléphone. Laissez vide si vous ne pouvez pas vérifier.</p>
        <div className="grid-2">
          {shownMobile.map((a) => (
            <TextField key={a} label={`${ACCOUNTS[a]} — théorique ${fmtAr(s.balancesEnd[a])}`} value={mobile[a] ?? ''} onChange={(v) => setMobile({ ...mobile, [a]: v })} inputMode="numeric" placeholder="Solde réel (facultatif)"
              hint={mobile[a] ? `Écart : ${fmtAr((parseNum(mobile[a]) || 0) - s.balancesEnd[a])}` : undefined} />
          ))}
        </div>
      </section>

      <section className="stack-s">
        <h3>3. Ce qui reste chez les livreurs</h3>
        {cd.length === 0 ? <p className="small muted">Rien : tous les livreurs sont à jour.</p> : (
          <table className="kv-table"><tbody>
            {cd.map(({ c, b }) => <tr key={c.id}><td>{c.name}{b.outOrders ? <span className="muted"> · {b.outOrders} commande(s), {b.outPieces} pièce(s) dehors</span> : ''}</td><td className={b.due < 0 ? 'neg' : ''}>{b.due > 0 ? `doit ${fmtAr(b.due)}` : b.due < 0 ? `à lui verser ${fmtAr(-b.due)}` : '—'}</td></tr>)}
          </tbody></table>
        )}
        <p className="small muted">Les règlements se font dans Livraisons → Livreurs → « Régler ».</p>
      </section>

      {pending > 0 && <div className="notice"><Icon name="alert" /><span>{pending} commande(s) pas encore parties (à confirmer, à préparer ou prêtes) : elles seront comptées le jour où elles partiront.</span></div>}

      <section className="stack-s">
        <h3>4. Validez</h3>
        {needReason && <SelectField label="Motif de l’écart" value={reason} onChange={setReason} options={[{ value: '', label: 'Choisir…' }, ...['Erreur de monnaie rendue', 'Vente non saisie', 'Dépense non saisie', 'Erreur de comptage', 'Frais Mobile Money', 'Inconnu (à vérifier)'].map((r) => ({ value: r, label: r }))]} />}
        {!touched && <p className="small neg">Comptez d’abord les espèces (mettez 0 si la caisse est vide).</p>}
        <div className="row"><Button icon="lock" disabled={!touched || (needReason && !reason)} onClick={() => setConfirm(true)}>Clôturer la journée</Button></div>
        <p className="small muted">Après la clôture, la journée est verrouillée : seuls l’admin et le gérant peuvent y corriger une dépense ou la rouvrir. Les écarts sont enregistrés pour que la caisse de demain parte du montant compté.</p>
      </section>

      {confirm && <Confirm title={`Clôturer le ${fmtDate(date)} ?`} confirmLabel="Clôturer" onClose={() => setConfirm(false)}
        message={<p>Caisse comptée : <strong>{fmtAr(counted)}</strong>{gap ? <> (écart {gap > 0 ? '+' : '−'}{fmtAr(Math.abs(gap))})</> : ' — aucun écart'}.</p>}
        onConfirm={async () => {
          setBusy(true);
          try {
            await closeDay(date, { notes: Object.fromEntries(NOTES.map((n) => [n, parseNum(notes[n]) || 0])), coins: parseNum(coins) || 0, reason: reason || undefined, mobileActual: Object.fromEntries(MOBILE.map((a) => [a, mobile[a] ? parseNum(mobile[a]) : undefined])) });
            toast('Journée clôturée. Envoyez le récapitulatif au patron.');
            window.scrollTo(0, 0);
          } finally { setBusy(false); }
        }} />}
      {busy && <p className="small muted">Clôture en cours…</p>}
    </div>
  );
}

function ClosedView({ c }: { c: Closing }) {
  const can = useCan();
  const [reopen, setReopen] = useState(false);
  const [why, setWhy] = useState('');
  return (
    <div className="card stack-s">
      <h2>Caisse comptée</h2>
      <table className="kv-table"><tbody>
        {NOTES.filter((n) => c.cash.notes[n]).map((n) => <tr key={n}><td className="sub">{c.cash.notes[n]} × {n.toLocaleString('fr-FR')} Ar</td><td>{fmtAr(n * c.cash.notes[n])}</td></tr>)}
        {c.cash.coins > 0 && <tr><td className="sub">Pièces</td><td>{fmtAr(c.cash.coins)}</td></tr>}
        <tr><td>Théorique</td><td>{fmtAr(c.cash.theoretical)}</td></tr>
        <tr><td>Comptée</td><td>{fmtAr(c.cash.counted)}</td></tr>
        <tr className="total"><td>Écart{c.cash.reason ? ` — ${c.cash.reason}` : ''}</td><td className={c.cash.gap < 0 ? 'neg' : c.cash.gap > 0 ? 'pos' : ''}>{fmtAr(c.cash.gap)}</td></tr>
        {(Object.entries(c.mobile) as [AccountId, NonNullable<Closing['mobile'][AccountId]>][]).map(([a, m]) => <tr key={a}><td>{ACCOUNTS[a]} {m.actual != null ? `(vérifié, écart ${fmtAr(m.gap ?? 0)})` : '(non vérifié)'}</td><td>{fmtAr(m.actual ?? m.theoretical)}</td></tr>)}
      </tbody></table>
      {can('users.manage') && <div className="row"><Button variant="quiet" icon="refresh" onClick={() => setReopen(true)}>Rouvrir la journée</Button></div>}
      {reopen && <Confirm title="Rouvrir cette journée ?" danger confirmLabel="Rouvrir" onClose={() => setReopen(false)}
        message={<div className="stack"><p>Les écarts enregistrés à la clôture seront annulés. Il faudra la clôturer à nouveau.</p><TextField label="Motif (obligatoire)" value={why} onChange={setWhy} /></div>}
        onConfirm={async () => { if (!why.trim()) { toast('Indiquez un motif', 'error'); return; } await reopenDay(c.date, why.trim()); toast('Journée rouverte'); }} />}
    </div>
  );
}
