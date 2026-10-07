# TSENA — Cahier des charges (version 1.9, validée le 07/10/2026)

> Logiciel de gestion commerciale et de comptabilité : achats (Chine), stock, ventes en ligne et en boutique, livraisons, trésorerie, rapports.
> Fonctionne **en ligne et hors ligne** (coupure de connexion ou de courant), sur **téléphone et ordinateur** (iOS, Android, Windows, macOS).

---

## 1. Principes de base

| Principe | Ce que ça veut dire concrètement |
|---|---|
| **Hors ligne d'abord** | Chaque appareil garde une copie locale des données. On peut vendre, encaisser, préparer, livrer sans Internet. Dès que la connexion revient, tout se synchronise automatiquement. |
| **Rien ne se supprime** | Une vente, un paiement, un mouvement de stock ne s'efface jamais : on l'**annule** avec une contre-écriture et un motif. Tout reste traçable (qui, quoi, quand, sur quel appareil). |
| **Le stock = la somme des mouvements** | Le stock n'est jamais « tapé » directement : il est calculé à partir des entrées, sorties, retours, ajustements. Ça évite les conflits quand deux appareils travaillent hors ligne en même temps. |
| **Tout est paramétrable** | Catégories d'articles, catégories de revenus et de dépenses, zones et frais de livraison, moyens de paiement, rôles : tout s'ajoute sans toucher au code. |
| **Monnaie** | Ariary (MGA) pour tout. Les achats en Chine se saisissent en **RMB (yuan)** ou en **Ariary**, avec le taux de change du jour. |

---

## 2. Utilisateurs, rôles et accès

### 2.1 Les rôles

| Rôle | Pour qui | Peut faire | Ne peut pas faire |
|---|---|---|---|
| **Super-admin** (technique) | Compte de secours | Réinitialiser les mots de passe de tous, forcer une synchronisation, réparer, restaurer une sauvegarde, remettre le logiciel à l'état d'origine | — (mais ne sert pas au travail quotidien) |
| **Admin / Gérant** | Vous | Tout le métier : achats, stock, prix, utilisateurs et droits, dépenses, clôture, rapports complets, bénéfices | Remise à zéro totale (réservée au super-admin) |
| **Propriétaire / Observateur** *(ajout)* | Votre boss | Voir les tableaux de bord et le récapitulatif journalier, en lecture seule | Rien modifier |
| **Vendeur / Opérateur** | Personnes qui répondent sur Facebook et en boutique | Créer clients et commandes, vendre en boutique, préparer les commandes, encaisser, enregistrer retours et échanges. **Gérer les livraisons à la place des livreurs** : assigner les commandes, marquer livré / refusé / choix rendus, enregistrer l'argent rapporté, consulter le compte de chaque livreur (frais gagnés, argent à rendre) | Voir les prix d'achat et les bénéfices, modifier le stock à la main, gérer les utilisateurs |
| **Magasinier** *(ajout, optionnel)* | Personne qui réceptionne la marchandise | Réceptionner les arrivages, faire les inventaires | Vendre, voir la trésorerie |

- **Les livreurs n'utilisent pas l'application.** Ce ne sont pas des utilisateurs mais des **fiches livreurs** (nom, téléphone, axes desservis, actif/inactif) créées par l'admin. Toutes leurs opérations sont saisies par les vendeurs, et chaque saisie garde le nom du vendeur qui l'a faite.
- Seul l'**Admin** crée les comptes et attribue les rôles. Un utilisateur ne peut rien faire avant d'avoir été créé par l'admin.
- Les droits sont présentés sous forme de **matrice cochable** (rôle × fonction) : l'admin peut ajuster un rôle ou créer un rôle personnalisé.
- Chaque utilisateur ne voit **que les menus de son rôle**.

### 2.2 Connexion et sécurité

- Nom d'utilisateur + mot de passe.
- **Les mots de passe des vendeurs, magasiniers et du propriétaire sont choisis et donnés par le gérant ou le super-admin** (champ mot de passe dans la fiche utilisateur, visible d'eux seuls). Ces utilisateurs ne peuvent pas changer leur mot de passe eux-mêmes : en cas d'oubli, ils s'adressent au gérant. Seuls le super-admin et le gérant gèrent leur propre mot de passe et leur question secrète.
- Compte super-admin par défaut : `super-adm`, avec le mot de passe d'origine communiqué au gérant — **changement obligatoire du mot de passe à la première connexion** (sinon n'importe qui ayant lu ce document pourrait entrer).
- À la première connexion de chaque utilisateur : choix d'une **question secrète** parmi des suggestions proposées automatiquement par le logiciel, + adresse e-mail facultative.
- Mot de passe oublié : par **e-mail** (lien de réinitialisation), par **question secrète**, ou par l'**admin / super-admin**.
- Code PIN rapide (4–6 chiffres) optionnel pour déverrouiller l'appli sur son propre téléphone.
- Déconnexion automatique après inactivité (réglable).
- **Journal d'audit** : chaque action importante est enregistrée (utilisateur, date/heure, appareil, avant/après).

---

## 3. Articles et catégories

- **Catégories et sous-catégories** illimitées (ajout, renommage, archivage).
- **Article** : nom, code/SKU, code-barres (scan par la caméra du téléphone), photo(s), catégorie, unité, prix d'achat moyen (coût de revient), prix de vente détail, prix de gros *(optionnel)*, seuil d'alerte stock, statut (actif / archivé).
- **Variantes** *(ajout important)* : taille, couleur, pointure… Chaque variante a son propre stock. Indispensable pour les « choix » de taille envoyés aux clients.

---

## 4. Achats en Chine → arrivage → stock

### 4.1 Fournisseurs et commandes d'achat
- Fiche fournisseur (nom, contact WeChat/téléphone, ville, notes).
- **Commande d'achat** : fournisseur, date, devise (RMB ou Ariary) + taux de change, lignes (article existant **ou nouvel article / nouvelle catégorie créés à la volée**), quantité, prix unitaire.
- Paiements au fournisseur (acomptes, solde) et suivi de ce qui reste à payer.

### 4.2 Suivi de la commande
- Statuts : **Commandée → Expédiée de Chine → Arrivée à Madagascar → Reçue** (partiellement ou totalement), ou Annulée — avec la date de chaque étape.
- N° de commande 1688, n° de suivi, lien, transitaire.
- Le **taux du RMB** est saisi sur chaque commande (pas de taux fixe) et reste modifiable.

### 4.3 Réception et facture du transit (validé avec le gérant)
- **Les tarifs du transit ne sont jamais fixés à l'avance** : on les saisit **à la réception**, d'après la facture du transitaire.
- Une réception (arrivage) regroupe **une ou plusieurs commandes** reçues ensemble.
- Facture du transit :
  - **Maritime** : volume facturé en **m³** × tarif par m³.
  - **Aérien** : poids facturé en **kg** × tarif par kg.
  - Tarif en **USD, RMB ou Ariary**, avec le **taux de change de la facture**.
  - Autres frais éventuels : dédouanement, transport local, frais du transitaire…
- Répartition des frais sur les pièces reçues : **par quantité** (méthode habituelle du gérant, par défaut), ou par valeur.
- **Coût de revient unitaire** = (prix unitaire + part des frais Chine − part de la remise) × taux du RMB + part du transit + part des autres frais.
- Aperçu avant validation : coût de revient, prix de vente détail/gros et marge de chaque article.
- Le **coût moyen pondéré** de chaque article est recalculé à la réception.

### 4.4 Réception (quantités)
- Réception totale ou **partielle**, avec écarts (manquant, abîmé, en trop) et photos.
- La réception crée automatiquement les **entrées de stock**.
- Vue « **En attente d'arrivage** » : ce qui est commandé et pas encore arrivé, par article (utile pour dire au client « disponible le … »).

---

## 5. Stock

- Emplacements logiques : **Boutique**, **Réservé** (commande préparée), **Chez livreur X** (en cours de livraison ou en choix), **En arrivage**.
- Mouvements : entrée (réception, retour client), sortie (vente), transfert (boutique → livreur → boutique), ajustement (casse, perte, vol, cadeau, usage interne) avec motif obligatoire.
- **Inventaire physique** : comptage (par scan ou saisie), comparaison avec le théorique, validation des écarts par l'admin.
- Alertes : stock bas, rupture, articles dormants (pas vendus depuis X jours), articles les plus vendus.
- Valeur du stock au coût de revient et au prix de vente.

---

## 6. Clients

- Fiche client : nom, téléphone(s) (clé principale), nom/lien Facebook, adresse, **zone de livraison**, notes.
- Historique : commandes, montants, retours, refus.
- *Ajout* : indicateur de **fiabilité** (taux de refus à la livraison) pour repérer les clients qui refusent souvent.
- Recherche instantanée par téléphone pendant la conversation Facebook ; si le client existe déjà, ses infos se remplissent toutes seules.

---

## 7. Commandes en ligne (Facebook) et livraison

### 7.0 Saisie (validé avec le gérant, reprend le cahier des vendeurs)
- **Contact du client : obligatoire.** Nom : facultatif. La fiche client est créée ou complétée automatiquement.
- **Lieu de livraison : obligatoire** avant d'enregistrer la commande (l'option « lieu à confirmer » a été retirée).
  - **Sur boutique** (retrait par le client) : frais de livraison **0 Ar automatiquement**, **aucun livreur** ; la commande se termine par « Remis au client en boutique ».
  - **Livraison** : lieu précis, **frais obligatoires** et **livreur obligatoire**.
- La rubrique **Commandes clients** est réservée aux commandes des clients (Facebook, téléphone…). Les ventes directes en boutique se font dans la rubrique **Ventes → Vente sur place** (écran de comptoir : client, contact et lieu facultatifs ; panier, prix de gros dès 3 pièces, remise, paiement en un ou plusieurs moyens, monnaie à rendre).
- Les zones et leurs frais se gèrent dans **Paramètres → Zones de livraison** (ou Livraisons → Zones et frais).
- Articles, quantités, prix (détail, ou gros dès 3 pièces / accordé à la main), frais de livraison (selon la zone, modifiables), récapitulatif « total + frais », observations.
- **Horaires** : lundi–vendredi 8 h–17 h, samedi 8 h–14 h. Les commandes sont reçues **tous les jours, dimanche compris** ; celles reçues hors horaires sont marquées « hors heures » et préparées à l'ouverture.

### 7.1 Cycle de vie d'une commande

```
Brouillon → Confirmée → En préparation → Prête → Assignée au livreur → En livraison
   → Livrée (totale ou partielle) / Refusée → Clôturée
```

- **Création** par le vendeur : client, articles (+ variante), quantités, prix, remise éventuelle, zone, frais de livraison, date/créneau souhaité, mode de paiement prévu, notes.
- **Hors heures d'ouverture** : la commande est enregistrée et apparaît dans la file « À préparer à l'ouverture ».
- **Préparation** : liste de préparation, cochage article par article, la marchandise passe en « Réservé ».
- **Articles en choix** : lignes marquées « choix » (ex. 3 tailles envoyées pour 1 achetée). Ils sortent physiquement avec le livreur mais **ne sont pas une vente**.

### 7.2 Livraisons
- **Zones / axes de livraison** paramétrables, chacun avec un **tarif par défaut** ; le montant peut être modifié à la main.
- Regroupement des commandes par axe, **feuille de route** pour chaque livreur (imprimable).
- **Changer de livreur** : une commande déjà attribuée peut être réattribuée à un autre livreur (fiche commande → « Changer », ou Livraisons → En cours → « Changer de livreur »), avec un motif. La commande et l'argent déjà encaissé passent du compte du premier livreur au compte du nouveau ; les frais de livraison iront au nouveau livreur ; l'historique de la commande garde la trace « Livreur changé : A → B ». **Possible uniquement tant que le versement du livreur n'est pas validé** (règlement par l'admin, étape 6).
- Au retour du livreur, **le vendeur** enregistre pour chaque commande : livrée, refusée, articles pris parmi les choix, articles rendus, montant encaissé et par quel moyen.

### 7.3 Retours, refus et échanges
- **Refus à la livraison** : la marchandise revient en stock, la commande est annulée (motif obligatoire : taille, couleur, qualité, client absent…).
- **Choix non retenus** : retour en stock, sans impact sur le chiffre d'affaires.
- **Échange (le lendemain ou plus tard)** : article rendu + nouvel article ; le logiciel calcule la **différence** (le client paie le complément, ou on lui rembourse / on lui fait un avoir). Frais de livraison facturés ou offerts au choix.
- **Avoir client** *(ajout)* : un montant à valoir sur un prochain achat, au lieu d'un remboursement.
- Motifs de retour suivis dans les rapports (pour voir quels articles reviennent le plus).

---

## 8. Vente en boutique (caisse)

- Écran de caisse rapide : recherche ou scan, panier, remise, paiement (espèces avec calcul de la monnaie à rendre, mobile money avec **référence de transaction**), **paiement mixte** (ex. une partie en espèces + une partie MVola).
- **Prix de gros** : appliqué automatiquement **à partir de 3 pièces** (seuil réglable dans les paramètres). Le vendeur peut aussi **l'accorder à la main** à un client qui en prend moins (ex. 2 pièces) ; ce choix est enregistré avec la vente.
- Impression du ticket de caisse.
- Mise en attente d'un panier, reprise plus tard.

---

## 9. Paiements, trésorerie et comptes livreurs

### 9.1 Comptes de trésorerie
- **Caisse espèces**, **MVola**, **Orange Money**, **Airtel Money** (+ banque si besoin). Pas de chèques.
- Solde de chaque compte en temps réel.
- **Virements entre comptes** (ex. retrait MVola → caisse) et retraits / apports du gérant.

### 9.2 Moments de paiement
- **Avant livraison** (souvent mobile money) : la commande est marquée « payée ».
- **À la livraison** : c'est le livreur qui reçoit l'argent → ce montant devient **une dette du livreur envers la boutique** jusqu'à ce qu'il le remette.
- **Acompte / paiement partiel** possible.

### 9.3 Frais de livraison — séparés du chiffre d'affaires
- Les frais de livraison **appartiennent au livreur** : ils ne comptent **pas** dans les entrées de la boutique.
- Chaque livreur a un **compte courant** :
  - **+** frais de livraison gagnés,
  - **+** argent client encaissé par le livreur (à rendre),
  - **−** argent remis à la boutique,
  - **−** frais que la boutique lui a reversés (cas où le client a payé article + frais par mobile money à la boutique).
- **Règlement livreur** (fait **uniquement par l'admin**) : à chaque remise d'argent, le logiciel affiche ce que le livreur doit rendre ou ce qu'on lui doit, et garde l'historique complet de chaque transfert.

### 9.4 Dépenses et autres revenus (pour tout type d'activité)
- **Catégories de dépenses** paramétrables : loyer, salaires, électricité, eau, Internet/crédit, carburant, publicité Facebook, emballage, entretien, impôts, etc. (ajout illimité).
- **Catégories d'autres revenus** paramétrables : location, prestations, commissions, etc.
- **Opérations récurrentes** *(ajout)* : loyer mensuel, salaires, abonnement… générées automatiquement à l'échéance et à confirmer.
- Pièce jointe (photo du reçu).

---

## 10. Clôture de journée

### 10.1 Règle de clôture (votre point 14, reformulé)
- À la fermeture, tout article **en cours de livraison chez un livreur** (hors articles « choix ») est **compté comme vendu ce jour-là**.
- Les articles « choix » encore chez le livreur restent dans le stock « Chez livreur ».
- Si le lendemain un de ces articles revient : il est enregistré comme **« Retour sur vente du [date] »**, et apparaît comme tel dans le rapport du jour où il revient (le rapport de la veille n'est pas modifié).

### 10.2 Procédure de clôture *(ajout : « Z de caisse »)*
1. Comptage des espèces dans la caisse (par billets) → comparaison avec le théorique → **écart** affiché et justifié.
2. Vérification des soldes mobile money.
3. Liste de ce qui reste chez chaque livreur (argent et articles).
4. Validation : la journée est verrouillée (corrections seulement par l'admin, tracées).

### 10.3 Récapitulatif pour le boss
Un résumé court, envoyé en un clic (WhatsApp, Messenger, SMS, e-mail ou PDF) :
- Ventes du jour (nombre, montant), dont boutique / en ligne
- Retours du jour
- Dépenses du jour
- **Bénéfice brut du jour**
- Encaissements par moyen : espèces / MVola / Orange Money / Airtel Money
- Reste à recevoir des livreurs
- Solde de caisse en fin de journée

---

## 11. Tableaux de bord et rapports

### 11.1 Un tableau de bord par rôle
- **Admin / Propriétaire** : chiffre d'affaires, **bénéfice et perte** (par heure, jour, semaine, mois, année), marge, dépenses, trésorerie par compte, valeur du stock, arrivages en attente, argent chez les livreurs, meilleurs articles, articles dormants, taux de retour.
- **Vendeur** : ses ventes, ses commandes à préparer, commandes en attente, objectifs.
- **Suivi des livreurs** (dans l'espace du vendeur et de l'admin) : par livreur, les livraisons du jour, ce qui est encore dehors (articles et argent), les frais gagnés, l'argent à rendre.

### 11.2 Filtres partout
- Période : aujourd'hui, hier, cette semaine, ce mois, cette année, **intervalle libre**.
- Type de mouvement : entrées / sorties, ventes, retours, dépenses, virements…
- Par utilisateur, livreur, zone, catégorie, article, client, moyen de paiement.
- Tri sur chaque colonne, export Excel / PDF.

### 11.3 Rapports
- Journal des ventes, journal de caisse, journal des dépenses.
- Compte de résultat simplifié (chiffre d'affaires − coût des marchandises vendues − dépenses = bénéfice net).
- État du stock et valorisation, mouvements de stock par article.
- Rapport livreurs, rapport achats/arrivages, rapport clients.
- Comparaison entre périodes (ce mois vs mois dernier).

---

## 12. Import et export Excel

- Menu **« Modèles Excel »** : téléchargement de fichiers d'exemple prêts à remplir, avec une feuille d'explication et des exemples :
  1. Catégories
  2. Articles + **stock initial** + coût de revient + prix de vente (une feuille par catégorie acceptée, comme vos fichiers actuels)
  3. Fournisseurs
  4. **Achats en attente d'arrivage** (commandes déjà passées en Chine)
  5. Clients
  6. Zones et frais de livraison
  7. Catégories de dépenses / revenus
- Import avec **aperçu et contrôle des erreurs** avant validation (doublons, prix manquants, catégories inconnues créées automatiquement sur confirmation).
- Saisie manuelle toujours possible, une par une.
- Export Excel de toutes les listes et rapports.

---

## 13. Impression

- **Ticket de caisse** sur imprimante thermique **58 mm**.
- Bon de commande / bon de livraison, **feuille de route livreur**, liste de préparation.
- Étiquettes articles avec code-barres et prix *(ajout)*.
- Récapitulatif de clôture, rapports en PDF.
- Logo, nom, téléphone, adresse et message de pied de ticket personnalisables.

---

## 14. Sauvegarde, synchronisation, restauration

| Fonction | Détail |
|---|---|
| **Enregistrement local instantané** | Chaque action est écrite immédiatement sur l'appareil (pas besoin d'attendre 15 s : même une coupure de courant juste après ne fait rien perdre). |
| **Synchronisation cloud automatique** | Toutes les 15 s quand il y a du réseau, + immédiatement après chaque opération. Indicateur visible : 🟢 synchronisé / 🟠 en attente / 🔴 hors ligne (avec le nombre d'opérations en attente). |
| **Sauvegarde manuelle** | Bouton « Sauvegarder maintenant » → fichier téléchargeable (chiffré, protégé par mot de passe). |
| **Sauvegardes automatiques** | Quotidienne, hebdomadaire, mensuelle, conservées dans le cloud (historique). |
| **Restauration** | À partir d'une sauvegarde cloud ou d'un fichier ; réservée à l'admin / super-admin, avec confirmation. |
| **Transfert** | Nouveau téléphone / ordinateur : il suffit de se connecter, les données se chargent. |
| **Réinitialisation** | (a) vider les données de test en gardant les paramètres ; (b) **remise à l'état d'origine** complète. Réservées au super-admin, double confirmation + sauvegarde automatique juste avant. |
| **Outils de réparation** | Forcer la resynchronisation, recalculer les stocks à partir des mouvements, vérifier la cohérence. |

---

## 15. Interface et installation

- Interface moderne, rapide, pensée **d'abord pour le téléphone**, confortable aussi sur ordinateur.
- Thème **clair / sombre / automatique** (selon le téléphone).
- **Couleur principale au choix**, nom et logo de la société modifiables.
- Langue : **français**.
- **Application web installable (PWA)** : icône sur l'écran d'accueil, plein écran, fonctionne hors ligne — sur iPhone/iPad (Safari → « Sur l'écran d'accueil »), Android (Chrome → « Installer »), Windows et macOS (Chrome/Edge → « Installer »).

---

## 16. Choix techniques (proposés)

| Élément | Choix | Pourquoi |
|---|---|---|
| Application | React + TypeScript, PWA | Un seul code pour tous les appareils, installable, hors ligne |
| Base locale | IndexedDB (Dexie) | Données sur l'appareil, fonctionne sans réseau |
| Cloud | **Supabase** (PostgreSQL + authentification + e-mails) | Offre gratuite suffisante pour démarrer, sauvegardes, envoi d'e-mails de réinitialisation |
| Hébergement de l'appli | GitHub Pages (gratuit), déployé automatiquement depuis le dépôt `TSENA-1` | Chaque mise à jour du code est en ligne en quelques minutes |
| Impression | Impression navigateur au format ticket (tous appareils) + Bluetooth direct sur Android/PC | iPhone ne permet pas le Bluetooth direct depuis une appli web |

---

## 17. Plan de réalisation pas à pas

| Étape | Contenu | Ce que vous pourrez faire à la fin |
|---|---|---|
| **0** | Validation de ce cahier des charges ✅ | — |
| **1** | Fondations : appli installable, connexion, rôles, super-admin, thème, logo, mode hors ligne + synchronisation | Installer l'appli, créer les utilisateurs |
| **2** | Catégories, articles, variantes, stock + **modèles Excel et import** | Charger votre stock actuel |
| **3** | Fournisseurs, achats Chine, expéditions, coût de revient, réception | Saisir les commandes en attente d'arrivage |
| **4** | Clients, commandes Facebook, préparation, livraisons, choix, retours, échanges | Travailler les commandes en ligne |
| **5** | Caisse boutique, paiements, tickets | Vendre en boutique |
| **6** | Trésorerie, dépenses, comptes livreurs, clôture + récapitulatif boss | Fermer la journée et envoyer le résumé |
| **7** | Tableaux de bord, rapports, bénéfice / perte, filtres, exports | Piloter l'activité |
| **8** | Sauvegardes, restauration, réinitialisation, journal d'audit, outils de réparation | Sécuriser les données |

Chaque étape est mise en ligne et testée avec vous avant de passer à la suivante.
