# Rapport de qualification — Job Hunter Agent for Fabien Lufbery

27 novembre 2026 · ESCE · Antigravity Developer Challenge

Le projet Antigravity a été repris à partir du dépôt existant et du commit `88a2e9e`. Le sujet officiel, qui comporte cinq critères de 20 %, a été relu avant modification. La [matrice](docs/COMPLIANCE_MATRIX.md) documente la preuve et la réserve associées à chaque critère.

## Audit et corrections

| Défaut constaté sur le projet d’origine | Correction apportée | Vérification |
|---|---|---|
| Le réveil de l’extension n’envoyait qu’un signal et un badge | Collecte sur des onglets déjà ouverts, pour les seules plateformes marquées comme autorisées, puis ingestion et état de résultat | Test du service worker avec onglets simulés, dont un onglet non autorisé et une barrière |
| Des domaines étaient identifiés par sous-chaîne et l’import manuel pouvait inventer sa provenance | Reconnaissance par hôte HTTPS explicite et import depuis l’URL originale saisie | Jeux de données des quatre extracteurs et routes locales |
| Permission Vercel générique et jeton accessible aux scripts de contenu | Hôte de production ciblé, permission ponctuelle pour une autre origine HTTPS, jeton dans les contextes de confiance, redirections HTTP refusées | Code et test d’alarme. Installation Chrome à qualifier |
| Les workflows étaient des modèles en dehors de `.github/workflows` | Workflows exécutables et planification native Europe/Paris, configuration manquante traitée en erreur | Appel manuel réel de GitHub à Vercel, enregistré dans Neon. Échec France Travail signalé en HTTP 503 |
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
- Le serveur local a rencontré `listen EPERM` dans l’environnement de travail. Le runner GitHub a lancé le build de production et validé les sept écrans à 1440 et 390 pixels de large dans Chrome, les filtres, la lettre, le blocage des mutations démo et l’envoi Gmail désactivé. Il a produit 18 captures du build corrigé. [Exécution CI et captures](https://github.com/fabienlufbery-hue/job-hunter-agent-for-fabien-lufbery/actions/runs/45974284800)
- Aucun appel Gemini, France Travail ou Gmail réel n’a été démontré lors de cette qualification. Aucun envoi de candidature n’a été effectué.

## Fournisseurs et blocages

**France Travail.** Le producteur indique que l’API Offres d’emploi n’est plus proposée dans le catalogue public et affiche « Accès restreint ». La fiche permet une demande d’accès via le formulaire France Travail. Les séries statistiques publiques portent sur des volumes agrégés. La qualification d’offres individuelles dépend d’une habilitation. [Fiche API](https://www.data.gouv.fr/dataservices/api-offres-demploi) · [Contact](https://francetravail.io/contact) · [Séries statistiques](https://www.data.gouv.fr/datasets/offres-demploi-diffusees-a-france-travail)

**Chrome.** L’extension exige une autorisation de la plateforme pour l’extraction, manuelle par bouton ou planifiée. L’import assisté reste disponible avec une URL d’origine et des données saisies par l’utilisateur. Indeed et Welcome to the Jungle publient des restrictions explicites. La lecture des CGU ne constitue pas une autorisation d’extraction pour HelloWork ou Meteojob. [Indeed](https://fr.indeed.com/legal) · [Welcome to the Jungle](https://www.welcometothejungle.com/fr/pages/terms) · [Meteojob](https://www.meteojob.com/conditions)

**Gemini.** Google confirme la dépréciation de Gemini 2.5 Flash et le routage vers Gemini 3.5 Flash-Lite à partir du 1er décembre 2026. Le remplacement recommandé est configuré, avec possibilité de sélectionner une autre référence via l’environnement. La clé apparue sur une capture doit être renouvelée dans AI Studio et fournie dans le champ sécurisé du serveur. [Notes Google du 2 novembre](https://aistudio.google.com/docs/changelog#11-02-2026)

**Vercel.** Le déploiement Hobby a été ouvert en session indépendante, de l’écran de connexion à la démonstration puis aux sept écrans du tableau de bord. Le branding est visible et le parcours utilise le jeu de données fictif. [Démo publique](https://job-hunter-agent-for-fabien-lufbery.vercel.app)

**Neon.** La base dédiée existante, sur le plan gratuit en Ohio, a été réutilisée. L’endpoint de santé de la production après redéploiement indique PostgreSQL connecté et persistant. Le test SQL a créé un enregistrement de qualification, modifié sa valeur de 5 à 8, l’a relu après la réouverture de la session Neon, puis l’a supprimé. La table d’exemple exécutée lors du premier essai a été nettoyée. [Santé de la production](https://job-hunter-agent-for-fabien-lufbery.vercel.app/api/health)

**GitHub Actions.** L’URL de production et le secret ont été configurés, et le workflow déclenché manuellement. La réponse de Vercel contient le journal `b7a06b3a-6000-4352-a1d9-aa9aeb2db708`, un HTTP 503 et le motif `NOT_CONFIGURED` pour France Travail. Le déclenchement et la journalisation ont fonctionné. La récupération d’offres est bloquée par l’habilitation. [Exécution manuelle](https://github.com/fabienlufbery-hue/job-hunter-agent-for-fabien-lufbery/actions/runs/45975246745)

**Gmail.** La console Google Cloud exige une validation du compte et l’acceptation des conditions. L’authentification OAuth, le brouillon distant, la modification et la déconnexion restent en attente.

**Trello.** Les deux liens sont vérifiés et le commentaire est prêt. La publication est soumise à l’accord de Fabien.


[Dépôt GitHub](https://github.com/fabienlufbery-hue/job-hunter-agent-for-fabien-lufbery) · [Texte de rendu](docs/TRELLO_SUBMISSION.md)
