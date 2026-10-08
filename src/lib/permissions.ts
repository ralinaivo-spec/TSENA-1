// Droits d'accès : chaque rôle est une liste de droits. L'admin peut ajuster la matrice.

export interface PermissionDef { key: string; label: string; group: string }

export const PERMISSIONS: PermissionDef[] = [
  { group: 'Général', key: 'dashboard.view', label: 'Voir le tableau de bord' },
  { group: 'Général', key: 'costs.view', label: "Voir les prix d'achat, marges et bénéfices" },
  { group: 'Articles et stock', key: 'catalog.view', label: 'Consulter les articles et le stock' },
  { group: 'Articles et stock', key: 'catalog.edit', label: 'Créer et modifier les articles, catégories et prix' },
  { group: 'Articles et stock', key: 'stock.adjust', label: 'Ajuster le stock et faire les inventaires' },
  { group: 'Achats', key: 'purchases.manage', label: 'Gérer les achats en Chine et les arrivages' },
  { group: 'Achats', key: 'purchases.receive', label: 'Réceptionner la marchandise' },
  { group: 'Ventes', key: 'orders.create', label: 'Créer les commandes clients' },
  { group: 'Ventes', key: 'orders.prepare', label: 'Préparer les commandes' },
  { group: 'Ventes', key: 'pos.sell', label: 'Vendre en boutique (caisse)' },
  { group: 'Ventes', key: 'returns.manage', label: 'Enregistrer retours et échanges' },
  { group: 'Livraison', key: 'orders.dispatch', label: 'Assigner les commandes aux livreurs' },
  { group: 'Livraison', key: 'deliveries.manage', label: 'Enregistrer le retour des livreurs (livré, refusé, choix rendus, argent rapporté)' },
  { group: 'Livraison', key: 'couriers.view', label: 'Consulter le compte des livreurs (frais gagnés, argent à rendre)' },
  { group: 'Livraison', key: 'couriers.manage', label: 'Créer et modifier les fiches livreurs' },
  { group: 'Argent', key: 'treasury.view', label: 'Voir la trésorerie et les soldes' },
  { group: 'Argent', key: 'expenses.manage', label: 'Saisir les dépenses et autres revenus' },
  { group: 'Argent', key: 'couriers.settle', label: 'Faire les règlements des livreurs' },
  { group: 'Argent', key: 'closing.do', label: 'Faire la clôture de journée' },
  { group: 'Publicité', key: 'boosts.enter', label: 'Saisir les résultats des boosts et les messages reçus, ajouter ou arrêter un boost' },
  { group: 'Publicité', key: 'boosts.view', label: 'Voir le suivi et l’analyse des boosts' },
  { group: 'Rapports', key: 'reports.view', label: 'Voir les rapports complets' },
  { group: 'Administration', key: 'users.manage', label: 'Créer les utilisateurs et donner les accès' },
  { group: 'Administration', key: 'settings.company', label: 'Modifier la société (nom, logo, couleur)' },
  { group: 'Administration', key: 'audit.view', label: "Consulter le journal d'activité" },
  { group: 'Administration', key: 'backup.manage', label: 'Faire et télécharger des sauvegardes' },
  { group: 'Administration', key: 'system.admin', label: 'Restaurer, réinitialiser, réparer (super-admin)' },
];

const ALL = PERMISSIONS.map((p) => p.key);
const not = (...ex: string[]) => ALL.filter((k) => !ex.includes(k));

export interface RoleSeed { id: string; name: string; description: string; permissions: string[]; locked?: boolean; system?: boolean }

/** Rôles de départ (identifiants fixes pour être identiques sur tous les appareils). */
export const DEFAULT_ROLES: RoleSeed[] = [
  { id: 'role-superadmin', name: 'Super-admin', description: 'Compte technique de secours : mots de passe, restauration, réinitialisation.', permissions: ALL, locked: true, system: true },
  { id: 'role-admin', name: 'Admin / Gérant', description: "Gère toute l'activité, les utilisateurs et leurs accès.", permissions: not('system.admin'), system: true },
  { id: 'role-owner', name: 'Propriétaire', description: 'Consulte les tableaux de bord et les rapports, sans rien modifier.', permissions: ['dashboard.view', 'costs.view', 'catalog.view', 'treasury.view', 'reports.view', 'audit.view', 'boosts.view'], system: true },
  { id: 'role-seller', name: 'Vendeur', description: 'Répond aux clients, crée les commandes, prépare, vend en boutique et gère les livraisons des livreurs.', permissions: ['dashboard.view', 'catalog.view', 'orders.create', 'orders.prepare', 'orders.dispatch', 'deliveries.manage', 'couriers.view', 'pos.sell', 'returns.manage', 'boosts.enter', 'boosts.view'], system: true },
  { id: 'role-stock', name: 'Magasinier', description: 'Réceptionne la marchandise et fait les inventaires.', permissions: ['dashboard.view', 'catalog.view', 'purchases.receive', 'stock.adjust'], system: true },
];

export const SUPERADMIN_ROLE = 'role-superadmin';
export const ADMIN_ROLE = 'role-admin';
