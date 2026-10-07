// Accueil : résumé adapté au rôle. Les chiffres de vente arriveront avec les étapes suivantes.
import { managesOwnPassword, roleOf, SUPERADMIN_ID, useCan, useCurrentUser, type User } from '../lib/auth';
import { useMeta, useTable } from '../lib/db';
import type { Order } from '../lib/orders';
import { DEFAULT_COMPANY, useCompany } from '../lib/settings';
import { useSyncStatus } from '../lib/sync';
import { PageHead, timeAgo } from '../ui/kit';
import { Icon } from '../ui/icons';

export function DashboardPage() {
  const me = useCurrentUser()!;
  const can = useCan();
  const company = useCompany();
  const users = useTable<User>('users');
  const orders = useTable<Order>('orders');
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

      {can('orders.create') && (
        <div className="stat-grid">
          {([['new', 'À confirmer', 'confirmer'], ['confirmed', 'À préparer', 'preparer'], ['ready', 'Prêtes à livrer', 'pretes'], ['out', 'En livraison', 'livraison']] as const).map(([st, label, tab]) => (
            <a key={st} className="card stat" href={`#/commandes/${tab}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="muted small">{label}</span>
              <span className="stat-value">{orders.filter((o) => o.status === st).length}</span>
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
