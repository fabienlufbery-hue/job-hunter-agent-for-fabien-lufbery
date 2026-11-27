# Configuration Apify API v2 — Job Hunter Agent for Fabien Lufbery

## 1. Obtenir votre jeton API Apify

1. Connectez-vous sur https://console.apify.com/settings/integrations.
2. Copiez votre **Personal API token**.
3. Ajoutez-le dans **Vercel → Project Settings → Environment Variables** sous le nom exact :
   - `APIFY_API_TOKEN` *(uniquement côté serveur — jamais exposé dans le navigateur)*
   - *(Optionnel)* `APIFY_TASK_ID` : si vous avez déjà une Saved Task par défaut, l'application la créera automatiquement comme source initiale.

## 2. Sélectionner vos Tasks ou Actors dans Settings

Une fois connecté à votre tableau de bord → **Settings** :

1. Cliquez sur **« Tester la connexion Apify & découvrir mes Tasks »**.
   - L'application appelle `GET https://api.apify.com/v2/users/me` et `GET https://api.apify.com/v2/actor-tasks`.
   - Toutes vos **Saved Tasks** existantes s'affichent avec un bouton **+ Ajouter** en un clic.
2. Vous pouvez aussi ajouter directement un **Actor vérifié du Store Apify** (ou tout autre Actor/Task autorisé) :
   - Indeed : `curious_coder/indeed-scraper`
   - LinkedIn : `curious_coder/linkedin-jobs-scraper`
   - Welcome to the Jungle : `bebity/welcome-to-the-jungle-jobs-scraper`
   - HelloWork : `sbzh/hellowork-jobs-scraper`
   - Meteojob : `stealth_mode/meteojob-jobs-search-scraper`
3. Choisissez le mode d'exécution par source :
   - **`run_and_fetch`** : l'application lance l'Actor ou la Task avec vos préférences de recherche (mots-clés, ville, contrat — **aucune donnée personnelle ni CV**) en appliquant `maxTotalChargeUsd`, `maxItems` et `timeout`.
   - **`fetch_last_dataset`** : l'application importe uniquement le dernier dataset `SUCCEEDED` déjà exécuté côté Apify Console (aucun coût supplémentaire déclenché par Vercel).

## 3. Contrôle des coûts & exécutions longues

- Configurez dans **Settings → Limites de consommation** :
  - **Budget mensuel Apify ($)** : bloque automatiquement tout nouveau lancement payant si le plafond mensuel est atteint.
  - **Plafond par run ($)** : transmis à Apify via `maxTotalChargeUsd`.
  - **Max offres / source** : transmis via `maxItems`.
  - **Timeout (sec)** : transmis via `timeout`.
  - **Délai anti-doublon (min)** : empêche les relances manuelles simultanées ou accidentelles.
- Si un run Apify dépasse la fenêtre de polling de la fonction Vercel, il reste enregistré en statut `running` et se finalise via le bouton **Actualiser Apify**, le webhook signé `/api/apify/webhook` ou la prochaine synchronisation automatique.

## 4. Conformité & sources autorisées

N'utilisez que des Actors/Tasks accédant à des données publiques autorisées, dans le respect des conditions d'utilisation des plateformes. Ne renseignez jamais de cookies ou d'identifiants de session dans un Actor.
