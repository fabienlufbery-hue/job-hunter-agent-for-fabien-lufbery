# Rapport de qualification — Job Hunter Agent for Fabien Lufbery

27 novembre 2026 · ESCE · Antigravity Developer Challenge

Le projet Antigravity a été repris à partir du dépôt existant et du commit `88a2e9e`. Le sujet officiel, qui comporte cinq critères de 20 %, a été relu avant modification. La [matrice](docs/COMPLIANCE_MATRIX.md) documente la preuve et la réserve associées à chaque critère.

## Audit et corrections

| Défaut constaté sur le projet d’origine | Correction apportée | Vérification |
|---|---|---|
| Le réveil de l’extension n’envoyait qu’un signal et un badge | Collecte sur des onglets déjà ouverts, pour les seules plateformes marquées comme autorisées, puis ingestion et état de résultat | Test du service worker avec onglets simulés, dont un onglet non autorisé et une barrière |
| Des domaines étaient identifiés par sous-chaîne et l’import manuel pouvait inventer sa provenance | Reconnaissance par hôte HTTPS explicite et import depuis l’URL originale saisie | Jeux de données des quatre extracteurs et routes locales |
| Permission Vercel générique et jeton accessible aux scripts de contenu | Hôte de production ciblé, permission ponctuelle pour une autre origine HTTPS, jeton dans les contextes de confiance, redirections HTTP refusées | Code et test d’alarme. Installation Chrome à qualifier |
| Les workflows étaient des modèles en dehors de `.github/workflows` | Workflows exécutables et planification native Europe/Paris, configuration manquante traitée en erreur | Contrôle du fichier et tests du backend. Exécution GitHub à vérifier avec le déploiement |
| Deux appels pouvaient lancer le même créneau et une recherche complètement échouée renvoyait HTTP 200 | Réservation atomique en base par jour et heure de Paris, journal d’erreurs et HTTP 503 pour un échec complet | Deux appels concurrents ne créent qu’un journal. Tests été/hiver |
| Des insertions concurrentes pouvaient se heurter à l’index unique | Insertion atomique puis verrou de ligne pour fusionner provenance et métadonnées. Initialisation PostgreSQL sous transaction | Tests PostgreSQL embarqué et déduplication |
| Les offres importées par l’extension n’étaient pas incluses dans le lot serveur de scoring | Le lot reprend les offres sans analyse valide, y compris les imports navigateur. Les commandes manuelles restent disponibles | Tests de persistance et scoring simulé |
| Les retours amont pouvaient exposer leur corps brut et les paramètres Gemini étaient antérieurs à la migration | Retours expurgés, `store: false` et données de scoring minimisées et coordonnées détectées retirées du texte structuré par Gemini. Validation Zod des sorties | Tests Gemini simulés. Vérification avec une clé de test encore requise |
| Gmail demandait le scope d’envoi en plus de celui de rédaction et la reconnexion pouvait reprendre un ancien jeton | Scope de rédaction suffisant pour les deux actions, jeton de rafraîchissement réutilisé seulement pour le même compte, révocation prioritaire de ce jeton | Tests hors ligne. Raccordement réel à qualifier |
| ESLint ne démarrait pas et la compilation dépendait de Google Fonts | Configuration ESLint native, appels React adaptés, polices système et build webpack reproductible | ESLint, TypeScript et compilation de production |
| La matrice mélangeait des statuts et validait des intégrations encore non testées | Statut unique par critère, références officielles et séparation des preuves | Matrice relue avec le PDF |

## Vérifications hors production

- Les **26 tests d’origine** réussissent sur le commit de départ. La suite enrichie compte **31 tests**. Elle couvre l’horloge Paris, la réservation concurrente d’un créneau, la collecte Chrome simulée, l’isolation de la démo et le CRUD d’un CV fictif.
- ESLint, TypeScript, scan de secrets dans le texte courant et l’historique disponible, puis build de production Next.js. Le build génère **33 pages statiques** pendant son étape de génération et affiche l’inventaire des routes.
- Avec le schéma livré, PGlite sur disque a conservé un CV fictif modifié après fermeture et réouverture de la base. La suppression a ensuite été vérifiée.
- Le serveur de la copie corrigée rencontre `listen EPERM` sur le port local dans cet environnement. Les captures déjà versionnées proviennent du projet initial et illustrent son interface. La recette visuelle du build corrigé reste à faire.
- Aucun appel Gemini, France Travail ou Gmail réel n’a été démontré. Aucun envoi de candidature n’a été effectué.

## Fournisseurs et blocages

**France Travail.** Le producteur indique que l’API Offres d’emploi n’est plus proposée dans le catalogue public et affiche « Accès restreint ». La fiche permet une demande d’accès via le formulaire France Travail. Les séries statistiques publiques portent sur des volumes agrégés. La qualification d’offres individuelles dépend d’une habilitation. [Fiche API](https://www.data.gouv.fr/dataservices/api-offres-demploi) · [Contact](https://francetravail.io/contact) · [Séries statistiques](https://www.data.gouv.fr/datasets/offres-demploi-diffusees-a-france-travail)

**Chrome.** L’extension exige une autorisation de la plateforme pour l’extraction, manuelle par bouton ou planifiée. L’import assisté reste disponible avec une URL d’origine et des données saisies par l’utilisateur. Indeed et Welcome to the Jungle publient des restrictions explicites. La lecture des CGU ne constitue pas une autorisation d’extraction pour HelloWork ou Meteojob. [Indeed](https://fr.indeed.com/legal) · [Welcome to the Jungle](https://www.welcometothejungle.com/fr/pages/terms) · [Meteojob](https://www.meteojob.com/conditions)

**Gemini.** Google confirme la dépréciation de Gemini 2.5 Flash et le routage vers Gemini 3.5 Flash-Lite à partir du 1er décembre 2026. Le remplacement recommandé est configuré, avec possibilité de sélectionner une autre référence via l’environnement. La clé apparue sur une capture doit être renouvelée dans AI Studio et fournie dans le champ sécurisé du serveur. [Notes Google du 2 novembre](https://aistudio.google.com/docs/changelog#11-02-2026)

**Vercel, Neon et Trello.** L’URL candidate renvoyait `404 DEPLOYMENT_NOT_FOUND` lors du contrôle public. L’accès aux consoles et la validation finale du rendu restent nécessaires. L’activation de la planification GitHub dépend ensuite d’une URL HTTPS active et du même secret de cron côté serveur et côté Actions.

[Dépôt GitHub](https://github.com/fabienlufbery-hue/job-hunter-agent-for-fabien-lufbery) · [Texte de rendu](docs/TRELLO_SUBMISSION.md)
