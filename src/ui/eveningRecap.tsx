// Raccourci « Récap du soir » : chaque vendeur (droit « Caisse du jour ») peut envoyer le récapitulatif WhatsApp du jour
// avant de partir. Le bouton ouvre Caisse du jour directement sur « 3. Vérifier puis envoyer ».
// À partir de l'heure du soir (16 h), tant que personne n'a envoyé le récap du jour, le raccourci est mis en évidence.
import { useEffect, useState } from 'react';
import { all, useTable } from '../lib/db';
import { useCan } from '../lib/auth';
import { today } from '../lib/money';
import { Icon } from './icons';

export const RECAP_HREF = '#/caisse-du-jour/envoyer';
export const EVENING_HOUR = 16;

/** Fait défiler Caisse du jour jusqu'à « 3. Vérifier puis envoyer » (après le retour en haut du changement d'écran). */
export function scrollToRecap() {
  let n = 0;
  const go = () => { const el = document.querySelector('.daycash-send'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); else if (n++ < 10) setTimeout(go, 100); };
  setTimeout(go, 300);
}

interface AuditRow { at: string; action: string; entity?: string; entityId?: string; userName?: string; details?: string }

/** Dernier envoi du récap pour ce jour (par n'importe quel vendeur), ou null. */
export function recapSent(ymd: string): AuditRow | null {
  let last: AuditRow | null = null;
  for (const a of all<AuditRow>('audit')) {
    if (a.action !== 'Récapitulatif du jour envoyé') continue;
    if (a.entity === 'dayRecap' ? a.entityId !== ymd : !(a.at || '').startsWith(ymd)) continue;
    if (!last || a.at > last.at) last = a;
  }
  return last;
}

function useHour() {
  const [h, setH] = useState(() => new Date().getHours());
  useEffect(() => { const t = setInterval(() => setH(new Date().getHours()), 60_000); return () => clearInterval(t); }, []);
  return h;
}

/** État du récap du jour pour l'utilisateur courant : afficher le raccourci ? le mettre en évidence ? déjà envoyé ? */
export function useEveningRecap() {
  const can = useCan();
  useTable('audit');
  const hour = useHour();
  const sent = recapSent(today());
  const allowed = can('cashday.use');
  return { allowed, sent, due: allowed && !sent && hour >= EVENING_HOUR };
}

const hm = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Bouton compact (barre du haut sur téléphone, bas du menu sur ordinateur). */
export function RecapShortcut({ compact }: { compact?: boolean }) {
  const s = useEveningRecap();
  if (!s.allowed) return null;
  const title = s.sent ? `Récap du jour envoyé à ${hm(s.sent.at)} par ${s.sent.userName ?? '—'}` : 'Envoyer le récap du soir par WhatsApp';
  return (
    <a className={`recap-shortcut ${s.due ? 'is-due' : ''} ${s.sent ? 'is-sent' : ''} ${compact ? 'is-compact' : ''}`} href={RECAP_HREF} title={title} aria-label={title} onClick={() => { if (location.hash === RECAP_HREF) scrollToRecap(); }}>
      <Icon name={s.sent ? 'check' : 'share'} size={compact ? 18 : 16} />
      <span>{compact ? 'Récap' : s.sent ? 'Récap envoyé' : 'Récap du soir'}</span>
    </a>
  );
}

/** Bandeau du tableau de bord, le soir, tant que le récap n'est pas parti. */
export function EveningRecapBanner() {
  const s = useEveningRecap();
  if (!s.due) return null;
  return (
    <div className="notice evening-recap" role="status">
      <Icon name="share" />
      <div style={{ flex: 1 }}><strong>Avant de partir : envoyez le récap du soir</strong>
        <div className="small">Vérifiez les ventes et les dépenses du jour, puis envoyez le récapitulatif par WhatsApp au gérant et au patron.</div></div>
      <a className="btn btn-primary btn-wa" href={RECAP_HREF}><Icon name="share" />Envoyer le récap</a>
    </div>
  );
}

export { hm as recapTime };
