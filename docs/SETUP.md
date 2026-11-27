# Configuration et qualification des services

Les opérations de qualification utilisent un CV et des données de test. Renseigner les secrets dans l’environnement sécurisé de l’application à partir de `.env.example`.

## PostgreSQL sur Neon

Vérifier d’abord s’il existe un projet dédié, puis sélectionner son offre gratuite et une région européenne si une création est nécessaire. Copier l’URL de connexion de la base dans `DATABASE_URL`, avec TLS. Au premier accès, le serveur initialise son schéma dans une transaction sous verrou. Le fichier `drizzle/schema.sql` documente les tables.

Valider via l’interface privée en créant un CV de test, en l’éditant et en le relisant après redémarrage puis redéploiement. Supprimer le CV de test et vérifier le résultat. La route `/api/health` signale le mode et la persistance, sans afficher la chaîne de connexion.

## Gemini

Configurer `GEMINI_API_KEY` et `GEMINI_MODEL=gemini-3.5-flash-lite`. Tester dans **Settings**, puis évaluer une offre à partir d’un CV fictif et vérifier le score entier 1–10, les compétences et la génération de candidature. `store: false` désactive la conservation optionnelle des requêtes par l’application Gemini. Les modalités du compte Google restent applicables. [Dépréciations Google](https://aistudio.google.com/docs/changelog#11-02-2026)

## France Travail

L’API Offres d’emploi v2 est en accès restreint. Une demande d’accès peut être adressée au producteur. Après attribution, renseigner `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET` et, selon les droits attribués, `FRANCE_TRAVAIL_SCOPE`. Dans **Settings**, vérifier l’échange OAuth, puis lancer la récupération avec plusieurs filtres. [Fiche officielle et demande d’accès](https://www.data.gouv.fr/dataservices/api-offres-demploi)

## Gmail OAuth2

Activer Gmail API dans un projet Google Cloud. Pour un client de type **Application Web**, configurer chaque URI de redirection exacte : `http://localhost:3000/api/integrations/gmail/callback` et l’équivalent sur le domaine de production. Ajouter le compte Gmail aux utilisateurs de test si l’écran de consentement est en mode test. Renseigner `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et l’URI correspondant à l’environnement en cours. Protéger les jetons avec `TOKEN_ENCRYPTION_KEY`.

Connecter dans **Integrations**, créer un brouillon sur une candidature fictive, vérifier la pièce jointe, modifier le brouillon dans Gmail puis tester la déconnexion. L’autorisation `gmail.compose` couvre brouillons et envoi, ce dernier exigeant une confirmation humaine. [Portées Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes)

## Extension Chrome

Dans `chrome://extensions`, charger le dossier `extension` en mode développeur. Configurer le backend et le jeton `EXTENSION_INGEST_TOKEN`. Si l’URL HTTPS diffère de la valeur prédéfinie Vercel, l’extension demande l’accès à cette origine. Le panneau de collecte demande de sélectionner uniquement les sites qui autorisent la lecture automatisée. Pour les autres, utiliser l’import assisté avec l’URL originale. La collecte planifiée lit les onglets déjà ouverts et signale les vérifications qui nécessitent une action humaine.

## Vercel et GitHub Actions

Importer le dépôt `fabienlufbery-hue/job-hunter-agent-for-fabien-lufbery` et réutiliser le projet s’il existe. Configurer la production avec la région européenne indiquée dans `vercel.json` et les variables pertinentes de `.env.example`. Utiliser des valeurs aléatoires distinctes pour `AUTH_SECRET`, `CRON_SECRET`, `EXTENSION_INGEST_TOKEN` et `TOKEN_ENCRYPTION_KEY`. Définir `NEXT_PUBLIC_APP_URL` à l’origine réelle de production et protéger le compte administrateur par un mot de passe fort ou un hachage scrypt.

Les workflows se trouvent dans `.github/workflows`. Configurer la variable Actions `APP_URL` et le secret `CRON_SECRET` identique à celui de Vercel. Déclencher **Daily Job Sync** manuellement une fois. Comparer son `runId` et ses compteurs au journal de l’application. Les déclenchements planifiés sont à 09h00 et 18h00 **Europe/Paris**. Le serveur ignore un créneau déjà exécuté. Un échec complet est signalé dans Actions et dans l’historique. [Syntaxe GitHub Actions](https://docs.github.com/actions/reference/workflows-and-actions/workflow-syntax#onschedule)
