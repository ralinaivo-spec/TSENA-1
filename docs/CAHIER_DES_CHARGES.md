# TSENA — Cahier des charges (version 4.1, mise à jour le 09/10/2026 — refonte v4, phases 1 et 2)

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
- **Pages attribuées aux vendeurs** *(ajouté le 08/10/2026)* : dans la fiche utilisateur, l'admin coche la ou les pages (catégories principales) du vendeur, ex. Vendeur 1 → « Pyjamas Homme », Vendeur 2 → « Boxer ». À sa connexion, le vendeur voit d'abord : les **articles et le stock** de ses pages, les **articles proposés** dans ses commandes et à la caisse, **ses propres commandes** (et leurs compteurs sur l'accueil) et **ses clients**. Un bouton « Tout » permet de voir exceptionnellement les autres pages. Restent communs à tous : les **livraisons** (à livrer, en cours, livreurs). **Ventes sur place** : la liste du jour montre par défaut « Mes ventes » (bouton « Toutes »). Sans page cochée, le vendeur voit tout.


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

### 3.1 Pages et variantes *(refonte v4 — phase 1, 09/10/2026)*
Menu **Stock → Pages et variantes**.
- **Une page Facebook = une catégorie**, avec un **code court** (ex. « Lampe rechargeable » → LAMR, modifiable).
- Chaque page porte **autant de variantes que nécessaire** (Modèle, Type, Puissance, Taille, Couleur, Âge, Pointure, Matière…), dans l’ordre voulu, obligatoires ou facultatives. Chaque variante a ses **valeurs** : **libellé complet** (« B22 (baïonnette) ») et **code court** (« B22 »), proposé automatiquement avec un sens (« 7 watts » → 7W, « 2 ans » → 2A, « Bleu marine » → BLM) et modifiable.
- Rien n’est figé : ajout, renommage, réordonnancement à tout moment ; une variante ou une valeur déjà utilisée par des articles est **désactivée** (plus proposée) au lieu d’être supprimée. Ajout de plusieurs valeurs d’un coup (une par ligne).
- **Modèles proposés** à la création d’une page : Vêtements, Vêtements enfant, Chaussures, Électrique / lampes, Accessoires / bijoux, Vide ; plus des variantes courantes en un clic.
- **Article = une valeur par variante.** Nom automatique avec les codes courts (« LP1 B22 7W », modifiable), code article = code de la page + codes (« LAMR-LP1-B22-7W »), libellé complet affiché sur la fiche. Identifiant tiré de la combinaison : le même article créé sur deux appareils hors ligne ne fait qu’un.
- **Créer des articles** : on coche une ou plusieurs valeurs par variante → une ligne par combinaison (celles qui existent déjà sont signalées), on décoche ce qui n’existe pas, on saisit prix de revient, PV détail, PV gros (= détail si vide) et stock de départ, avec « Remplir toutes les lignes ».
- **Recherche** des articles (liste, stock, caisse, commandes, achats) dans le code, le nom, la page et les libellés et codes des valeurs, sans tenir compte des accents ni des majuscules, tous les mots tapés.
- Les anciens articles « couleur / taille » restent utilisables (bouton « créer un article simple »).

### 3.2 Import Excel par page *(phase 1)*
1. Créer la page et ses variantes (à la main). 2. Télécharger **le fichier de la page** (depuis la page ou Import Excel) : une colonne par variante avec **liste déroulante** des valeurs, puis Nom (facultatif), Prix de revient, PV détail, PV gros, Stock, Alerte stock bas ; les articles existants sont pré-remplis ; onglets « Listes » et « Mode d’emploi ». 3. Importer : **chaque ligne est contrôlée avant d’enregistrer** (valeur inconnue avec la liste des codes permis, variante obligatoire manquante, nombre invalide, doublon dans le fichier, PV détail manquant pour un nouvel article). Aperçu : nouveaux, mises à jour (avec le changement de stock), erreurs en rouge. L’import est bloqué tant qu’il y a des erreurs, sauf si l’on choisit d’importer seulement les lignes correctes. Valeurs acceptées par libellé ou par code, sans tenir compte des majuscules. Article existant : prix et coût mis à jour, stock remis à la quantité du fichier (mouvement « inventaire » tracé).

---

- **Photos des articles** *(ajouté le 08/10/2026)* : toute photo ajoutée (fiche article, import Excel, commande Chine) suit automatiquement le même traitement **avant** d'être enregistrée : redimensionnement à 480 px au plus grand côté → conversion en **JPEG** (format unique, fond blanc) → compression jusqu'à environ **40 Ko** avec une qualité suffisante → enregistrement. Les reçus de dépenses suivent le même principe (1000 px, ~110 Ko). **Une photo par couleur** quand un article a plusieurs couleurs avec des photos différentes (stockée une seule fois par couleur). Photos affichées en grand (caisse, choix des articles, tailles/couleurs) et **agrandies d'un toucher**. Outil « Optimiser les photos » (Paramètres → Outils) pour les photos plus anciennes.

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

### 7.A Refonte v4 — phase 2 *(09/10/2026)* — prime sur les points ci-dessous en cas de différence
**Deux types de vente seulement : vente sur place et vente à livraison.**

**Vente à livraison en 4 étapes** :
1. **Enregistrée** (la commande saisie ; l’ancienne étape « À confirmer » est supprimée) ;
2. **En attente de livraison** (bouton « Préparée — en attente de livraison ») ;
3. **En livraison** (remise au livreur) ;
4. **Retour livreur** → **Terminée** (livrée, livrée en partie ou refusée).

Onglets des commandes : Enregistrées, En attente de livraison, En livraison, Terminées, Annulées.

- **Étiquette du colis** (ticket **58 mm**) pendant la préparation :
  - contenu : n° de commande, client, téléphone et lieu en gros, articles avec les **choix**, articles, remise, frais de livraison, paiements déjà reçus, **« À ENCAISSER »** (dont articles / dont frais), ou « RIEN À ENCAISSER — DÉJÀ PAYÉ », observations ;
  - **QR code** qui ouvre la commande ;
  - impression depuis la commande, ou toutes les étiquettes d’un coup (Livraisons → En attente de livraison, cochées ou toutes) ;
  - QR natif sur imprimante ticket, image sur les autres imprimantes.
- **Paiement avant le retour du livreur** (MVola, espèces en boutique) : « Paiement reçu » à toute étape ; il est affiché comme déjà payé et n’est pas demandé au livreur.
- **Retrait en boutique** :
  - **commande enregistrée ou en attente** : bouton « Retrait en boutique » → la livraison est **annulée** (pas de frais, pas de livreur) et la commande devient une **vente sur place** au moment du paiement ;
  - **commande déjà chez le livreur** : au retour, « Le client vient chercher en boutique » → les articles reviennent en boutique, réservés pour le client, sans frais pour le client ni dédommagement pour le livreur ; elle devient une vente sur place quand le client paie.
  - Dans les récapitulatifs, ces ventes comptent comme ventes sur place.
- **Retour livreur** (Livraisons → Retour livreur), le compte avec le livreur en un seul écran :
  - par colis : **Livrée / Refusée**, « En partie / choix… », « Client en boutique… » ;
  - **frais de livraison modifiables** (client qui a payé moins) ; paiements déjà reçus affichés ;
  - totaux séparés : **prix des articles encaissés**, **frais encaissés auprès des clients**, **total que le livreur a en main**, frais qui lui reviennent (dont frais déjà payés à la boutique), reste des fois précédentes ;
  - **règlement des frais du livreur** :
    - **retenus** sur l’argent versé ;
    - **payés à part** (caisse ou Mobile Money, le livreur remet tout) ;
    - **plus tard** (sur son compte, à payer un autre jour depuis Comptes livreurs → Versement) ;
  - montant remis modifiable, compte de réception ; un colis avec un choix à préciser bloque seulement ce colis.
- **Livreurs = utilisateurs** :
  - rôle **« Livreur »** dans Utilisateurs, relié à une fiche livreur (existante ou créée automatiquement) ;
  - avec son accès, il voit **seulement « Mes livraisons »** : ses colis en cours (adresse, téléphone, articles, montant à encaisser, articles et frais séparés), ce qu’il doit rendre, ses dernières livraisons et ses versements ;
  - un livreur sans accès reste une simple fiche (Comptes livreurs).
- **Choix de tailles avec les articles par variantes** : en ajoutant un article à une commande, les articles voisins (même page, une seule variante différente, ex. les autres âges du même modèle) sont proposés pour « Vendu » ou « En choix ».
- **Caisse (vente sur place)** :
  - filtre par page ;
  - recherche dans le libellé des variantes ;
  - **code ou code-barres + Entrée = ajout direct** au panier (lecteur de code-barres) ;
  - tuiles avec les valeurs des variantes ;
  - sur téléphone, barre « Panier · total · Encaisser » toujours visible.

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
- **Vente interne (employés)** *(ajout du 08/10/2026)* : achat d'un employé en boutique. Dans la caisse, choisir « Vente interne (employé) » puis l'employé qui achète. Chaque article est vendu à son **prix de revient arrondi au palier supérieur** : à l'ariary supérieur par défaut (ex. 2 562,55 → 2 563 Ar), ou aux 50 / 100 / 500 / 1 000 Ar supérieurs (réglage dans Paramètres → Société). Prix non modifiable, pas de remise ni de prix de gros ; vente impossible si un article n'a pas de prix de revient. Numéro **VI-xxxx**, ticket « VENTE INTERNE » avec le nom de l'employé, stock mis à jour comme une vente normale. Les ventes internes comptent dans les ventes sur place et apparaissent à part (« dont ventes internes ») dans la synthèse, le récapitulatif envoyé au responsable et le rapport des ventes (filtre « Ventes internes »).

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

- *Réalisé (étape 6)* : menu **Argent → Trésorerie** : soldes en temps réel (ventes payées en boutique + mouvements), dépenses avec photo du reçu, autres revenus, virements entre comptes (avec frais de retrait), apports et retraits du gérant, solde de départ de chaque compte, opérations récurrentes à confirmer. Les paiements aux fournisseurs chinois peuvent sortir d'un compte (montant en Ariary). Remboursement d'un client (échange moins cher) depuis la commande. Versement des livreurs dans **Livraisons → Livreurs → « Versement »** : l'admin **coche les livraisons réellement effectuées** ; seules celles-ci sont comptées dans le montant à verser, les autres restent sur le compte du livreur et sont **reportées automatiquement** au versement suivant. Une livraison cochée encore « à confirmer » est marquée livrée ; une livraison pas faite, refusée ou avec retour se corrige par « Retour / anomalie ». Versement partiel possible (le reste est reporté), historique gardé ; les commandes versées ne peuvent plus changer de livreur. **Ticket des livraisons** (58 mm) à remettre au livreur : pour chaque commande, client, lieu, articles, ce que le client paie, frais, à verser, cases « Livré / Pas livré / Retour » et remarque ; il le rapporte au moment du versement.

### 9.5 Frais du livreur, paiements Mobile Money et corrections *(ajouté le 07/10/2026)*
- Le client paie d'abord les **articles**, puis les **frais de livraison**. Le livreur **garde ses frais** : ils ne sont **jamais** dans le « montant à encaisser » ni dans les totaux des ventes, des récapitulatifs ou du tableau de bord ; ils apparaissent seulement **pour information**, avec le total réellement payé par les clients.
- **À encaisser** (compte livreur) = ce que le livreur encaisse pour la boutique. Exemple : articles 50 000 Ar, Mobile Money 20 000 Ar → **30 000 Ar à encaisser** (+ ses frais qu'il garde).
- **Commande entièrement payée par Mobile Money** : 0 Ar à encaisser, mais la livraison reste dans le compte du livreur (trace de qui a livré). Si les frais ont aussi été payés à la boutique, ils sont comptés à part comme **« frais à reverser »** au livreur en espèces (déduits au versement).
- Par défaut, le client paie tout à la livraison ; dans la commande, « Paiement déjà reçu » permet d'indiquer un paiement total ou partiel par Mobile Money (boutons « Articles payés » / « Tout payé ») et affiche ce que le livreur encaissera.
- **Correction d'un paiement** (admin et gérant) : nouveau montant et/ou moyen, motif ; l'ancien montant, le nouveau, la date et l'utilisateur restent visibles sous le paiement, dans l'historique de la commande et dans le journal. Reste à payer et compte du livreur se recalculent.

- **Livraisons avec articles en choix** *(règle du 08/10/2026)* : tant que le client n’a pas dit ce qu’il garde, la livraison porte le badge rouge **« Choix à préciser (n) »** (liste des commandes, fiche commande, « En livraison », versement). On le précise avec le bouton **« Préciser le choix du client »** (fiche commande, onglet « En livraison » ou directement dans la fenêtre de versement) : pour chaque ligne « choix », le nombre de pièces gardées doit être saisi (0 si tout est rendu) avant de pouvoir valider. **Le versement de cette livraison est bloqué** (case non cochable, refus aussi côté calcul) tant que le choix n’est pas renseigné.

---

## 10. Récapitulatif journalier et hebdomadaire *(remplace la « clôture de caisse », modifié le 07/10/2026)*

Les livreurs versent généralement le lendemain (ou en fin de semaine) : il n'y a donc **pas de comptage des billets** ni de verrouillage de la journée. À la place :

### 10.1 Récapitulatif journalier (menu Argent → Récapitulatifs → Journée)
- **Ventes sur place** (liste, heure, paiement, montant).
- **Livraisons du jour** par livreur : commande, lieu, état (pas encore confirmée / livrée / refusée / versée), ce que le client paie, frais du livreur, **montant à verser**.
- **Comptes livreurs** : livraisons du jour, à verser pour le jour, déjà versé, **compte à ce jour** (y compris les livraisons non versées des jours précédents).
- **Paiements reçus** par compte (espèces boutique, MVola, Orange Money, Airtel Money, versements des livreurs), **dépenses** et **autres mouvements** (virements, apports, retraits, autres revenus, paiements fournisseurs).
- Soldes en fin de journée et **espèces attendues** (caisse + à verser par les livreurs) ; bénéfice brut pour les utilisateurs autorisés.
- Règle de comptage inchangée : un article parti chez un livreur (hors choix) est vendu le jour du départ ; ce qui revient est un retour le jour du retour.

- **Synthèse de la journée** (en tête du récapitulatif, et dans le message envoyé au responsable) : ventes sur place, livraisons (nombre) et **total général**, avec deux colonnes **« Montant sans retour »** (ce qui est vendu ou parti en livraison ce jour-là) et **« Montant avec retour »** (corrigé automatiquement quand les retours sont constatés au versement des livreurs, même les jours suivants) ; **par livreur** : nombre de livraisons, **frais qui lui reviennent**, retours, montants ; **par catégorie (page)**, avec le ou les vendeurs : montants sans / avec retour. Le jour même les deux montants sont égaux ; dès qu'un retour est enregistré, le récapitulatif du jour concerné est marqué **« corrigé »** et peut être renvoyé. Même synthèse jour par jour dans le récapitulatif de la semaine.

### 10.2 Récapitulatif hebdomadaire (lundi → samedi)
- Tableau **jour par jour** : sur place, livraisons, total des ventes, espèces reçues, mobile money, versements des livreurs, dépenses ; total de la semaine (le dimanche est ajouté seulement s'il y a eu de l'activité).
- **Comptes livreurs de la semaine** et **total à verser en espèces** par les livreurs en fin de semaine.

### 10.3 Envoi au responsable
Journée ou semaine, en un clic : WhatsApp, SMS, e-mail, partage (Messenger…), copie, impression 58 mm ou PDF.

- **Détail du bénéfice brut** *(ajout du 08/10/2026)* : tableau dépliable, article par article (variante) : pièces vendues (moins les retours), ventes, prix de revient par pièce, coût total, bénéfice. Bénéfice brut = total des ventes (remises et retours déduits) − pièces × prix de revient de chaque variante ; frais de livraison non comptés. Les articles vendus sans prix de revient sont signalés.

### 10.3 bis Caisse du jour des vendeurs *(ajout du 09/10/2026)*
Menu **Ventes → Caisse du jour** + raccourci sur l’accueil (droit « Caisse du jour », donné aux vendeurs et à l’admin / gérant).
- **Une seule caisse commune** pour tous les vendeurs : pas de caisse ni de suivi de dépenses par vendeur. Chaque dépense saisie va dans le compte **Caisse espèces**, quel que soit le vendeur ; son nom est noté (traçabilité).
- **Saisie des dépenses du jour** : montant, catégorie (Dépenses diverses par défaut), description obligatoire, photo du reçu facultative. Saisie le jour même uniquement ; un vendeur peut supprimer sa propre dépense du jour ; les autres corrections passent par le gérant (Trésorerie). Impossible sur une semaine déjà versée au patron.
- **Récapitulatif global du jour**, identique pour tous les vendeurs : ventes par page, **total des ventes de tous les vendeurs** (sur place / livraisons), détail et **total des dépenses de la caisse commune**, **montant net du jour = total des ventes − dépenses de la caisse commune**.
- **Aperçu à vérifier avant l’envoi** : (1) tableau de toutes les ventes du jour de tous les vendeurs — heure, n°, type (sur place, livraison, retour), client, page, articles, vendeur, montant, total ; (2) tableau des totaux transmis (ventes par page, total, dépenses de la caisse commune, montant net) ; (3) **points à contrôler** : livraisons encore chez les livreurs, choix à préciser, commandes confirmées pas encore remises au livreur, ventes sans page, ventes à 0 Ar.
- **Vérification obligatoire** : le vendeur coche « ventes vérifiées », « dépenses vérifiées », « totaux confirmés » puis « Confirmer la vérification » (noté dans le journal d’activité). Les boutons WhatsApp ne s’activent qu’après. Si une vente ou une dépense change ensuite, l’envoi est de nouveau bloqué jusqu’à une nouvelle vérification.
- **Envoi WhatsApp en un clic** (après vérification) : au gérant, au patron (numéros dans Paramètres → Société) ou à un autre contact / groupe ; bouton Copier. Chaque envoi est noté dans le journal d’activité.

### 10.4 Tableau de la semaine et versement au patron *(ajout du 09/10/2026)*
Inspiré du cahier Excel « Recette et Dépense » (onglets RECAP JOURNALIER / HEBDOMADAIRE / MENSUEL).

- **Tableau de la semaine** (Récapitulatifs → Semaine) : une ligne par jour (lundi → samedi), une colonne par **page** (catégorie principale ayant des ventes ou un boost), puis **Total ventes**, **Dépenses** et **Reste** (= ventes − dépenses) ; ligne Total ; ligne **Boost** (dépense $ × taux du dollar, réglable dans Paramètres → Société, 4 700 Ar par défaut) ; ligne **Bénéfice** par page (ventes − coût des articles − boost, visible seulement avec le droit « Voir les prix d’achat… »). Export Excel (onglets Semaine et Dépenses).
- **Versement de la semaine** (droit « Valider le versement de la semaine au patron », donné à l’Admin / Gérant) :
  - semaine = **lundi → samedi** ; en ouvrant la vue Semaine un jour de semaine, c’est la **semaine précédente** qui s’affiche ;
  - **Montant à verser = total des ventes de la semaine − total des dépenses de la caisse commune** (compte « Caisse espèces » ; une dépense payée par MVola, banque… n’est pas déduite) ;
  - avant de valider, le gérant voit le détail : ventes par page, chaque dépense (jour, libellé, catégorie, compte, montant) et le montant à verser ; il saisit le **montant réellement remis** (par défaut le montant à verser), le compte d’où sort l’argent (caisse espèces par défaut) et une remarque (**obligatoire en cas d’écart**), puis coche la confirmation ;
  - possible seulement une fois la semaine terminée (à partir du samedi) ;
  - à la validation : une sortie de trésorerie « Versement au patron » est créée, la semaine est **clôturée**, et l’opération est tracée : période, montant attendu, montant remis, écart, date et heure, gérant, appareil, détail des ventes par page et des dépenses ;
  - **jamais deux fois la même semaine** : un seul versement par semaine (identifiant unique de la semaine, même depuis deux appareils hors ligne) ;
  - **semaine clôturée** : plus aucune vente sur place, remise au livreur, retour de livreur, retrait ou échange en boutique, ni ajout ou suppression de dépense ou de revenu ne peut y être daté ; le message indique qui a validé et quand ;
  - **annulation** (en cas d’erreur seulement, même droit) avec une raison obligatoire : la semaine est rouverte, l’annulation reste visible dans l’historique et le journal d’activité.
- **Historique des versements** : semaine, ventes, dépenses, à verser, remis, écart, validé par / le, remarque, état (versé / annulé) ; liste des **semaines terminées pas encore versées** (12 dernières) ; export Excel.

---

## 10 bis. Boosts publicitaires *(ajout du 08/10/2026)*

Menu **Ventes → Boosts pub** (droits « Saisir les résultats des boosts » pour les vendeurs, « Voir le suivi et l’analyse des boosts » pour le propriétaire).

- **Boost** : page (catégorie principale), **n°** = position dans la liste de l’Espace Pubs (1 = le premier), texte de la publicité, date de lancement, budget par jour ($). Seuls les boosts **actifs** sont enregistrés ; un boost qui n’est plus actif est **arrêté** (dernier jour + raison : peu performant, remplacé, budget terminé…). Un numéro déjà pris par un boost actif est refusé ; en modification, les deux numéros sont échangés.
- **Saisie du jour** (avant la fin de journée, par le vendeur) : pour chaque boost actif, la **dépense cumulée ($)** et les **conversations cumulées** affichées par Meta (bouton « = » si rien n’a changé), puis les **messages réellement reçus** sur la page ce jour-là. Tous les boosts actifs doivent être saisis.
- **Contrôle** : une valeur cumulée reste stable ou augmente, jamais elle ne baisse. Une valeur inférieure à la saisie précédente (ou supérieure à une saisie plus récente, en cas de correction) est signalée en rouge et l’enregistrement est bloqué.
- **Calcul** : messages théoriques du jour d’un boost = valeur du jour − valeur de la saisie précédente (la 1re saisie compte tout depuis le lancement) ; total théorique du jour = somme des boosts ; **écart = réel − théorique** (et réel en % du théorique) ; dépense du jour ; coût par message réel ; commandes en ligne de la page ce jour-là (pour suivre messages → commandes).
- **Semaine (lundi → dimanche)** : par page, tableau jour par jour (chaque boost, total théorique, réel, écart, dépense, coût par message, commandes) et totaux de la semaine ; vue « Toutes les pages » avec les totaux par page et par jour. Export Excel.
- **Performance des boosts** (7, 14 ou 30 jours) : par boost, messages, dépense, coût par message, messages des 3 derniers jours, total depuis le lancement, et un **avis** : Bon (≥ 20 % moins cher que la moyenne de la page), Moyen, Faible (≥ 30 % plus cher, aucun message depuis 3 jours, ou dépense sans message → à arrêter et remplacer), Trop récent. Bandeau d’alerte listant les boosts à arrêter. Export Excel.

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

### 11.4 Réalisé (étape 7)
- **Accueil (admin, gérant, propriétaire)** : période au choix (retenue sur l'appareil) ; chiffre d'affaires, bénéfice brut, dépenses, **bénéfice ou perte nette**, taux de marge, nombre de ventes (sur place / en ligne), panier moyen, taux de retour, chacun **comparé à la période précédente** ; graphique du bénéfice net par heure / jour / mois (barres rouges = perte) ; trésorerie par compte + à verser par les livreurs ; stock (pièces, valeur au coût et au prix de vente), arrivages en attente, reste à payer aux fournisseurs ; meilleurs articles ; articles dormants (60 jours sans vente).
- **Accueil (vendeur)** : ses ventes de la période (nombre, montant, pièces, graphique), sans les marges.
- **Menu Argent → Rapports** (droit « Voir les rapports complets ») : Bénéfice et perte (compte de résultat avec comparaison, graphique, mois par mois), Journal des ventes (filtres canal, vendeur, livreur, zone, paiement, recherche), Articles (par article ou catégorie, marge, retours, stock ; articles dormants), Clients, Livreurs (livraisons, taux de réussite, à encaisser sans les frais, frais à reverser, versé, solde), Vendeurs, Stock (valorisation), Achats. Tri sur chaque colonne, ligne de total, **export Excel**.
- **Récapitulatif mensuel** *(ajout du 09/10/2026, premier onglet des Rapports)* : 3, 6 ou 12 derniers mois ; par mois : ventes par page, **CA réalisé**, **dépenses**, **reste** (CA − dépenses), **versé au patron** (versements validés des semaines commençant dans le mois), **boost** en ariary et **bénéfice net estimé** (CA − coût des articles − boost − dépenses) ; cartes de totaux en tête ; export Excel.
- Les montants de coût et de marge ne s'affichent qu'avec le droit « Voir les prix d'achat, marges et bénéfices ». Les frais de livraison ne sont jamais dans le chiffre d'affaires.

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

- **Documents** : ticket de caisse (vente sur place, avec espèces reçues et monnaie rendue), ticket client d'une commande, **bon de livraison** (remis au livreur : client, lieu, articles et choix, **montant à encaisser**, signature), **feuille de route livreur** (toutes ses commandes en cours et le total à encaisser) et bons de livraison groupés.
- Format **58 mm** (32 colonnes) par défaut, 80 mm ou A4 possibles. Logo, nom, slogan, téléphone, adresse, NIF/STAT et message de pied de ticket repris de Paramètres → Société.
- **Choix de l'imprimante par son nom** au moment d'imprimer, depuis n'importe quel téléphone ou ordinateur, avec aperçu et nombre d'exemplaires. Le dernier choix devient l'imprimante par défaut de l'appareil.
- **Moyens d'impression** (Paramètres → Imprimantes, propres à chaque appareil) :
  - **Bluetooth direct** (Android Chrome, ordinateur Chrome/Edge), **USB direct** et **port série / Bluetooth appairé** (ordinateur) : impression ESC/POS, jeu de caractères réglable pour les accents, coupe papier en option, page de test ;
  - **fenêtre d'impression de l'appareil** (AirPrint sur iPhone/Mac, imprimantes installées sur Windows, PDF) : toujours disponible ;
  - **partage en image** (WhatsApp, Messenger, photos).
- **Poste d'impression partagé** : un appareil relié à l'imprimante (ex. téléphone Android ou ordinateur de la caisse) reçoit par le cloud les tickets envoyés par les autres appareils (iPhone compris) et les imprime automatiquement ; état en ligne / hors ligne visible et historique des impressions.
- Option par appareil : **ticket imprimé automatiquement après chaque vente sur place**.
- Imprimante conseillée : thermique 58 mm ESC/POS, Bluetooth + USB.
- *Plus tard* : étiquettes articles avec code-barres et prix, récapitulatif de clôture et rapports en PDF.

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

### 14.1 Réalisé (étape 8)
- **Copies automatiques dans le cloud** : une par jour, faite par l'appareil d'un admin ou du gérant (vérifié toutes les heures). Conservation : **7 quotidiennes, 5 hebdomadaires, 12 mensuelles** ; les plus anciennes sont effacées automatiquement, les copies manuelles jamais. Liste des copies avec restauration, suppression et nettoyage (Paramètres → Sauvegardes).
- **Fichier de sauvegarde** chiffré par mot de passe (facultatif), restauration par fichier ou depuis le cloud (super-admin, mot à taper « RESTAURER », sauvegarde de l'état actuel juste avant).
- **Effacer les données de test** (super-admin, Paramètres → Système) : choix des données (ventes, clients, trésorerie, mouvements de stock, achats, impressions, et si voulu articles, fournisseurs, livreurs, journal), en gardant toujours paramètres, utilisateurs, rôles, zones, catégories de dépenses, opérations récurrentes et imprimantes. Mot à taper « EFFACER », fichier + copie cloud juste avant, effacement envoyé à tous les appareils.
- **Remise à l'état d'origine** (super-admin) inchangée.
- **Mot de passe oublié par e-mail** (super-admin et gérant) : un lien est envoyé à l'adresse e-mail du **compte cloud de la société** ; en l'ouvrant sur un appareil relié au cloud, on choisit le nouveau mot de passe (lien valable 1 heure, réinitialisation tracée). Réglage nécessaire une fois dans Supabase : Authentication → URL Configuration → Site URL = adresse de l'application. La question secrète et la réinitialisation par le gérant restent possibles.
- **Code PIN** (4 à 6 chiffres, propre à chaque appareil, Mon compte) pour déverrouiller après le verrouillage automatique ; après 5 erreurs, le mot de passe est demandé.
- **Date de saisie commune** *(modifié le 09/10/2026)* (admin et gérant, Paramètres → Outils) : choisir un jour passé pour des essais ou pour rattraper un cahier. La date s’applique à **tous les utilisateurs et tous les appareils** (réglage synchronisé, reçu dès la synchronisation) et reste en place, même après déconnexion ou redémarrage, jusqu’à ce que l’admin ou le gérant la change ou clique « Revenir à aujourd’hui (tous) ». Ventes, commandes, livraisons, retours, paiements, versements, dépenses et mouvements de stock prennent ce jour (heure actuelle). Bandeau orange sur toutes les pages de tous les appareils, avec le nom de la personne qui a fixé la date ; seul l’admin / gérant voit le bouton de retour. Changement tracé dans le journal. La synchronisation garde l’heure réelle.
- **Outils** (admin, Paramètres → Outils) : vérification de la cohérence (stock recalculé depuis les mouvements, stocks négatifs avec correction tracée, variantes orphelines, articles sans coût, commandes sans livreur, trop-perçus, impayés, numéros en double), **export complet en Excel** (sans mots de passe ni photos), espace utilisé et nombre d'enregistrements ; **Tout resynchroniser** et **Chercher une mise à jour** (Système).

### Fonctionnement hors ligne et synchronisation fiable *(renforcé le 08/10/2026)*

- **Base locale sur chaque appareil** (IndexedDB) : tout est enregistré d’abord sur l’appareil, avec ou sans Internet. Chaque modification est mise dans une **file d’envoi** dans la même opération (rien ne peut être enregistré sans être mis en file). Envoi automatique dès que la connexion revient (et toutes les 15 s, au retour sur l’application, après chaque saisie).
- **Version par information** : chaque champ d’un enregistrement garde la date de sa dernière modification, donnée par une **horloge logique** qui ne recule jamais (elle tient compte des modifications déjà reçues : un téléphone à l’heure fausse ne fait pas gagner une ancienne valeur).
- **Fusion** : deux appareils qui modifient des informations différentes d’une même fiche gardent tous les deux leurs modifications ; les **paiements** et l’**historique** sont réunis élément par élément (deux paiements saisis hors ligne sur deux appareils = deux paiements). Même résultat sur tous les appareils, quel que soit l’ordre d’arrivée ; recevoir deux fois la même chose ne change rien.
- **Conflit réel** (la même information modifiée sur deux appareils avant synchronisation) : la plus récente est gardée partout ; l’autre valeur est notée dans **Paramètres → Cloud et synchronisation → Conflits** (qui, quel appareil, quand), avec « Rétablir l’autre valeur » ou « C’est bon ».
- **Pas de doublons** : identifiant unique créé sur l’appareil (un envoi répété remplace, n’ajoute pas) ; **lettre par appareil** dans les numéros (C-A0012, C-B0012, V-A0003…) ; un **client** est identifié par son téléphone et une **catégorie** par son nom (créés sur deux appareils hors ligne = une seule fiche) ; les mouvements de stock et de caisse sont des ajouts (jamais réécrits).
- **Convergence** : réception et fusion, envoi, puis nouvelle réception ; si la fusion garde des modifications locales, elles repartent automatiquement. Le cloud ne garde jamais une version plus ancienne qu’une plus récente.
- **Traçabilité** : chaque enregistrement garde la personne et l’appareil de la dernière modification ; journal d’activité ; liste des appareils reliés (lettre, dernière connexion).
- **Plusieurs onglets** ouverts sur le même appareil : ils se tiennent à jour entre eux.

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
