// Point d'entrée : ouvre la base locale, prépare les comptes, lance la synchro, affiche l'application.
import { createRoot } from 'react-dom/client';
import './styles.css';
import { getMeta, newId, openDb, setMeta } from './lib/db';
import { seedAccounts } from './lib/auth';
import { seedZones } from './lib/orders';
import { startSync } from './lib/sync';
import { App } from './App';

declare global {
  const __APP_VERSION__: string;
  const __BUILD_DATE__: string;
}

const root = createRoot(document.getElementById('root')!);

function guessDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Téléphone Android' : 'Tablette Android';
  if (/Windows/.test(ua)) return 'Ordinateur Windows';
  if (/Mac/.test(ua)) return 'Mac';
  return 'Appareil';
}

async function boot() {
  try {
    await openDb();
    if (!getMeta('deviceId')) {
      await setMeta('deviceId', newId());
      await setMeta('deviceName', guessDeviceName());
    }
    await seedAccounts();
    await seedZones();
    startSync();
    root.render(<App />);
  } catch (e: any) {
    root.render(
      <div className="splash">
        <div className="card stack" style={{ maxWidth: 440, margin: 20 }}>
          <h2>Impossible d'ouvrir les données</h2>
          <p>{e?.message || String(e)}</p>
          <p className="small muted">Si vous êtes en navigation privée, ouvrez TSENA dans une fenêtre normale.</p>
          <button className="btn btn-primary" onClick={() => location.reload()}>Réessayer</button>
        </div>
      </div>
    );
  }
}
boot();
