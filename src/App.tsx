// Structure de l'application : démarrage, accès, menu adapté au rôle, pages.
import { useEffect, useState, type ReactNode } from 'react';
import { usePrintStationWorker } from './lib/print';
import { TreasuryPage } from './pages/Treasury';
import { ClosingPage } from './pages/Closing';
import { managesOwnPassword, roleOf, useCan, useCurrentUser, logout, useMe } from './lib/auth';
import { getMeta, setMeta, useMeta } from './lib/db';
import { useApplyAppearance, useCompany } from './lib/settings';
import { syncNow, useSyncStatus } from './lib/sync';
import { autoCloudBackup } from './lib/backup';
import { Icon, type IconName } from './ui/icons';
import { Button, IconButton, Toasts, navigate, useRoute } from './ui/kit';
import { BrandLogo, FirstSetupScreen, LockScreen, LoginScreen } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { RolesPage } from './pages/Roles';
import { AuditPage } from './pages/Audit';
import { SettingsPage } from './pages/Settings';
import { AccountPage } from './pages/Account';
import { ProductsPage } from './pages/Products';
import { StockPage } from './pages/Stock';
import { PurchasesPage } from './pages/Purchases';
import { ReceptionsPage } from './pages/Receptions';
import { ImportPage } from './pages/Import';
import { OrdersPage } from './pages/Orders';
import { DeliveriesPage } from './pages/Deliveries';
import { CustomersPage } from './pages/Customers';
import { PosPage } from './pages/Pos';

interface NavItem { path: string; label: string; icon: IconName; perm?: string; group: string; page: () => ReactNode; mobile?: boolean }

const NAV: NavItem[] = [
  { path: '/', label: 'Accueil', icon: 'home', group: '', page: () => <DashboardPage />, mobile: true },
  { path: '/vente', label: 'Vente sur place', icon: 'store', perm: 'pos.sell', group: 'Ventes', page: () => <PosPage />, mobile: true },
  { path: '/commandes', label: 'Commandes clients', icon: 'list', perm: 'orders.create', group: 'Ventes', page: () => <OrdersPage />, mobile: true },
  { path: '/livraisons', label: 'Livraisons', icon: 'truck', perm: 'deliveries.manage', group: 'Ventes', page: () => <DeliveriesPage />, mobile: true },
  { path: '/clients', label: 'Clients', icon: 'users', perm: 'orders.create', group: 'Ventes', page: () => <CustomersPage /> },
  { path: '/articles', label: 'Articles', icon: 'tag', perm: 'catalog.view', group: 'Stock', page: () => <ProductsPage /> },
  { path: '/stock', label: 'Stock', icon: 'package', perm: 'catalog.view', group: 'Stock', page: () => <StockPage /> },
  { path: '/achats', label: 'Achats Chine', icon: 'inbox', perm: 'purchases.manage', group: 'Achats', page: () => <PurchasesPage /> },
  { path: '/receptions', label: 'Réceptions', icon: 'download', perm: 'purchases.receive', group: 'Achats', page: () => <ReceptionsPage /> },
  { path: '/tresorerie', label: 'Trésorerie', icon: 'wallet', perm: 'treasury.view', group: 'Argent', page: () => <TreasuryPage /> },
  { path: '/cloture', label: 'Clôture de journée', icon: 'lock', perm: 'treasury.view', group: 'Argent', page: () => <ClosingPage /> },
  { path: '/utilisateurs', label: 'Utilisateurs', icon: 'users', perm: 'users.manage', group: 'Administration', page: () => <UsersPage /> },
  { path: '/roles', label: 'Rôles et accès', icon: 'shield', perm: 'users.manage', group: 'Administration', page: () => <RolesPage /> },
  { path: '/journal', label: "Journal d'activité", icon: 'list', perm: 'audit.view', group: 'Administration', page: () => <AuditPage /> },
  { path: '/import', label: 'Import Excel', icon: 'fileSheet', perm: 'catalog.edit', group: 'Réglages', page: () => <ImportPage /> },
  { path: '/parametres', label: 'Paramètres', icon: 'settings', group: 'Réglages', page: () => <SettingsPage /> },
  { path: '/compte', label: 'Mon compte', icon: 'user', group: 'hidden', page: () => <AccountPage /> },
];

export function App() {
  useApplyAppearance();
  const user = useCurrentUser();
  const company = useCompany();
  const [locked, setLocked] = useState(false);
  const setupSkipped = useMeta<boolean>('setupSkipped', false);

  // Verrouillage automatique après inactivité.
  useEffect(() => {
    if (!user) return;
    const minutes = company.autoLockMinutes;
    const touch = () => { if (!locked) setMeta('lastActivity', Date.now()); };
    let last = 0;
    const throttled = () => { if (Date.now() - last > 20000) { last = Date.now(); touch(); } };
    const events = ['pointerdown', 'keydown', 'scroll'];
    events.forEach((e) => window.addEventListener(e, throttled, { passive: true }));
    const check = () => {
      if (!minutes) return;
      if (Date.now() - getMeta<number>('lastActivity', Date.now()) > minutes * 60000) setLocked(true);
    };
    check();
    const t = setInterval(check, 15000);
    document.addEventListener('visibilitychange', check);
    return () => { events.forEach((e) => window.removeEventListener(e, throttled)); clearInterval(t); document.removeEventListener('visibilitychange', check); };
  }, [user?.id, company.autoLockMinutes, locked]);

  useEffect(() => { if (user) autoCloudBackup(); }, [user?.id]);

  let screen: ReactNode;
  if (!user) screen = <LoginScreen />;
  else if (locked) screen = <LockScreen user={user} onUnlock={() => setLocked(false)} />;
  else if (managesOwnPassword(user) && (user.mustChangePassword || !user.secretAnswerHash) && !setupSkipped) screen = <FirstSetupScreen user={user} />;
  else screen = <Shell />;

  return (
    <>
      {screen}
      <UpdateBar />
      <Toasts />
    </>
  );
}

function SyncPill() {
  const s = useSyncStatus();
  const text = { ok: 'Synchronisé', syncing: 'Synchro…', offline: 'Hors ligne', error: 'Erreur synchro', off: 'Local' }[s.state];
  return (
    <button className={`sync sync-${s.state}`} onClick={() => (s.state === 'off' ? navigate('/parametres/cloud') : syncNow())}
      title={s.error || (s.pending ? `${s.pending} modification(s) en attente` : text)}>
      <span className="sync-dot" />
      {text}{s.pending > 0 && s.state !== 'ok' && s.state !== 'off' ? ` · ${s.pending}` : ''}
    </button>
  );
}

function Shell() {
  const user = useMe();
  usePrintStationWorker();
  const can = useCan();
  const company = useCompany();
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.perm || can(n.perm));
  const current = [...items].sort((a, b) => b.path.length - a.path.length).find((n) => n.path === '/' ? route === '/' : route.startsWith(n.path)) ?? items[0];
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [route]);
  // Menu ouvert sur téléphone : la page derrière ne défile plus, seul le menu défile.
  useEffect(() => { document.body.classList.toggle('nav-lock', open); return () => document.body.classList.remove('nav-lock'); }, [open]);
  const groups = [...new Set(items.map((i) => i.group))].filter((g) => g !== 'hidden');
  const mobileItems = items.filter((i) => i.mobile).slice(0, 4);

  return (
    <div className={`app ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar" aria-label="Menu principal">
        <div className="brand">
          <BrandLogo />
          <span className="brand-name">{company.name}</span>
        </div>
        <nav className="nav">
          {groups.map((g) => (
            <div key={g || 'main'} className="nav">
              {g && <div className="nav-group">{g}</div>}
              {items.filter((i) => i.group === g).map((i) => (
                <a key={i.path} href={'#' + i.path} aria-current={current.path === i.path ? 'page' : undefined}>
                  <Icon name={i.icon} />{i.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <SyncPill />
          <a className="me" href="#/compte" aria-current={route === '/compte' ? 'page' : undefined}>
            <span className="avatar">{user.fullName.charAt(0).toUpperCase()}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="me-name" style={{ display: 'block' }}>{user.fullName}</span>
              <span className="me-role">{roleOf(user)?.name}</span>
            </span>
          </a>
          <Button variant="quiet" icon="logout" onClick={() => logout()}>Se déconnecter</Button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div style={{ minWidth: 0 }}>
        <header className="topbar">
          <IconButton icon="menu" label="Ouvrir le menu" onClick={() => setOpen(true)} />
          <div className="brand"><BrandLogo /><span className="brand-name">{company.name}</span></div>
          <SyncPill />
        </header>
        <main className="main">
          <div className="content">{current.page()}</div>
        </main>
        <nav className="bottom-nav" aria-label="Raccourcis">
          {mobileItems.map((i) => (
            <a key={i.path} href={'#' + i.path} aria-current={current.path === i.path ? 'page' : undefined}>
              <Icon name={i.icon} size={22} />{i.label}
            </a>
          ))}
          <button onClick={() => setOpen(true)}><Icon name="menu" size={22} />Menu</button>
        </nav>
      </div>
    </div>
  );
}

/** Propose la nouvelle version quand une mise à jour du logiciel est disponible. */
function UpdateBar() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || location.hostname === 'localhost') return;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => { if (sw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(sw); });
      });
      setInterval(() => reg.update().catch(() => {}), 30 * 60000);
    }).catch(() => {});
  }, []);
  if (!waiting) return null;
  return (
    <div className="update-bar" role="status">
      Nouvelle version disponible
      <Button onClick={() => waiting.postMessage('skipWaiting')}>Mettre à jour</Button>
    </div>
  );
}
