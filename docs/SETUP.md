# Guide de déploiement & variables d'environnement — Job Hunter Agent for Fabien Lufbery

## 1. Variables d'environnement Vercel requises

Dans **Vercel → `job-hunter-agent-for-fabien-lufbery` → Settings → Environment Variables** :

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `DATABASE_URL` | **Oui (Prod)** | Chaîne PostgreSQL Neon (`postgresql://...?sslmode=require`) |
| `AUTH_SECRET` | **Oui** | Secret aléatoire ≥ 32 octets (`openssl rand -hex 32`) pour signer les cookies HttpOnly |
| `ADMIN_EMAIL` | **Oui** | Votre email de connexion personnelle |
| `ADMIN_PASSWORD_HASH` (ou `ADMIN_PASSWORD`) | **Oui** | Mot de passe propriétaire (hash `scrypt` recommandé en prod) |
| `CRON_SECRET` | **Oui** | Secret partagé avec GitHub Actions pour `POST /api/cron/sync` |
| `NEXT_PUBLIC_APP_URL` | **Oui** | `https://job-hunter-agent-for-fabien-lufbery.vercel.app` |
| `GEMINI_API_KEY` | **Oui (IA)** | Clé API Google AI Studio (https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | Optionnel | Défaut : `gemini-3.5-flash-lite` (ou `gemini-3.8-flash`) |
| `APIFY_API_TOKEN` | **Oui (Offres)** | Jeton API depuis https://console.apify.com/settings/integrations |
| `APIFY_TASK_ID` | Optionnel | ID de tâche Apify par défaut (d'autres Tasks/Actors se gèrent directement dans *Settings*) |

## 2. Planification automatique 09h00 & 18h00 (Europe/Paris)

Le workflow `.github/workflows/daily-job-sync.yml` est déjà actif dans le dépôt GitHub.
Vérifiez dans **GitHub → Settings → Secrets and variables → Actions** :
- Variable `APP_URL` = `https://job-hunter-agent-for-fabien-lufbery.vercel.app`
- Secret `CRON_SECRET` = identique à celui de Vercel

Le workflow fonctionne de manière 100 % autonome même lorsque votre ordinateur est éteint.

## 3. Mise à jour non destructive de PostgreSQL / Neon

Au premier appel après déploiement, `src/db/index.ts` exécute un verrou transactionnel (`pg_advisory_xact_lock`) et applique uniquement des instructions `CREATE TABLE IF NOT EXISTS` et `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pour créer `apify_sources`, `apify_runs`, `app_settings` et enrichir `automation_runs` et `applications` sans jamais effacer vos données existantes.
