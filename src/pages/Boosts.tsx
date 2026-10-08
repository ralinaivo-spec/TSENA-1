// Boosts publicitaires : saisie quotidienne (résultats théoriques Meta + messages réels), suivi par semaine
// (lundi → dimanche) et analyse des performances de chaque boost pour décider lesquels garder ou arrêter.
import { Fragment, useMemo, useState } from 'react';
import { useCan } from '../lib/auth';
import { setMeta, useMeta, useTable } from '../lib/db';
import { fmtNum, parseNum, todayYmd } from '../lib/catalog';
import { addDays, mondayOf } from '../lib/money';
import { useMyScope } from '../lib/scope';
import {
  STOP_REASONS, VERDICT, activeBoosts, allPages, boostName, boostPerformance, boostsOf, checkReading, createBoost, dayStats, nextSlot,
  pageName, prevReading, readingOn, realOn, restartBoost, saveDay, stopBoost, updateBoost, weekDates, type Boost, type BoostPerf,
} from '../lib/boosts';
import { Badge, Button, Empty, IconButton, Modal, PageHead, SelectField, TextField, navigate, toast, useRoute } from '../ui/kit';
import { Icon } from '../ui/icons';
import { SortTable, exportTables, type Col } from '../ui/table';

const TABS = [
  { key: 'saisie', label: 'Saisie du jour', perm: 'boosts.enter' },
  { key: 'semaine', label: 'Semaine', perm: 'boosts.view' },
  { key: 'performance', label: 'Performance des boosts', perm: 'boosts.view' },
];
const usd = (n?: number | null, d = 2) => (n == null || !isFinite(n) ? '—' : `${n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} $`);
const dd = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const dayLong = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const dayShort = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const signed = (n?: number) => (n == null ? '—' : n > 0 ? `+${fmtNum(n)}` : fmtNum(n));

export function BoostsPage() {
  const can = useCan();
  const route = useRoute();
  const tabs = TABS.filter((t) => can(t.perm));
  const cur = tabs.find((t) => route.endsWith('/' + t.key)) ?? tabs[0];
  useTable('boosts'); useTable('boostReadings'); useTable('pageMessages'); useTable('categories'); useTable('orders');
  if (!cur) return <Empty icon="lock" title="Accès réservé" />;
  return (
    <>
      <PageHead title="Boosts publicitaires" subtitle="Résultats théoriques (Meta) comparés aux messages réellement reçus, par page et par boost" />
      <div className="tabs" role="tablist">{tabs.map((t) => <button key={t.key} role="tab" aria-selected={cur.key === t.key} onClick={() => navigate('/boosts/' + t.key)}>{t.label}</button>)}</div>
      {cur.key === 'saisie' && <DayEntry />}
      {cur.key === 'semaine' && <WeekView />}
      {cur.key === 'performance' && <Performance />}
    </>
  );
}

/** Page choisie (mémorisée sur l'appareil). Le vendeur ne voit que ses pages, sauf s'il choisit « Toutes ». */
function usePage(allowAll = false) {
  const scope = useMyScope();
  const pages = allPages().filter((p) => !scope.on || scope.pages.includes(p.id));
  const saved = useMeta<string>('boostPage', '');
  const value = saved === '' && allowAll ? '' : pages.some((p) => p.id === saved) ? saved : pages[0]?.id ?? '';
  const options = [...(allowAll ? [{ value: '', label: 'Toutes les pages' }] : []), ...pages.map((p) => ({ value: p.id, label: p.name }))];
  return { pageId: value, set: (v: string) => setMeta('boostPage', v), options, scope, pages };
}

function DateNav({ date, setDate, step = 1, label }: { date: string; setDate: (d: string) => void; step?: number; label: string }) {
  const today = todayYmd();
  return (
    <div className="row" style={{ alignItems: 'center', gap: 6 }}>
      <IconButton icon="chevronLeft" label="Précédent" onClick={() => setDate(addDays(date, -step))} />
      <strong style={{ minWidth: 170, textAlign: 'center' }}>{label}</strong>
      <IconButton icon="chevronRight" label="Suivant" disabled={addDays(date, step) > today && step === 1} onClick={() => setDate(addDays(date, step))} />
      <input type="date" className="cell-input" style={{ maxWidth: 160 }} value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Choisir une date" />
      {date !== today && <Button variant="quiet" onClick={() => setDate(today)}>Aujourd’hui</Button>}
    </div>
  );
}

// ---------------------------------------------------------------- Saisie du jour
function DayEntry() {
  const pg = usePage();
  const [date, setDate] = useState(todayYmd());
  if (!pg.pages.length) return <div className="card"><Empty icon="tag" title="Aucune page">Créez d’abord les catégories principales (une par page Facebook) dans Articles.</Empty></div>;
  return (
    <div className="stack">
      <div className="card row" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 220 }}><SelectField label="Page" value={pg.pageId} onChange={pg.set} options={pg.options} /></div>
        <DateNav date={date} setDate={setDate} label={dayLong(date)} />
      </div>
      <DayForm key={`${pg.pageId}|${date}`} pageId={pg.pageId} date={date} />
    </div>
  );
}

function DayForm({ pageId, date }: { pageId: string; date: string }) {
  const boosts = activeBoosts(pageId, date);
  const [vals, setVals] = useState<Record<string, { spend: string; messages: string }>>(() => Object.fromEntries(boosts.map((b) => {
    const r = readingOn(b.id, date);
    return [b.id, { spend: r ? String(r.spend).replace('.', ',') : '', messages: r ? String(r.messages) : '' }];
  })));
  const savedReal = realOn(pageId, date);
  const [real, setReal] = useState(savedReal ? String(savedReal.count) : '');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Boost | 'new' | null>(null);
  const [stop, setStop] = useState<Boost | null>(null);
  const [tried, setTried] = useState(false);
  const already = boosts.some((b) => readingOn(b.id, date)) || !!savedReal;

  const rows = boosts.map((b) => {
    const v = vals[b.id] ?? { spend: '', messages: '' };
    const spend = parseNum(v.spend), messages = parseNum(v.messages);
    const prev = prevReading(b.id, date);
    const filled = v.spend.trim() !== '' || v.messages.trim() !== '';
    const errors = filled || tried ? checkReading(b.id, date, spend, messages) : [];
    const newMsgs = messages != null ? messages - (prev?.messages ?? 0) : undefined;
    const newSpend = spend != null ? spend - (prev?.spend ?? 0) : undefined;
    return { b, v, spend, messages, prev, errors, newMsgs, newSpend, filled };
  });
  const theo = rows.reduce((t, r) => t + (r.errors.length || r.newMsgs == null ? 0 : Math.max(0, r.newMsgs)), 0);
  const spendDay = rows.reduce((t, r) => t + (r.errors.length || r.newSpend == null ? 0 : Math.max(0, r.newSpend)), 0);
  const realN = parseNum(real);
  const gap = realN != null ? realN - theo : undefined;
  const orders = dayStats(pageId, date).orders;
  const nErr = rows.filter((r) => r.errors.length).length;
  const set = (id: string, k: 'spend' | 'messages', s: string) => setVals({ ...vals, [id]: { ...vals[id], [k]: s } });

  return (
    <>
      <div className="card card-flush">
        <div className="card-pad row-between">
          <div><h2>Boosts actifs — {pageName(pageId)}</h2>
            <p className="small muted">Recopiez pour chaque boost actif, dans l’ordre de l’Espace Pubs, la <strong>dépense</strong> et le nombre de <strong>conversations</strong> affichés (valeurs cumulées depuis le lancement). Si rien n’a bougé, touchez « = » pour reprendre la valeur précédente.</p></div>
          <Button icon="plus" variant="ghost" onClick={() => setForm('new')}>Nouveau boost</Button>
        </div>
        {boosts.length === 0 ? <Empty icon="megaphone" title="Aucun boost actif ce jour-là"><Button icon="plus" onClick={() => setForm('new')}>Ajouter le boost n° 1</Button></Empty> : (
          <div className="table-wrap"><table className="table boost-table">
            <thead><tr><th style={{ width: 44 }}>N°</th><th>Boost</th><th className="t-num">Saisie précédente</th><th style={{ width: 130 }}>Dépense cumulée ($)</th><th style={{ width: 130 }}>Conversations cumulées</th><th className="t-num">Messages du jour</th><th></th></tr></thead>
            <tbody>{rows.map((r) => (
              <Fragment key={r.b.id}>
                <tr className={r.errors.length ? 'is-choice' : ''}>
                  <td><span className="slot-badge">{r.b.slot}</span></td>
                  <td><strong>{r.b.label || `Boost ${r.b.slot}`}</strong><div className="small muted">lancé le {dd(r.b.startDate)}{r.b.dailyBudget ? ` · ${usd(r.b.dailyBudget)} / jour` : ''}</div></td>
                  <td className="t-num small">{r.prev ? <>{usd(r.prev.spend)} · <strong>{r.prev.messages}</strong> msg<div className="muted">le {dd(r.prev.date)}</div></> : <span className="muted">1re saisie</span>}</td>
                  <td><input className="cell-input" inputMode="decimal" aria-label={`Dépense boost ${r.b.slot}`} aria-invalid={r.errors.some((e) => e.includes('épense'))} value={r.v.spend} placeholder={r.prev ? String(r.prev.spend).replace('.', ',') : '0,00'} onChange={(e) => set(r.b.id, 'spend', e.target.value)} /></td>
                  <td><div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <input className="cell-input" inputMode="numeric" aria-label={`Conversations boost ${r.b.slot}`} aria-invalid={r.errors.some((e) => e.includes('message'))} value={r.v.messages} placeholder={r.prev ? String(r.prev.messages) : '0'} onChange={(e) => set(r.b.id, 'messages', e.target.value)} />
                    {r.prev && <IconButton icon="refresh" label="Pas de changement : reprendre la valeur précédente" onClick={() => setVals({ ...vals, [r.b.id]: { spend: vals[r.b.id]?.spend || String(r.prev!.spend).replace('.', ','), messages: String(r.prev!.messages) } })} />}
                  </div></td>
                  <td className="t-num">{r.newMsgs == null || r.errors.length ? '—' : <strong className={r.newMsgs > 0 ? 'pos' : 'muted'}>{signed(r.newMsgs)}</strong>}{r.newSpend != null && !r.errors.length ? <div className="small muted">{usd(Math.max(0, r.newSpend))}</div> : null}</td>
                  <td className="t-actions"><div className="row" style={{ gap: 2, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                    <IconButton icon="edit" label="Modifier le boost" onClick={() => setForm(r.b)} />
                    <Button variant="quiet" onClick={() => setStop(r.b)}>Arrêter</Button>
                  </div></td>
                </tr>
                {r.errors.length > 0 && <tr className="is-choice"><td></td><td colSpan={6}><span className="small neg">{r.errors.join(' ')}</span></td></tr>}
              </Fragment>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <div className="card stack">
        <div className="grid-2" style={{ alignItems: 'end' }}>
          <TextField label={`Messages réellement reçus sur la page le ${dd(date)}`} value={real} onChange={setReal} inputMode="numeric" error={tried && (realN == null || realN < 0 || !Number.isInteger(realN)) ? 'À saisir (0 si aucun message)' : null}
            hint="Les nouvelles conversations comptées vous-même dans Messenger / Meta Business Suite (messages physiques)." />
          <div className="small muted">Commandes en ligne saisies ce jour pour cette page : <strong>{orders}</strong></div>
        </div>
        <div className="stat-grid">
          <div className="card stat"><span className="small muted">Messages théoriques du jour (boosts)</span><strong className="stat-value num">{fmtNum(theo)}</strong></div>
          <div className="card stat"><span className="small muted">Messages réels</span><strong className="stat-value num">{realN == null ? '—' : fmtNum(realN)}</strong></div>
          <div className={`card stat ${gap != null && gap < 0 ? '' : 'stat-strong'}`}><span className="small muted">Écart (réel − théorique)</span><strong className={`stat-value num ${gap != null && gap < 0 ? 'neg' : ''}`}>{signed(gap)}</strong>{gap != null && theo > 0 && <span className="small muted">réel = {Math.round(((realN ?? 0) / theo) * 100)} % du théorique</span>}</div>
          <div className="card stat"><span className="small muted">Dépense du jour</span><strong className="stat-value num">{usd(spendDay)}</strong>{realN ? <span className="small muted">{usd(spendDay / realN)} par message réel</span> : null}</div>
        </div>
        {nErr > 0 && <div className="notice notice-danger"><Icon name="alert" /><span>{nErr} boost(s) avec une erreur de saisie : corrigez les valeurs en rouge. Une valeur cumulée ne peut pas être plus petite que la précédente.</span></div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button icon="check" busy={busy} disabled={nErr > 0} onClick={async () => {
            setTried(true);
            const missing = rows.filter((r) => r.spend == null || r.messages == null);
            if (missing.length) { toast(`Saisissez tous les boosts actifs (${missing.map((m) => 'n° ' + m.b.slot).join(', ')}), ou arrêtez ceux qui ne sont plus actifs.`, 'error'); return; }
            setBusy(true);
            try { await saveDay(pageId, date, rows.map((r) => ({ boostId: r.b.id, spend: r.spend!, messages: r.messages! })), realN as number); toast(already ? 'Saisie du jour corrigée' : 'Journée enregistrée'); }
            catch (e: any) { toast(e?.message ?? String(e), 'error'); }
            finally { setBusy(false); }
          }}>{already ? 'Enregistrer les corrections' : 'Enregistrer la journée'}</Button>
        </div>
      </div>

      <StoppedList pageId={pageId} />
      {form && <BoostForm pageId={pageId} boost={form === 'new' ? undefined : form} date={date} onClose={() => setForm(null)} />}
      {stop && <StopModal boost={stop} date={date} onClose={() => setStop(null)} />}
    </>
  );
}

function StoppedList({ pageId }: { pageId: string }) {
  const stopped = boostsOf(pageId).filter((b) => b.status === 'stopped').sort((a, b) => (b.stoppedOn ?? '').localeCompare(a.stoppedOn ?? '')).slice(0, 8);
  if (!stopped.length) return null;
  return (
    <details className="card card-flush">
      <summary className="card-pad" style={{ cursor: 'pointer' }}><strong>Boosts arrêtés ({stopped.length})</strong></summary>
      <ul className="list">{stopped.map((b) => (
        <li key={b.id} className="list-item">
          <div className="list-item-main"><span className="list-item-title">{boostName(b)}</span><p className="small muted">du {dd(b.startDate)} au {dd(b.stoppedOn ?? b.startDate)} · {b.stopReason}</p></div>
          <Button variant="quiet" onClick={async () => { try { await restartBoost(b); toast('Boost réactivé'); } catch (e: any) { toast(e.message, 'error'); } }}>Réactiver</Button>
        </li>
      ))}</ul>
    </details>
  );
}

function BoostForm({ pageId, boost, date, onClose }: { pageId: string; boost?: Boost; date: string; onClose: () => void }) {
  const [slot, setSlot] = useState(String(boost?.slot ?? nextSlot(pageId)));
  const [label, setLabel] = useState(boost?.label ?? '');
  const [start, setStart] = useState(boost?.startDate ?? date);
  const [budget, setBudget] = useState(boost?.dailyBudget != null ? String(boost.dailyBudget).replace('.', ',') : '1');
  const [busy, setBusy] = useState(false);
  const n = parseNum(slot);
  const other = boost && n != null ? boostsOf(pageId).find((x) => x.id !== boost.id && x.status === 'active' && x.slot === n) : undefined;
  return (
    <Modal title={boost ? `Modifier le boost n° ${boost.slot}` : `Nouveau boost — ${pageName(pageId)}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button busy={busy} disabled={!n || n < 1 || !start} onClick={async () => {
        setBusy(true);
        try {
          const d = { slot: n!, label: label.trim() || undefined, startDate: start, dailyBudget: parseNum(budget) };
          if (boost) await updateBoost(boost, d); else await createBoost({ pageId, ...d });
          toast(boost ? 'Boost modifié' : 'Boost ajouté'); onClose();
        } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
      }}>{boost ? 'Enregistrer' : 'Ajouter le boost'}</Button></>}>
      <div className="stack">
        <p className="small">Seuls les boosts <strong>actifs</strong> sont enregistrés. Le numéro est la position du boost dans la liste de l’Espace Pubs (1 = le premier en haut), pour le retrouver facilement.</p>
        <div className="grid-2">
          <TextField label="N° du boost" value={slot} onChange={setSlot} inputMode="numeric" hint={other ? `Le n° ${n} est déjà pris par « ${boostName(other)} » : les deux numéros seront échangés.` : undefined} />
          <TextField label="Date de lancement" type="date" value={start} onChange={setStart} max={todayYmd()} />
        </div>
        <TextField label="Texte de la publicité (pour la reconnaître)" value={label} onChange={setLabel} placeholder="Ex. SUPER PROMOTION pyjamas" />
        <TextField label="Budget par jour ($)" value={budget} onChange={setBudget} inputMode="decimal" />
      </div>
    </Modal>
  );
}

function StopModal({ boost, date, onClose }: { boost: Boost; date: string; onClose: () => void }) {
  const [on, setOn] = useState(date);
  const [reason, setReason] = useState(STOP_REASONS[0]);
  const [note, setNote] = useState('');
  return (
    <Modal title={`Arrêter ${boostName(boost)}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="danger" onClick={async () => { await stopBoost(boost, on, [reason, note.trim()].filter(Boolean).join(' — ')); toast('Boost arrêté'); onClose(); }}>Arrêter le boost</Button></>}>
      <div className="stack">
        <p className="small">À faire quand le boost n’est plus actif dans l’Espace Pubs. Il ne sera plus demandé à la saisie après cette date ; ses résultats restent dans l’historique.</p>
        <div className="grid-2">
          <TextField label="Dernier jour actif" type="date" value={on} onChange={setOn} />
          <SelectField label="Raison" value={reason} onChange={setReason} options={STOP_REASONS.map((r) => ({ value: r, label: r }))} />
        </div>
        <TextField label="Note (facultatif)" value={note} onChange={setNote} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Semaine (lundi → dimanche)
function WeekView() {
  const pg = usePage(true);
  const [date, setDate] = useState(todayYmd());
  const monday = mondayOf(date);
  const days = weekDates(monday);
  const label = `Semaine du ${dd(monday)} au ${dd(days[6])}`;
  return (
    <div className="stack">
      <div className="card row" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 220 }}><SelectField label="Page" value={pg.pageId} onChange={pg.set} options={pg.options} /></div>
        <DateNav date={monday} setDate={setDate} step={7} label={label} />
      </div>
      {pg.pageId ? <PageWeek pageId={pg.pageId} days={days} /> : <AllPagesWeek pageIds={pg.pages.map((p) => p.id)} days={days} />}
    </div>
  );
}

function PageWeek({ pageId, days }: { pageId: string; days: string[] }) {
  const stats = days.map((d) => dayStats(pageId, d));
  const boosts = boostsOf(pageId).filter((b) => days.some((d) => stats[days.indexOf(d)].perBoost.has(b.id)) || days.some((d) => b.startDate <= d && (b.status === 'active' || (b.stoppedOn ?? '') >= d)))
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || a.slot - b.slot);
  const sum = (f: (s: (typeof stats)[number]) => number | undefined) => stats.reduce((t, s) => t + (f(s) ?? 0), 0);
  const theoW = sum((s) => s.theo), realW = sum((s) => s.real), spendW = sum((s) => s.spend), ordersW = sum((s) => s.orders);
  const hasReal = stats.some((s) => s.real != null);
  const cell = (n: number | undefined, cls = '') => <td className={`t-num ${cls}`}>{n == null ? <span className="muted">—</span> : fmtNum(n)}</td>;
  const exp = () => exportTables(`boosts_${pageName(pageId)}_${days[0]}.xlsx`, [{
    name: 'Semaine',
    cols: [{ key: 'l', label: 'Ligne', value: (r: any) => r.l, width: 30 }, ...days.map((d, i) => ({ key: d, label: dayShort(d), value: (r: any) => r.v[i] ?? '', width: 12 })), { key: 't', label: 'Total semaine', value: (r: any) => r.t, width: 14 }],
    rows: [
      ...boosts.map((b) => ({ l: boostName(b), v: stats.map((s) => s.perBoost.get(b.id)), t: stats.reduce((t, s) => t + (s.perBoost.get(b.id) ?? 0), 0) })),
      { l: 'Total théorique', v: stats.map((s) => s.theo), t: theoW }, { l: 'Réel (compté)', v: stats.map((s) => s.real), t: realW },
      { l: 'Écart (réel − théo)', v: stats.map((s) => s.gap), t: realW - theoW }, { l: 'Dépense ($)', v: stats.map((s) => Math.round(s.spend * 100) / 100), t: Math.round(spendW * 100) / 100 },
      { l: 'Commandes en ligne', v: stats.map((s) => s.orders), t: ordersW },
    ],
  }]);
  return (
    <>
      <div className="stat-grid">
        <div className="card stat"><span className="small muted">Messages théoriques (semaine)</span><strong className="stat-value num">{fmtNum(theoW)}</strong></div>
        <div className="card stat"><span className="small muted">Messages réels (semaine)</span><strong className="stat-value num">{hasReal ? fmtNum(realW) : '—'}</strong></div>
        <div className="card stat stat-strong"><span className="small muted">Écart (réel − théorique)</span><strong className={`stat-value num ${realW - theoW < 0 ? 'neg' : ''}`}>{hasReal ? signed(realW - theoW) : '—'}</strong>{hasReal && theoW > 0 && <span className="small muted">réel = {Math.round((realW / theoW) * 100)} % du théorique</span>}</div>
        <div className="card stat"><span className="small muted">Dépense (semaine)</span><strong className="stat-value num">{usd(spendW)}</strong>{realW ? <span className="small muted">{usd(spendW / realW)} par message réel</span> : null}</div>
        <div className="card stat"><span className="small muted">Commandes en ligne</span><strong className="stat-value num">{fmtNum(ordersW)}</strong>{realW ? <span className="small muted">{Math.round((ordersW / realW) * 100)} % des messages réels</span> : null}</div>
      </div>
      <div className="card card-flush">
        <div className="card-pad row-between"><div><h2>{pageName(pageId)} — messages par jour</h2><p className="small muted">Nouveaux messages théoriques de chaque boost (écart entre deux saisies), puis le total comparé au réel compté.</p></div><Button variant="ghost" icon="download" onClick={exp}>Excel</Button></div>
        <div className="table-wrap"><table className="table week-table">
          <thead><tr><th>Boost</th>{days.map((d) => <th key={d} className="t-num">{dayShort(d)}</th>)}<th className="t-num">Semaine</th></tr></thead>
          <tbody>
            {boosts.length === 0 && <tr><td colSpan={9} className="small muted">Aucun boost cette semaine.</td></tr>}
            {boosts.map((b) => {
              const tot = stats.reduce((t, s) => t + (s.perBoost.get(b.id) ?? 0), 0);
              return <tr key={b.id} style={{ opacity: b.status === 'active' ? 1 : .65 }}><td><span className="slot-badge">{b.slot}</span> {b.label || `Boost ${b.slot}`}{b.status === 'stopped' && <span className="small muted"> (arrêté le {dd(b.stoppedOn!)})</span>}</td>
                {stats.map((s, i) => { const active = days[i] >= b.startDate && (b.status === 'active' || (b.stoppedOn ?? '') >= days[i]); const v = s.perBoost.get(b.id); return <td key={i} className={`t-num ${v == null && active && days[i] <= todayYmd() ? 'cell-missing' : ''}`}>{v == null ? <span className="muted">{active && days[i] <= todayYmd() ? 'à saisir' : '·'}</span> : fmtNum(v)}</td>; })}
                <td className="t-num"><strong>{fmtNum(tot)}</strong></td></tr>;
            })}
            <tr className="synth-total"><td>Total théorique</td>{stats.map((s, i) => <Fragment key={i}>{cell(s.entered ? s.theo : undefined)}</Fragment>)}<td className="t-num">{fmtNum(theoW)}</td></tr>
            <tr className="synth-total"><td>Réel (compté)</td>{stats.map((s, i) => <Fragment key={i}>{cell(s.real)}</Fragment>)}<td className="t-num">{hasReal ? fmtNum(realW) : '—'}</td></tr>
            <tr><td><strong>Écart (réel − théo)</strong></td>{stats.map((s, i) => <td key={i} className={`t-num ${s.gap != null && s.gap < 0 ? 'neg' : ''}`}>{signed(s.gap)}</td>)}<td className={`t-num ${realW - theoW < 0 ? 'neg' : ''}`}><strong>{hasReal ? signed(realW - theoW) : '—'}</strong></td></tr>
            <tr><td>Dépense</td>{stats.map((s, i) => <td key={i} className="t-num small">{s.entered ? usd(s.spend) : '—'}</td>)}<td className="t-num small">{usd(spendW)}</td></tr>
            <tr><td>Coût par message réel</td>{stats.map((s, i) => <td key={i} className="t-num small">{s.real ? usd(s.spend / s.real) : '—'}</td>)}<td className="t-num small">{realW ? usd(spendW / realW) : '—'}</td></tr>
            <tr><td>Commandes en ligne</td>{stats.map((s, i) => <Fragment key={i}>{cell(s.orders)}</Fragment>)}<td className="t-num">{fmtNum(ordersW)}</td></tr>
          </tbody>
        </table></div>
      </div>
    </>
  );
}

function AllPagesWeek({ pageIds, days }: { pageIds: string[]; days: string[] }) {
  type Row = { id: string; name: string; theo: number; real: number; hasReal: boolean; spend: number; orders: number; active: number; daysTheo: number[]; daysReal: (number | undefined)[] };
  const rows: Row[] = pageIds.map((id) => {
    const st = days.map((d) => dayStats(id, d));
    return { id, name: pageName(id), theo: st.reduce((t, s) => t + s.theo, 0), real: st.reduce((t, s) => t + (s.real ?? 0), 0), hasReal: st.some((s) => s.real != null), spend: st.reduce((t, s) => t + s.spend, 0), orders: st.reduce((t, s) => t + s.orders, 0), active: activeBoosts(id, days[6] > todayYmd() ? todayYmd() : days[6]).length, daysTheo: st.map((s) => s.theo), daysReal: st.map((s) => s.real) };
  }).filter((r) => r.theo || r.hasReal || r.active || r.orders);
  const cols: Col<Row>[] = [
    { key: 'n', label: 'Page', value: (r) => r.name, render: (r) => <a href="#/boosts/semaine" onClick={() => setMeta('boostPage', r.id)}>{r.name}</a> },
    { key: 'a', label: 'Boosts actifs', value: (r) => r.active, num: true, total: true },
    { key: 't', label: 'Messages théo.', value: (r) => r.theo, num: true, total: true },
    { key: 'r', label: 'Messages réels', value: (r) => r.real, num: true, total: true },
    { key: 'g', label: 'Écart (réel − théo)', value: (r) => r.real - r.theo, num: true, total: true, render: (r) => <span className={r.real - r.theo < 0 ? 'neg' : ''}>{r.hasReal ? signed(r.real - r.theo) : '—'}</span> },
    { key: 'p', label: 'Réel / théo.', value: (r) => (r.theo ? Math.round((r.real / r.theo) * 100) : 0), num: true, render: (r) => (r.theo && r.hasReal ? `${Math.round((r.real / r.theo) * 100)} %` : '—'), total: (rs) => { const t = rs.reduce((a, r) => a + r.theo, 0); return t ? `${Math.round((rs.reduce((a, r) => a + r.real, 0) / t) * 100)} %` : '—'; } },
    { key: 's', label: 'Dépense ($)', value: (r) => Math.round(r.spend * 100) / 100, num: true, total: true },
    { key: 'c', label: 'Coût / message réel ($)', value: (r) => (r.real ? Math.round((r.spend / r.real) * 100) / 100 : 0), num: true, render: (r) => (r.real ? usd(r.spend / r.real) : '—') },
    { key: 'o', label: 'Commandes en ligne', value: (r) => r.orders, num: true, total: true },
  ];
  const dayTot = days.map((_, i) => ({ theo: rows.reduce((t, r) => t + r.daysTheo[i], 0), real: rows.reduce((t, r) => t + (r.daysReal[i] ?? 0), 0), has: rows.some((r) => r.daysReal[i] != null) }));
  return (
    <>
      <div className="card card-flush">
        <div className="card-pad row-between"><div><h2>Toutes les pages — semaine</h2><p className="small muted">Touchez une page pour voir le détail de ses boosts.</p></div><Button variant="ghost" icon="download" onClick={() => exportTables(`boosts_pages_${days[0]}.xlsx`, [{ name: 'Pages', cols, rows }])}>Excel</Button></div>
        <SortTable cols={cols} rows={rows} rowKey={(r) => r.id} initialSort={{ key: 'r', desc: true }} empty="Aucune saisie cette semaine." />
      </div>
      <div className="card card-flush">
        <div className="card-pad"><h2>Total par jour (toutes les pages)</h2></div>
        <div className="table-wrap"><table className="table week-table">
          <thead><tr><th></th>{days.map((d) => <th key={d} className="t-num">{dayShort(d)}</th>)}<th className="t-num">Semaine</th></tr></thead>
          <tbody>
            <tr><td>Théorique</td>{dayTot.map((d, i) => <td key={i} className="t-num">{fmtNum(d.theo)}</td>)}<td className="t-num"><strong>{fmtNum(dayTot.reduce((t, d) => t + d.theo, 0))}</strong></td></tr>
            <tr><td>Réel</td>{dayTot.map((d, i) => <td key={i} className="t-num">{d.has ? fmtNum(d.real) : '—'}</td>)}<td className="t-num"><strong>{fmtNum(dayTot.reduce((t, d) => t + d.real, 0))}</strong></td></tr>
            <tr className="synth-total"><td>Écart</td>{dayTot.map((d, i) => <td key={i} className={`t-num ${d.real - d.theo < 0 ? 'neg' : ''}`}>{d.has ? signed(d.real - d.theo) : '—'}</td>)}<td className="t-num">{signed(dayTot.reduce((t, d) => t + d.real - d.theo, 0))}</td></tr>
          </tbody>
        </table></div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Performance
function Performance() {
  const pg = usePage(true);
  const [to, setTo] = useState(todayYmd());
  const [span, setSpan] = useState('7');
  const from = addDays(to, -(Number(span) - 1));
  const rows = useMemo(() => boostPerformance(from, to, pg.pageId || undefined).filter((r) => !pg.scope.on || pg.scope.pages.includes(r.b.pageId)), [from, to, pg.pageId, pg.scope.on]);
  const order: Record<string, number> = { bad: 0, average: 1, good: 2, new: 3, none: 4 };
  const active = rows.filter((r) => r.b.status === 'active').sort((a, b) => order[a.verdict] - order[b.verdict] || (b.cost ?? 0) - (a.cost ?? 0));
  const stopped = rows.filter((r) => r.b.status !== 'active');
  const cols: Col<BoostPerf>[] = [
    { key: 'p', label: 'Page', value: (r) => pageName(r.b.pageId), hide: !!pg.pageId },
    { key: 'n', label: 'Boost', value: (r) => r.b.slot, render: (r) => <><span className="slot-badge">{r.b.slot}</span> {r.b.label || ''}<div className="small muted">lancé le {dd(r.b.startDate)} · {r.days} j{r.b.stoppedOn ? ` · arrêté le ${dd(r.b.stoppedOn)}` : ''}</div></> },
    { key: 'm', label: `Messages théo. (${span} j)`, value: (r) => r.messages, num: true, total: true },
    { key: 's', label: `Dépense (${span} j)`, value: (r) => Math.round(r.spend * 100) / 100, num: true, total: (rs) => usd(rs.reduce((t, r) => t + r.spend, 0)), render: (r) => usd(r.spend) },
    { key: 'c', label: 'Coût / message', value: (r) => (r.cost == null ? 9999 : Math.round(r.cost * 100) / 100), num: true, render: (r) => usd(r.cost), total: (rs) => { const m = rs.reduce((t, r) => t + r.messages, 0); return m ? usd(rs.reduce((t, r) => t + r.spend, 0) / m) : '—'; } },
    { key: 'l', label: '3 derniers jours', value: (r) => r.last3, num: true },
    { key: 'tt', label: 'Depuis le lancement', value: (r) => r.totalMessages, num: true, render: (r) => <span className="small">{r.totalMessages} msg · {usd(r.totalSpend)}</span> },
    { key: 'v', label: 'Avis', value: (r) => order[r.verdict], render: (r) => <div><Badge tone={VERDICT[r.verdict].tone}>{VERDICT[r.verdict].label}</Badge>{r.advice && <div className="small muted" style={{ maxWidth: 280 }}>{r.advice}</div>}</div> },
  ];
  const bad = active.filter((r) => r.verdict === 'bad');
  return (
    <div className="stack">
      <div className="card row" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ minWidth: 220 }}><SelectField label="Page" value={pg.pageId} onChange={pg.set} options={pg.options} /></div>
          <div style={{ minWidth: 160 }}><SelectField label="Période" value={span} onChange={setSpan} options={[{ value: '7', label: '7 derniers jours' }, { value: '14', label: '14 derniers jours' }, { value: '30', label: '30 derniers jours' }]} /></div>
        </div>
        <TextField label="Jusqu’au" type="date" value={to} onChange={(v) => v && setTo(v)} max={todayYmd()} />
      </div>
      {bad.length > 0 && <div className="notice notice-danger"><Icon name="alert" /><span><strong>{bad.length} boost(s) peu performant(s)</strong> : {bad.map((r) => `${pg.pageId ? '' : pageName(r.b.pageId) + ' '}n° ${r.b.slot}`).join(', ')}. Pensez à les arrêter dans l’Espace Pubs et à lancer un nouveau boost à la place (puis notez-le dans « Saisie du jour »).</span></div>}
      <div className="card card-flush">
        <div className="card-pad row-between"><div><h2>Boosts actifs</h2><p className="small muted">Du {dd(from)} au {dd(to)}. Les plus faibles en premier.</p></div><Button variant="ghost" icon="download" onClick={() => exportTables(`performance_boosts_${to}.xlsx`, [{ name: 'Boosts', cols: [...cols.filter((c) => !c.hide), { key: 'x', label: 'Conseil', value: (r: BoostPerf) => r.advice, width: 50 }], rows: [...active, ...stopped] }])}>Excel</Button></div>
        <SortTable cols={cols} rows={active} rowKey={(r) => r.b.id} empty="Aucun boost actif sur la période." />
      </div>
      {stopped.length > 0 && <div className="card card-flush"><div className="card-pad"><h2>Boosts arrêtés pendant la période</h2></div><SortTable cols={cols} rows={stopped} rowKey={(r) => r.b.id} /></div>}
      <div className="card small muted stack-s">
        <strong>Comment l’avis est calculé</strong>
        <p>Pour chaque boost : coût par message = dépense ÷ nouveaux messages théoriques sur la période. Il est comparé au coût moyen des boosts de la même page (ou de toutes les pages s’il est seul).</p>
        <p><Badge tone="ok">Bon</Badge> au moins 20 % moins cher que la moyenne · <Badge tone="warn">Moyen</Badge> proche de la moyenne · <Badge tone="danger">Faible</Badge> au moins 30 % plus cher, ou aucun message depuis 3 jours, ou des dépenses sans message · <Badge tone="brand">Trop récent</Badge> moins de 3 saisies.</p>
        <p>L’écart réel − théorique se lit par page (onglet Semaine) : Meta compte les conversations ouvertes grâce à la pub, le réel compte tous les messages reçus.</p>
      </div>
    </div>
  );
}
