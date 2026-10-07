# TSENA

Logiciel de gestion commerciale : achats (Chine), stock, ventes en ligne et en boutique, livraisons, trésorerie et rapports — utilisable en ligne et hors ligne, sur téléphone et ordinateur (application web installable).

- **Application en ligne : https://ralinaivo-spec.github.io/TSENA-1/**
- Cahier des charges : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md)
- Relier au cloud : [docs/GUIDE_CLOUD.md](docs/GUIDE_CLOUD.md)

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 0 | Cahier des charges | ✅ validé |
| 1 | Application installable, connexion, rôles, utilisateurs, thème, logo, hors ligne, synchronisation, sauvegardes | ✅ |
| 2 | Catégories, articles, variantes, stock, inventaire, modèles Excel et import | ✅ |
| 3 | Fournisseurs, commandes Chine, paiements, réception avec facture transit, coût de revient | ✅ |
| 4 | Clients, commandes, préparation, livraisons, livreurs, zones, retours, échanges | ✅ |
| 5 | Caisse boutique, paiements, tickets 58 mm | à venir |
| 6 | Trésorerie, dépenses, comptes livreurs, clôture, récapitulatif | à venir |
| 7 | Tableaux de bord, rapports, bénéfice / perte | à venir |
| 8 | Sauvegardes avancées, réinitialisation par e-mail, outils | à venir |

## Première connexion

Identifiant `super-adm`, mot de passe d'origine fourni séparément — il doit être changé dès la première connexion.

## Technique

- React 19 + TypeScript, construit avec esbuild (`npm run build` → `dist/`), aucune autre dépendance.
- Données locales dans IndexedDB (`src/lib/db.ts`), file d'envoi et synchronisation « dernière modification gagnante » avec Supabase (`src/lib/sync.ts`, `supabase/schema.sql`).
- Service worker maison (`src/sw.js`) pour le fonctionnement hors ligne.
- Hébergement : GitHub Pages (`.github/workflows/deploy.yml`), Netlify (`netlify.toml`) ou Vercel (`vercel.json`).
