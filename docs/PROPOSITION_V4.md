# TSENA — Proposition de refonte v4.1 (à valider)

> Reformulation de vos demandes du 09/10/2026, complétée avec vos réponses du même jour (v4.1), avec une solution simple pour chacune.
> Les **boosts publicitaires** sont gardés tels quels : vous les reverrez à part.
> ✅ = déjà en place (à garder ou à ajuster) · 🆕 = à créer · 🔧 = à modifier.

---

## 1. Pages (catégories), variantes et articles 🔧

**Règle de base : une page Facebook = une catégorie.**

**Votre besoin.** Chaque catégorie définit d'abord ses propres variantes, puis on crée les articles en choisissant une valeur par variante. Rien n'est figé : cela doit marcher pour toute sorte de produits (lampes, pyjamas, sandales, coffrets, motos…).

### 1.1 Les variantes de chaque catégorie, libres et sans limite
- Une catégorie peut avoir **autant de variantes que nécessaire** (Modèle, Type, Puissance, Taille, Couleur, Matière, Âge…).
- Chaque variante a sa **liste de valeurs**. On peut à tout moment **ajouter, renommer, réordonner, désactiver ou supprimer** une variante ou une valeur.
- Une valeur déjà utilisée par des articles n'est pas supprimée mais **désactivée** : elle disparaît des choix, et l'historique reste juste.
- **Variante obligatoire ou facultative** : par exemple, « Couleur » peut rester vide pour certains articles.

### 1.2 Des modèles de variantes proposés par défaut (on garde ce qu'on veut)
À la création d'une catégorie, TSENA **propose** des variantes courantes, à cocher ou décocher. On peut aussi en créer de nouvelles.

| Modèle proposé | Variantes suggérées | Valeurs d'exemple (modifiables) |
|---|---|---|
| Vêtements | Taille, Couleur, Âge | S, M, L, XL · Rouge, Bleu · 2 ans, 4 ans… |
| Chaussures | Pointure, Couleur | 36 → 45 |
| Électrique / lampes | Modèle, Type de culot, Puissance | E27, B22 · 7 W, 12 W… |
| Accessoires / bijoux | Modèle, Couleur, Matière | — |
| Vide | Aucune | On crée tout soi-même |

### 1.3 Le nom de l'article : automatique, avec des abréviations qui ont un sens
Chaque valeur a un **libellé complet** et un **code court** (abréviation). TSENA propose le code, et vous pouvez le corriger.

| Variante | Libellé complet | Code court |
|---|---|---|
| Modèle | LP1 — simple batterie | LP1 |
| Type | B22 — baïonnette | B22 |
| Puissance | 7 watts | 7W |
| Couleur | Bleu marine | BLM |

- **Nom de l'article** = codes mis bout à bout : **LP1 B22 7W**. Il reste modifiable.
- Le **libellé complet** s'affiche à côté du nom à l'écran, sur le ticket et sur l'étiquette du colis : « LP1 B22 7W — simple batterie, baïonnette, 7 watts ».
- **Code article** (pour la recherche et le code-barres) = code de la page + codes des valeurs, par exemple **LAMP-LP1-B22-7W**.

### 1.4 Créer les articles
1. Choisir la catégorie.
2. Choisir une valeur par variante.
3. Saisir le prix de revient, le PV détail, le PV gros et le stock de départ.

Un bouton **« Créer toutes les combinaisons »** propose d'un coup tous les articles possibles ; on décoche ceux qui n'existent pas, et on peut saisir les prix en tableau, comme dans Excel. Cela remplace le système actuel « couleur / taille » commun à tout le magasin.

## 2. Import du stock par Excel 🔧

Ordre imposé, simple :
1. Vous créez **à la main** la catégorie et ses variantes, avec leurs valeurs et leurs codes (point 1).
2. Le logiciel génère **un fichier Excel propre à cette catégorie** : une colonne par variante (autant qu'il y en a), avec une **liste déroulante** des valeurs permises, puis Prix de revient, PV détail, PV gros, Quantité en stock.
3. Vous le remplissez et vous l'importez. Le logiciel contrôle chaque ligne (valeur inconnue, prix manquant, doublon) **avant** d'enregistrer, et affiche les erreurs ligne par ligne.

## 3. Ventes : deux types seulement 🔧

### 3.1 Vente sur place ✅ (écran à refaire pour la caisse)
Le client est là : il choisit, paie, repart avec l'article.
- **Écran « caisse » adapté** à l'ordinateur, la tablette et le téléphone : grandes tuiles d'articles, recherche, lecteur de code-barres, panier à droite (en bas sur téléphone), gros boutons de paiement (espèces, MVola, Orange Money, Airtel Money, mixte).
- **Ticket** imprimé depuis l'ordinateur ou le téléphone, avec n'importe quelle imprimante : format A4/A5, ou ticket 58 mm / 80 mm. Le tiroir-caisse s'ouvrira par l'imprimante ticket quand vous aurez l'appareil.

### 3.2 Vente à livraison 🔧 (4 étapes claires)

| Étape | Ce qu'on fait | Qui |
|---|---|---|
| **1. Enregistrée** | Commande reçue (Facebook, appel…) : client, téléphone, lieu, articles, choix éventuels, frais de livraison, livreur prévu | Vendeur |
| **2. En attente de livraison** | Commande préparée, prête à partir | Vendeur |
| **3. En livraison** | Le livreur prend le colis : on l'**affecte** (ou on confirme le livreur prévu) | Vendeur |
| **4. Retour livreur** | On fait le compte avec le livreur (voir ci-dessous) | Vendeur / gérant |
| → **Terminée** | Livrée, livrée en partie ou refusée, et le compte est soldé | — |

L'étape « À confirmer » actuelle disparaît.

**Étiquette du colis 🆕.** Pendant la préparation (étape 2), un bouton **« Imprimer l'étiquette »** imprime une fiche à coller sur le colis :
- nom du client ou nom Facebook, **téléphone**, **lieu de livraison** et repère, date et créneau prévus ;
- numéro de commande et **QR code**, qui ouvre la commande quand on le scanne avec le téléphone ;
- articles et quantités, en indiquant les **choix** (« 3 tailles à essayer, 1 seule à payer ») ;
- **montant à encaisser**, avec le prix des articles et les frais de livraison séparés : « déjà payé : 20 000 Ar par MVola » ou « RIEN À ENCAISSER — déjà payé » ;
- livreur prévu et observations.

**Format : ticket de caisse 58 mm** (même imprimante que les tickets). Un bouton « Imprimer toutes les étiquettes » imprime à la suite, une étiquette par commande, toutes celles en attente d'un livreur.

**Le client vient finalement chercher sa commande 🆕.** Quand une commande est **en attente de livraison** ou **déjà en livraison** et que le client décide de venir la récupérer en boutique, un bouton **« Retrait en boutique »** :
- **si le colis est encore à la boutique** : la commande devient une **vente sur place**. On encaisse, la commande est terminée, il n'y a pas de frais de livraison et pas de livreur ;
- **si le colis est déjà chez le livreur** : le livreur le rapporte. Au retour, on choisit « Le client récupère en boutique » au lieu de « Livré » ou « Refusé ». Le colis revient en stock réservé pour ce client ; quand le client passe, on encaisse et la commande devient une **vente sur place** ;
- **frais de livraison** : la livraison est simplement **annulée**. Il n'y a pas de frais de livraison pour le client et **pas de dédommagement pour le livreur** ;
- la commande garde son historique (« Prévue en livraison → retirée en boutique le … ») et elle est comptée dans les **ventes sur place** du jour où le client paie.

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

Le compte de chaque livreur montre ce qu'il doit, ce qu'on lui doit et l'historique. **Les livreurs deviennent des utilisateurs 🆕.**
- Dans **Utilisateurs**, on choisit le rôle **« Livreur »**. Sa fiche (nom, téléphone, zones, frais habituels) est créée en même temps : il n'y a plus de liste de livreurs à part.
- Avec son propre accès, il voit **seulement** ses colis du jour (adresse, téléphone, montant à encaisser), ce qu'il doit à la boutique, ce que la boutique lui doit, et son historique.
- Un livreur sans téléphone ou sans compte peut quand même exister : on lui crée un utilisateur **sans accès**, simplement pour suivre son compte.

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

Chaque champ de recherche cherche dans **tout le contenu** : nom, téléphone, nom Facebook, lieu, observations, numéro, articles, valeurs des variantes (ex. « B22 », « 7W »), montants. Il ignore les accents, les majuscules et les espaces dans les numéros (« 034 12 » = « 03412 »).

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

**Menu de gauche (réorganisé) :**

| Ordre | Menu | Contenu |
|---|---|---|
| 1 | **Tableau de bord** | Ventes, commandes, argent |
| 2 | **Vente sur place** | Caisse |
| 3 | **Ventes à livraison** | Enregistrées, en attente, en livraison, terminées |
| 4 | **Livreurs** | Retour livreur, comptes livreurs |
| 5 | **Clients** | Fiches et historique |
| 6 | **Dépenses** | Dépenses et charges fixes |
| 7 | **Caisse du jour et récapitulatifs** | Jour, semaine, versement au patron |
| 8 | **Articles et stock** | Pages / catégories, variantes, articles, stock |
| 9 | **Achats et réceptions** | Un seul menu : commandes Chine, frais, arrivages, réception en stock |
| 10 | **Boosts pub** | Inchangé |
| 11 | **Rapports** | Analyses par période |
| 12 | **Import / Export** 🆕 | Tout ce qui s'importe ou s'exporte au même endroit |
| 13 | **Paramètres** | Société, utilisateurs et rôles, impression, sauvegarde, cloud, outils… |

**Import / Export (menu à part).**
- Importer : articles et stock par catégorie, clients, achats.
- Exporter en Excel : ventes, commandes, clients, dépenses, stock, rapports, versements, et tout en un seul classeur.
- Chaque écran garde aussi son petit bouton « Excel » pour exporter ce qui est affiché.

**Paramètres** garde les **réglages** (société, numéros WhatsApp, utilisateurs et rôles, impression et imprimantes, sauvegarde, cloud, date de saisie, outils) : ce qu'on règle une fois, pas ce qu'on utilise chaque jour.

## 10. Listes longues : menus déroulants 🔧

Toute longue liste (clients, articles, livreurs, catégories, valeurs de variantes…) devient un **menu déroulant avec recherche**, sur une seule ligne, au lieu de prendre toute la page.

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
| **1** ✅ | Pages / catégories, variantes libres, articles, import Excel par catégorie (points 1-2) — **en ligne le 09/10/2026** | Indispensable avant de charger le stock |
| **2** | Ventes : caisse sur place, livraison en 4 étapes, étiquette colis, retrait en boutique, retour livreur, livreurs-utilisateurs (point 3) | Cœur du travail quotidien |
| **3** | Dépenses et charges, notifications (points 4, 7) | Suivi de l'argent |
| **4** | Clients, recherche, menus déroulants (points 5, 6, 10) | Confort de saisie |
| **5** | Thème, tableau de bord, nouveau menu (Achats et réceptions, Import / Export), page d'installation, compatibilité (points 8, 9, 11, 13) | Présentation finale |
| **6** | Sauvegardes, historique de synchronisation (points 12, 14) | Sécurité |

Chaque phase est mise en ligne et testée avec vous avant de passer à la suivante.

## Vos décisions du 09/10/2026

| Question | Décision |
|---|---|
| Catégorie et page Facebook | **Une page = une catégorie** |
| Nombre de variantes | **Sans limite**, rien n'est figé. Des modèles sont proposés par défaut, et on garde ce qu'on veut. |
| Nom de l'article | Automatique, avec des **abréviations qui ont un sens** (code court par valeur, libellé complet affiché à côté) |
| Livreurs | Ce sont des **utilisateurs avec le rôle « Livreur »** |
| Achats | Surtout en Chine : **Achats et réceptions réunis** dans un seul menu. Import et export réunis dans un menu à part. Les réglages restent dans Paramètres. |
| Imprimante et tiroir-caisse | Pas encore achetés : impression **générale** depuis le PC ou le téléphone (A4/A5, étiquettes, ticket 58/80 mm). Le tiroir-caisse viendra avec l'appareil. |
| Étiquette colis | **Ajoutée**, au format **ticket de caisse 58 mm** (point 3.2) |
| Le client récupère sa commande lui-même | **« Retrait en boutique »** : la livraison est annulée (sans frais ni dédommagement livreur) et la commande devient une vente sur place (point 3.2) |

**Proposition validée de votre côté : plus aucun point en attente.**
