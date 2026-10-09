// Page d'installation : à l'ouverture du lien dans le navigateur, propose d'installer l'application
// (bouton sur Android et ordinateur, petit tutoriel sur iPhone). Ne s'affiche plus une fois installée.
import { useEffect, useState } from 'react';
import { useCompany } from '../lib/settings';
import { Button } from '../ui/kit';
import { Icon } from '../ui/icons';
import { BrandLogo } from './Auth';

const g = window as any;
// L'événement d'installation arrive tôt : on le garde pour le bouton.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); g.__installEvt = e; window.dispatchEvent(new Event('tsena-install-ready')); });
  window.addEventListener('appinstalled', () => { g.__installEvt = null; try { localStorage.setItem('installDone', '1'); } catch { /* */ } });
}
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || g.navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

/** Faut-il montrer la page d'installation ? (pas en mode installé, pas déjà passée, pas en développement sauf ?install) */
export function wantsInstallPage() {
  if (/[?&]install\b/.test(location.search)) return true;
  if (location.hostname === 'localhost' || isStandalone()) return false;
  return !read('installSkip') && !read('installDone');
}

export function InstallScreen({ onSkip }: { onSkip: () => void }) {
  const company = useCompany();
  const [evt, setEvt] = useState<any>(g.__installEvt ?? null);
  const [done, setDone] = useState(false);
  useEffect(() => { const f = () => setEvt(g.__installEvt); window.addEventListener('tsena-install-ready', f); return () => window.removeEventListener('tsena-install-ready', f); }, []);
  const skip = () => { try { localStorage.setItem('installSkip', '1'); } catch { /* */ } onSkip(); };
  const ios = isIOS();
  return (
    <div className="install">
      <div className="install-card">
        <div className="login-badge"><BrandLogo /></div>
        <h1>Trésor en ligne</h1>
        <p className="muted">{company.name !== 'Trésor en ligne' ? `${company.name} — ` : ''}ventes, livraisons, stock et caisse, même sans connexion.</p>
        {done ? <div className="notice notice-ok"><Icon name="check" /><span>Installation lancée : ouvrez désormais l’application depuis son icône sur l’écran d’accueil.</span></div>
          : ios ? (
            <ol className="install-steps">
              <li><span className="install-n">1</span><span>Touchez le bouton <strong>Partager</strong> <Icon name="share" size={18} /> en bas de Safari.</span></li>
              <li><span className="install-n">2</span><span>Choisissez <strong>« Sur l’écran d’accueil »</strong>.</span></li>
              <li><span className="install-n">3</span><span>Touchez <strong>Ajouter</strong> : l’icône apparaît sur l’écran d’accueil.</span></li>
            </ol>
          ) : evt ? (
            <Button icon="download" onClick={async () => { evt.prompt(); const r = await evt.userChoice.catch(() => null); if (r?.outcome === 'accepted') { setDone(true); try { localStorage.setItem('installDone', '1'); } catch { /* */ } } }}>Installer Trésor en ligne</Button>
          ) : (
            <ol className="install-steps">
              <li><span className="install-n">1</span><span>Ouvrez le menu <strong>⋮</strong> de Chrome (en haut à droite).</span></li>
              <li><span className="install-n">2</span><span>Choisissez <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.</span></li>
              <li><span className="install-n">3</span><span>Confirmez : l’icône apparaît sur l’écran d’accueil ou le bureau.</span></li>
            </ol>
          )}
        <p className="small muted">Une fois installée, l’application s’ouvre directement depuis son icône, en plein écran, et fonctionne hors connexion.</p>
        <button type="button" className="link-btn" onClick={skip}>Continuer dans le navigateur</button>
      </div>
    </div>
  );
}
