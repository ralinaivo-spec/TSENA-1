// Notifications à l'écran : bandeau en haut des pages (les plus importantes) et cloche avec la liste complète.
// × = « plus tard » : la notification revient après 1 h (urgente), 2 h (importante) ou 5 h (information).
import { useEffect, useState } from 'react';
import { LEVEL_LABEL, SNOOZE_H, snooze, unsnooze, useNotifications, type Notif } from '../lib/notify';
import { PayDue } from '../pages/Expenses';
import { Button, IconButton, Modal } from './kit';
import { Icon } from './icons';

function useTick() { const [, set] = useState(0); useEffect(() => { const t = setInterval(() => set((x) => x + 1), 60_000); return () => clearInterval(t); }, []); }

function Item({ n, onPay, compact }: { n: Notif & { until?: string }; onPay: (n: Notif) => void; compact?: boolean }) {
  return (
    <div className={`notif notif-${n.level} ${n.until ? 'is-snoozed' : ''}`}>
      <Icon name={n.level === 'info' ? 'cloud' : n.level === 'urgent' ? 'alert' : 'bell'} />
      <div className="notif-main">
        <strong>{n.title}</strong>
        {n.text && <span className="small">{n.text}</span>}
        {n.until && <span className="small muted">Reportée — revient à {new Date(n.until).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      <div className="notif-actions">
        {n.due && n.due.r.kind === 'expense' && <Button onClick={() => onPay(n)}>Payer</Button>}
        {n.href && <a className="btn btn-ghost" href={n.href}>Ouvrir</a>}
        {n.until ? <Button variant="quiet" onClick={() => unsnooze(n.id)}>Réafficher</Button> : <>
          {!compact && <Button variant="quiet" onClick={() => snooze(n.id, 'today')}>Pas aujourd’hui</Button>}
          <IconButton icon="x" label={`Fermer (revient dans ${SNOOZE_H[n.level]} h)`} onClick={() => snooze(n.id, SNOOZE_H[n.level])} />
        </>}
      </div>
    </div>
  );
}

/** Bandeau : au plus 3 notifications non reportées. */
export function NotifBar() {
  useTick();
  const list = useNotifications().filter((n) => !n.until);
  const [pay, setPay] = useState<Notif | null>(null);
  // Sur téléphone, une seule (la plus importante) pour laisser la place à la page ; les autres sont dans la cloche.
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 600px)').matches);
  useEffect(() => { const m = matchMedia('(max-width: 600px)'); const f = () => setNarrow(m.matches); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f); }, []);
  if (!list.length) return null;
  const max = narrow ? 1 : 3;
  return (
    <div className="notif-bar" role="status">
      {list.slice(0, max).map((n) => <Item key={n.id} n={n} onPay={setPay} compact />)}
      {list.length > max && <p className="small muted notif-more"><Icon name="bell" size={14} /> + {list.length - max} autre(s) notification(s) : touchez la cloche en haut.</p>}
      {pay?.due && <PayDue d={pay.due} onClose={() => setPay(null)} />}
    </div>
  );
}

/** Cloche avec le nombre de notifications actives et la liste complète. */
export function NotifBell() {
  useTick();
  const all = useNotifications();
  const active = all.filter((n) => !n.until);
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState<Notif | null>(null);
  return (
    <>
      <button type="button" className="bell" aria-label={`Notifications (${active.length})`} onClick={() => setOpen(true)}>
        <Icon name="bell" />{active.length > 0 && <span className={`bell-count ${active.some((n) => n.level === 'urgent') ? 'is-urgent' : ''}`}>{active.length}</span>}
      </button>
      {open && (
        <Modal title="Notifications" onClose={() => setOpen(false)}>
          {all.length === 0 ? <p className="small muted">Rien à signaler.</p> : (
            <div className="stack-s">
              {(['urgent', 'important', 'info'] as const).map((lv) => all.some((n) => n.level === lv) && (
                <div key={lv} className="stack-s"><strong className="small">{LEVEL_LABEL[lv]} <span className="muted">(× : revient dans {SNOOZE_H[lv]} h)</span></strong>
                  {all.filter((n) => n.level === lv).map((n) => <Item key={n.id} n={n} onPay={setPay} />)}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      {pay?.due && <PayDue d={pay.due} onClose={() => setPay(null)} />}
    </>
  );
}
