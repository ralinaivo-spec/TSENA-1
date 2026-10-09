// Accueil : tableau de bord adapté au rôle (chiffres de la période, trésorerie, stock, livreurs, meilleurs articles).
import { useMemo } from 'react';
import { setMeta } from '../lib/db';
import { fmtAr } from '../lib/catalog';
import { ACCOUNTS, balances, courierBalance, today as todayYmd, type AccountId } from '../lib/money';
import { bucketFor, groupBy, kpis, pendingPurchases, previousPeriod, productLabel, salesLedger, series, stockValue, dormant } from '../lib/analytics';
import { PeriodPicker, defaultPeriod, type Period } from '../ui/period';
import { BarChart } from '../ui/chart';
import { Delta } from './Reports';
import { useMyScope } from '../lib/scope';
import type { Courier } from '../lib/orders';
import { managesOwnPassword, roleOf, SUPERADMIN_ID, useCan, useCurrentUser, type User, useMe } from '../lib/auth';
import { useMeta, useTable } from '../lib/db';
import type { Order } from '../lib/orders';
import { DEFAULT_COMPANY, useCompany } from '../lib/settings';
import { useSyncStatus } from '../lib/sync';
import { PageHead, timeAgo } from '../ui/kit';
import { Icon } from '../ui/icons';

export function DashboardPage() {
  const me = useMe();
  const can = useCan();
  const company = useCompany();
  const users = useTable<User>('users');
  const orders = useTable<Order>('orders');
  const scope = useMyScope();
  const status = useSyncStatus();
  const cloud = useMeta('cloud', null);
  const lastFile = useMeta<string | null>('lastFileBackup', null);
  const lastCloud = useMeta<string | null>('lastCloudBackup', null);
  const lastBackup = [lastFile, lastCloud].filter(Boolean).sort().pop() ?? undefined;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const team = users.filter((u) => u.id !== SUPERADMIN_ID && u.active);

  const steps = [
    { done: company.name !== DEFAULT_COMPANY.name || !!company.logo, title: 'Personnaliser la société', text: 'Nom, logo, couleur, téléphone pour les tickets.', href: '#/parametres/societe', perm: 'settings.company' },
    { done: !!cloud, title: 'Relier cet appareil au cloud', text: 'Pour partager les données entre tous les appareils et les mettre à l’abri.', href: '#/parametres/cloud', perm: 'backup.manage' },
    { done: team.length > 0, title: "Créer les comptes de l'équipe", text: 'Vendeurs, propriétaire, magasinier : chacun avec son rôle.', href: '#/utilisateurs', perm: 'users.manage' },
    { done: !!lastBackup, title: 'Faire une première sauvegarde', text: 'Un fichier à garder en lieu sûr.', href: '#/parametres/sauvegarde', perm: 'backup.manage' },
  ].filter((s) => can(s.perm));
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      <PageHead title={`${hello}, ${me.fullName.split(' ')[0]}`} subtitle={<span style={{ textTransform: 'capitalize' }}>{today}</span>} />
      {managesOwnPassword(me) && (me.mustChangePassword || !me.secretAnswerHash) && (
        <div className="notice">
          <Icon name="key" />
          <span>
            {me.mustChangePassword ? 'Votre compte utilise encore le mot de passe provisoire. ' : ''}
            {!me.secretAnswerHash ? 'Aucune question secrète n’est définie. ' : ''}
            <a href="#/compte">Régler maintenant dans Mon compte</a>
          </span>
        </div>
      )}

      {can('cashday.use') && (
        <div className="card row-between daycash-shortcut">
          <div><h3>Caisse du jour</h3><p className="small muted">Saisir une dépense de la caisse commune ou envoyer le récapitulatif global du jour.</p></div>
          <div className="row" style={{ gap: 8 }}>
            <a className="btn btn-ghost" href="#/caisse-du-jour"><Icon name="wallet" />Dépense</a>
            <a className="btn btn-primary" href="#/caisse-du-jour"><Icon name="share" />Récap WhatsApp</a>
          </div>
        </div>
      )}

      {can('orders.create') && (
        <div className="stat-grid">
          {([['new', 'À confirmer', 'confirmer'], ['confirmed', 'À préparer', 'preparer'], ['ready', 'Prêtes à livrer', 'pretes'], ['out', 'En livraison', 'livraison']] as const).map(([st, label, tab]) => (
            <a key={st} className="card stat" href={`#/commandes/${tab}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="muted small">{label}</span>
              <span className="stat-value">{orders.filter((o) => o.status === st && scope.mine(o)).length}</span>
            </a>
          ))}
        </div>
      )}
      <div className="grid-2">
        {can('users.manage') && (
          <a className="card stat" href="#/utilisateurs" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="muted small">Comptes actifs dans l'équipe</span>
            <span className="stat-value">{team.length}</span>
            <span className="small muted">Mots de passe donnés par vous</span>
          </a>
        )}
        <div className="card stat">
          <span className="muted small">Synchronisation</span>
          <span className="stat-value" style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name={status.state === 'ok' ? 'cloud' : status.state === 'off' ? 'database' : 'cloudOff'} size={26} />
            {{ ok: 'À jour', syncing: 'En cours…', offline: 'Hors connexion', error: 'Problème', off: 'Cet appareil seul' }[status.state]}
          </span>
          <span className="small muted">
            {status.state === 'off' ? 'Les données restent sur cet appareil.' : `Dernière fois ${timeAgo(status.lastSync)}${status.pending ? ` · ${status.pending} en attente` : ''}`}
          </span>
        </div>
        {can('backup.manage') && (
          <div className="card stat">
            <span className="muted small">Dernière sauvegarde</span>
            <span className="stat-value" style={{ fontSize: '1.4rem' }}>{lastBackup ? timeAgo(lastBackup) : 'Aucune'}</span>
            <span className="small muted">Les données sont aussi enregistrées sur l'appareil à chaque action.</span>
          </div>
        )}
      </div>

      {(can('reports.view') || can('treasury.view')) ? <ManagerBoard /> : can('orders.create') ? <SellerBoard name={me.fullName} /> : null}

      {steps.length > 0 && doneCount < steps.length && (
        <div className="card stack">
          <div className="row-between">
            <div><h2>Mise en route</h2><p className="muted small">{doneCount} sur {steps.length} terminées</p></div>
          </div>
          <ol className="checklist">
            {steps.map((s, i) => (
              <li key={s.title} className={s.done ? 'step-done' : ''}>
                <a href={s.href}>
                  <span className="step-mark">{s.done ? <Icon name="check" size={16} /> : i + 1}</span>
                  <span className="list-item-main">
                    <span className="step-title" style={{ fontWeight: 700, display: 'block' }}>{s.title}</span>
                    <span className="small muted">{s.text}</span>
                  </span>
                  <Icon name="chevronRight" />
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!can('users.manage') && (
        <div className="card stack-s">
          <h2>Votre espace</h2>
          <p className="muted">Vous êtes connecté(e) en tant que <strong>{roleOf(me)?.name}</strong>. {roleOf(me)?.description}</p>
        </div>
      )}
    </>
  );
}

const pct = (n: number) => (n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';

function usePeriod() {
  const saved = useMeta<Period | null>('dashPeriod', null);
  const p = saved?.key && saved.key !== 'custom' ? defaultPeriod(saved.key) : saved ?? defaultPeriod('today');
  return [p, (v: Period) => setMeta('dashPeriod', v)] as const;
}

function ManagerBoard() {
  const can = useCan();
  const cost = can('costs.view');
  const orders = useTable<Order>('orders'); const moves = useTable('cashMoves'); useTable('variants'); useTable('stockMoves'); useTable('purchases'); useTable('courierSettlements');
  const couriers = useTable<Courier>('couriers');
  const [period, setPeriod] = usePeriod();
  const from = period.from ?? '2000-01-01', to = period.to ?? todayYmd();
  const lines = useMemo(() => salesLedger(from, to), [from, to, orders, moves]);
  const k = kpis(lines, from, to);
  const prev = previousPeriod(from, to);
  const kp = useMemo(() => kpis(salesLedger(prev.from, prev.to), prev.from, prev.to), [prev.from, prev.to, orders, moves]);
  const bucket = bucketFor(from, to);
  const pts = series(lines, from, to, bucket);
  const top = groupBy(lines, (l) => l.productId, productLabel).slice(0, 5);
  const bal = balances();
  const stock = stockValue();
  const purchases = pendingPurchases();
  const courierDue = couriers.reduce((t, c) => t + Math.max(0, courierBalance(c.id).due), 0);
  const out = orders.filter((o) => o.status === 'out');
  const dorm = useMemo(() => dormant(60).slice(0, 5), [orders]);
  const tiles = [
    { label: "Chiffre d'affaires", value: fmtAr(k.revenue), cur: k.revenue, prev: kp.revenue, show: true },
    { label: 'Bénéfice brut', value: fmtAr(k.gross), cur: k.gross, prev: kp.gross, show: cost },
    { label: 'Dépenses', value: fmtAr(k.expenses), cur: k.expenses, prev: kp.expenses, show: true, invert: true },
    { label: k.net >= 0 ? 'Bénéfice net' : 'Perte nette', value: fmtAr(k.net), cur: k.net, prev: kp.net, show: cost, strong: true },
    { label: 'Taux de marge', value: pct(k.margin), cur: k.margin, prev: kp.margin, show: cost, isPct: true },
    { label: `Ventes (${k.shopOrders} sur place · ${k.onlineOrders} en ligne)`, value: String(k.orders), cur: k.orders, prev: kp.orders, show: true },
    { label: 'Panier moyen', value: fmtAr(k.avgBasket), cur: k.avgBasket, prev: kp.avgBasket, show: true },
    { label: 'Taux de retour', value: pct(k.returnRate), cur: k.returnRate, prev: kp.returnRate, show: true, isPct: true, invert: true },
  ].filter((t) => t.show);
  return (
    <>
      <div className="card row-between"><PeriodPicker value={period} onChange={setPeriod} />{can('reports.view') && <a className="btn btn-ghost" href="#/rapports">Tous les rapports</a>}</div>
      <div className="stat-grid">
        {tiles.map((t) => (
          <div key={t.label} className={`card stat ${t.strong ? 'stat-strong' : ''}`}>
            <span className="small muted">{t.label}</span>
            <strong className={`stat-value num ${t.cur < 0 ? 'neg' : ''}`}>{t.value}</strong>
            <span className="small muted"><Delta cur={t.cur} prev={t.prev} pct={t.isPct} invert={t.invert} /> vs période précédente</span>
          </div>
        ))}
      </div>
      <div className="card stack-s">
        <h2>{cost ? 'Bénéfice net' : "Chiffre d'affaires"} par {bucket === 'hour' ? 'heure' : bucket === 'day' ? 'jour' : 'mois'}</h2>
        <BarChart title="Évolution" bars={pts.map((p) => ({ key: p.key, label: p.label, long: p.long, value: cost ? p.gross - p.expenses : p.revenue, extra: `${p.orders} vente(s) · CA ${fmtAr(p.revenue)}` }))} format={fmtAr} />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        {can('treasury.view') && (
          <a className="card stack-s" href="#/tresorerie" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h2>Trésorerie</h2>
            <table className="kv-table"><tbody>
              {(['cash', 'mvola', 'orange', 'airtel', 'bank'] as AccountId[]).filter((a) => a !== 'bank' || bal.bank).map((a) => <tr key={a}><td>{ACCOUNTS[a]}</td><td className={bal[a] < 0 ? 'neg' : ''}>{fmtAr(bal[a])}</td></tr>)}
              <tr><td>À verser par les livreurs</td><td>{fmtAr(courierDue)}</td></tr>
              <tr className="total"><td>Total</td><td>{fmtAr(Object.values(bal).reduce((t, v) => t + v, 0) + courierDue)}</td></tr>
            </tbody></table>
          </a>
        )}
        <div className="card stack-s">
          <h2>Stock et arrivages</h2>
          <table className="kv-table"><tbody>
            <tr><td>Pièces en stock</td><td>{stock.pieces.toLocaleString('fr-FR')}</td></tr>
            {cost && <tr><td>Valeur du stock (coût)</td><td>{fmtAr(stock.value)}</td></tr>}
            <tr><td>Valeur du stock (prix de vente)</td><td>{fmtAr(stock.retail)}</td></tr>
            <tr><td>Arrivages en attente</td><td>{purchases.count} commande(s) · {purchases.pieces.toLocaleString('fr-FR')} pcs</td></tr>
            {cost && purchases.unpaidAr > 0 && <tr><td>Reste à payer aux fournisseurs</td><td>{fmtAr(purchases.unpaidAr)}</td></tr>}
            <tr><td>En livraison maintenant</td><td>{out.length} commande(s)</td></tr>
          </tbody></table>
        </div>
        <div className="card stack-s">
          <h2>Meilleurs articles</h2>
          {top.length === 0 ? <p className="small muted">Aucune vente sur la période.</p> : (
            <table className="kv-table"><tbody>{top.map((g) => <tr key={g.key}><td>{g.label} <span className="muted small">· {g.qty} pcs</span></td><td>{fmtAr(g.revenue)}</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="card stack-s">
          <h2>Articles dormants</h2>
          <p className="small muted">En stock, aucune vente depuis 60 jours.</p>
          {dorm.length === 0 ? <p className="small muted">Aucun.</p> : (
            <table className="kv-table"><tbody>{dorm.map((d) => <tr key={d.p.id}><td>{d.p.name} <span className="muted small">· {d.p.code}</span></td><td>{d.qty} pcs</td></tr>)}</tbody></table>
          )}
        </div>
      </div>
    </>
  );
}

/** Vendeur : ses propres ventes de la période (sans les marges). */
function SellerBoard({ name }: { name: string }) {
  const orders = useTable<Order>('orders');
  const [period, setPeriod] = usePeriod();
  const from = period.from ?? '2000-01-01', to = period.to ?? todayYmd();
  const lines = useMemo(() => salesLedger(from, to).filter((l) => l.userName === name), [from, to, orders, name]);
  const k = kpis(lines);
  const pts = series(lines, from, to, bucketFor(from, to));
  return (
    <>
      <div className="card"><PeriodPicker value={period} onChange={setPeriod} /></div>
      <div className="stat-grid">
        <div className="card stat"><span className="small muted">Mes ventes</span><strong className="stat-value num">{k.orders}</strong><span className="small muted">{k.shopOrders} sur place · {k.onlineOrders} en ligne</span></div>
        <div className="card stat"><span className="small muted">Montant vendu</span><strong className="stat-value num">{fmtAr(k.revenue)}</strong></div>
        <div className="card stat"><span className="small muted">Pièces</span><strong className="stat-value num">{k.pieces}</strong></div>
      </div>
      {lines.length > 0 && <div className="card stack-s"><h2>Mes ventes dans le temps</h2><BarChart title="Mes ventes" bars={pts.map((p) => ({ key: p.key, label: p.label, long: p.long, value: p.revenue, extra: `${p.orders} vente(s)` }))} format={fmtAr} /></div>}
    </>
  );
}
