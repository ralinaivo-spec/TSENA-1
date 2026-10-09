# TSENA — Proposition de refonte v4 (à valider)

> Reformulation de vos 14 demandes du 09/10/2026, avec une solution simple pour chacune.
> Les **boosts publicitaires** sont gardés tels quels : vous les reverrez à part.
> ✅ = déjà en place (à garder ou à ajuster) · 🆕 = à créer · 🔧 = à modifier.

---

## 1. Catégories, variantes et articles 🔧

**Votre besoin.** Chaque catégorie définit d'abord ses propres variantes (plusieurs niveaux, avec leurs valeurs). Ensuite seulement, on crée les articles en choisissant une valeur par variante.

**Solution proposée : la catégorie porte ses « critères ».**

| Étape | Exemple : catégorie « Lampe rechargeable » |
|---|---|
| 1. Créer la catégorie | Lampe rechargeable (rattachée à sa page Facebook) |
| 2. Lui donner ses critères (jusqu'à 4) et leurs valeurs | **Modèle** : LP1 (simple batterie), LP2 (double batterie), LP3 (tube), LP4 (barre LED) · **Type** : E27 (à vis), B22 (baïonnette) · **Puissance** : 7 W, 12 W, 20 W, 30 W |
| 3. Créer un article = choisir une valeur par critère | Modèle LP1 · Type B22 · Puissance 7 W |
| 4. Le nom se fait tout seul (modifiable) | **LP1 B22 7W** |
| 5. Prix | Prix de revient 4 486 Ar · PV détail 9 000 Ar · PV gros 9 000 Ar |

- Un bouton **« Créer toutes les combinaisons »** propose d'un coup tous les articles possibles (ex. 4 × 2 × 4 = 32) ; on décoche ceux qui n'existent pas.
- Une valeur ajoutée plus tard (ex. Puissance 40 W) est disponible pour les nouveaux articles.
- Remplace le système actuel « couleur / taille » unique pour tout le magasin.

## 2. Import du stock par Excel 🔧

Ordre imposé, simple :
1. Vous créez **à la main** la catégorie et ses critères (point 1).
2. Le logiciel génère **un fichier Excel propre à cette catégorie** : une colonne par critère, avec une **liste déroulante** des valeurs permises, puis Prix de revient, PV détail, PV gros, Quantité en stock.
3. Vous le remplissez et vous l'importez. Le logiciel contrôle chaque ligne (valeur inconnue, prix manquant, doublon) **avant** d'enregistrer, et affiche les erreurs ligne par ligne.

## 3. Ventes : deux types seulement 🔧

### 3.1 Vente sur place ✅ (écran à refaire pour la caisse)
Le client est là : il choisit, paie, repart avec l'article.
- **Écran « caisse » adapté** à l'ordinateur, la tablette et le téléphone : grandes tuiles d'articles, recherche, lecteur de code-barres, panier à droite (en bas sur téléphone), gros boutons de paiement (espèces, MVola, Orange Money, Airtel Money, mixte).
- **Ticket** 58 mm ou 80 mm et **ouverture du tiroir-caisse** par l'imprimante, au moment du paiement en espèces.

### 3.2 Vente à livraison 🔧 (4 étapes claires)

| Étape | Ce qu'on fait | Qui |
|---|---|---|
| **1. Enregistrée** | Commande reçue (Facebook, appel…) : client, téléphone, lieu, articles, choix éventuels, frais de livraison, livreur prévu | Vendeur |
| **2. En attente de livraison** | Commande préparée, prête à partir | Vendeur |
| **3. En livraison** | Le livreur prend le colis : on l'**affecte** (ou on confirme le livreur prévu) | Vendeur |
| **4. Retour livreur** | On fait le compte avec le livreur (voir ci-dessous) | Vendeur / gérant |
| → **Terminée** | Livrée, livrée en partie ou refusée, et le compte est soldé | — |

L'étape « À confirmer » actuelle disparaît.

**Paiement avant le retour du livreur.** Aux étapes 2 et 3, on peut enregistrer un paiement déjà reçu (MVola, espèces en boutique). Au retour, ce montant est affiché comme « déjà payé » et n'est pas demandé au livreur.

**Écran « Retour livreur ».** Les montants sont toujours **séparés** :

| Ligne | Exemple |
|---|---|
| Articles gardés par le client (choix ajustés, refus, retours) | 45 000 Ar |
| − Déjà payé avant le retour (MVola…) | − 20 000 Ar |
| **Prix des articles à encaisser** | **25 000 Ar** |
| Frais de livraison prévus → **modifiables** si le client a payé moins | 4 000 → 2 000 Ar |
| **Total que le livreur a en main** | **27 000 Ar** |
| Frais qui reviennent au livreur | 2 000 Ar |

Pour payer les frais du livreur, trois choix en un clic :
- **Retenus sur l'argent qu'il rend** : il verse 25 000 Ar.
- **Payés à part**, en espèces de la caisse ou par Mobile Money.
- **Plus tard** : le montant va dans le **compte du livreur**, réglé un autre jour.

Le compte de chaque livreur montre ce qu'il doit, ce qu'on lui doit et l'historique. Un livreur peut avoir son propre accès (rôle « Livreur ») pour voir **seulement** son compte.

## 4. Dépenses et charges : un menu à part 🔧

- **Menu « Dépenses »** avec un bouton **« + Ajouter une dépense »**.
- **Champs d'une dépense** : date, **catégorie**, **type** (dépense courante ou charge fixe), montant, payé depuis (caisse commune par défaut), description, photo du reçu, saisi par.
- **Liste** : tri et filtres par **période** (jour, semaine, mois, année, dates libres), par **catégorie** et par type, avec les totaux par catégorie et l'export Excel.
- **Catégories et types** : gérés dans Paramètres, mais on peut en **ajouter directement** pendant la saisie (« + Nouvelle catégorie »), sans passer par Paramètres.
- **Charges fixes répétées** (loyer, salaires, JIRAMA, internet…) : définies une fois (montant, fréquence, jour et heure). Le jour venu, une **notification** « Loyer à payer : 300 000 Ar » apparaît avec deux boutons, **Payer** (crée la dépense) et **Reporter**.

## 5. Clients ✅ 🔧

- La fiche client se crée **automatiquement** à la première commande. Une seule information suffit : **téléphone, ou nom Facebook, ou lieu de livraison**.
- Pour une nouvelle commande, on **recherche le client existant** (téléphone, nom Facebook, nom, lieu) : ses informations se remplissent toutes seules et la commande s'ajoute à son **historique**.

## 6. Recherche partout 🔧

Chaque champ de recherche cherche dans **tout le contenu** : nom, téléphone, nom Facebook, lieu, observations, numéro, articles, valeurs des critères (ex. « B22 », « 7W »), montants. Il ignore les accents, les majuscules et les espaces dans les numéros (« 034 12 » = « 03412 »).

## 7. Notifications 🆕

- Chaque notification a un **×** pour la fermer.
- Elle **revient plus tard** selon son importance :

| Importance | Exemples | Revient après |
|---|---|---|
| Urgente | Charge à payer aujourd'hui, choix à préciser | 1 h |
| Importante | Stock faible, livreur avec un gros montant non versé | 2 h |
| Information | Sauvegarde, mise à jour disponible | 5 h, ou le lendemain |

- Bouton « Ne plus afficher aujourd'hui ».

## 8. Thème et présentation 🔧

- Thème **clair** et **sombre** (au choix ou automatique), testé sur téléphone, tablette et ordinateur.
- Mise à jour des menus, des boutons et des tableaux selon les tendances actuelles (cartes arrondies, contrastes lisibles, grandes zones tactiles).

## 9. Tableau de bord et menu : du plus important au moins important 🔧

**Tableau de bord**, dans cet ordre :
1. **Chiffre des ventes**, avec un sélecteur **Jour / Semaine / Mois / Année / dates libres**.
2. **État des commandes** : enregistrées, en attente, en livraison, à rendre par les livreurs.
3. **Historique des dernières ventes et commandes**.
4. Dépenses et bénéfice net, **par jour au minimum** : le détail par heure est supprimé.
5. Stock faible, puis le reste.

**Menu de gauche :**

| Ordre | Menu |
|---|---|
| 1 | Tableau de bord |
| 2 | Vente sur place |
| 3 | Ventes à livraison |
| 4 | Retour livreurs / comptes livreurs |
| 5 | Clients |
| 6 | Dépenses |
| 7 | Caisse du jour et récapitulatifs |
| 8 | Articles et stock |
| 9 | Boosts pub |
| 10 | Rapports |
| 11 | Achats et réceptions |
| 12 | Paramètres et administration |

Les modules que vous n'utilisez pas (ex. Achats Chine, Impression) peuvent être **masqués** dans Paramètres.

## 10. Listes longues : menus déroulants 🔧

Toute longue liste (clients, articles, livreurs, catégories, valeurs de critères…) devient un **menu déroulant avec recherche**, sur une seule ligne, au lieu de prendre toute la page.

## 11. Page d'installation 🆕

En ouvrant le lien de l'application, une **page d'accueil d'installation** apparaît :
- **Android et ordinateur** : un bouton **« Installer TSENA »**, et l'icône s'ajoute à l'écran d'accueil.
- **iPhone** : un petit tutoriel illustré : 1) bouton **Partager**, 2) **« Sur l'écran d'accueil »**, 3) **Ajouter**.
- Une fois installée, cette page ne s'affiche plus : l'utilisateur ouvre directement l'icône.

## 12. Sauvegardes 🔧

| | Aujourd'hui | Proposé |
|---|---|---|
| **Automatique** | Copie quotidienne dans le cloud par l'appareil d'un admin ✅ | Gardée, avec l'affichage clair de « Dernière sauvegarde : … » et la liste des copies |
| **Manuelle sur ordinateur** (Chrome / Edge) | Va dans « Téléchargements » | Vous **choisissez une fois le dossier** (ex. Documents/TSENA), puis chaque sauvegarde y va directement |
| **Manuelle sur téléphone** | Va dans « Téléchargements », sans le dire | Message clair « Enregistré dans **Téléchargements**, fichier TSENA-sauvegarde-2026-10-09.tsena », et bouton **Partager** (Google Drive, WhatsApp, e-mail) |
| **Mot de passe** | Nouveau mot de passe demandé à chaque fois | Défini **une seule fois** par l'admin, puis seule la **confirmation de votre mot de passe de connexion** est demandée |

Note : sur téléphone, le navigateur ne permet pas de choisir un dossier. Le bouton Partager remplace ce choix.

## 13. Téléphones compatibles 🔧

- **Android 8 et plus récent**, avec Google Chrome. Sur Android 8 et 9, Chrome ne reçoit plus de mises à jour depuis août 2025 (dernière version : 138), mais cette version suffit pour faire tourner TSENA.
- **iPhone / iPad** : iOS 12 minimum. Le mode hors ligne et l'installation sur l'écran d'accueil n'existent pas avant iOS 11.3 ; **iOS 10 n'est donc pas possible**.
- **Ordinateur** : Windows, macOS ou Linux, avec Chrome ou Edge.
- L'application sera allégée et testée sur ces anciennes versions.

## 14. Local + cloud, hors ligne ✅ 🔧

Déjà en place :
- chaque appareil a sa **base locale** et fonctionne **sans Internet** ;
- dès qu'il y a une connexion, la **synchronisation est automatique**, sans demande de permission ;
- les doublons et les conflits sont gérés, et chaque appareil a sa lettre dans les numéros.

À ajouter : un **historique de synchronisation** lisible. Exemple : « 09/10 15:42 — Téléphone Hery : 12 envoyés, 30 reçus, 0 conflit ».

---

## Ordre de réalisation proposé

| Phase | Contenu | Pourquoi d'abord |
|---|---|---|
| **1** | Catégories, critères, articles, import Excel par catégorie (points 1-2) | Indispensable avant de charger le stock |
| **2** | Ventes : caisse sur place, livraison en 4 étapes, retour livreur, comptes livreurs (point 3) | Cœur du travail quotidien |
| **3** | Dépenses et charges, notifications (points 4, 7) | Suivi de l'argent |
| **4** | Clients, recherche, menus déroulants (points 5, 6, 10) | Confort de saisie |
| **5** | Thème, tableau de bord, menu, page d'installation, compatibilité (points 8, 9, 11, 13) | Présentation finale |
| **6** | Sauvegardes, historique de synchronisation (points 12, 14) | Sécurité |

Chaque phase est mise en ligne et testée avec vous avant de passer à la suivante.

## Questions à trancher avant de commencer

1. **Catégorie et page Facebook** : une catégorie = une page ? Ou une page peut-elle regrouper plusieurs catégories (ex. page « Maison » = Lampes + Coffrets) ?
2. **Nombre de critères** : 4 maximum par catégorie, est-ce suffisant ?
3. **Nom de l'article** : le nom automatique « LP1 B22 7W » vous convient-il ?
4. **Livreurs** : faut-il leur donner un accès personnel pour consulter leur compte ?
5. **Modules à masquer** : Achats Chine, Réceptions, Impression… lesquels n'utilisez-vous pas ?
6. **Imprimante et tiroir-caisse** : quel modèle (ou quel budget), et branché à quoi (PC en USB, téléphone en Bluetooth) ?
