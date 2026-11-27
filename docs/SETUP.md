# Guide d'installation et de configuration des API — Job Hunter Agent for Fabien Lufbery

Ce guide détaille pas à pas la configuration de chaque service externe sans jamais exposer de secret dans le code source ni dans Git.

---

## 1. Base de données PostgreSQL persistante (Neon — gratuit et natif Vercel)

1. Créez un compte gratuit sur [https://neon.tech](https://neon.tech) (ou connectez l'intégration **Neon** depuis le dashboard Vercel → *Storage*).
2. Créez une base dans la région **Europe (Frankfurt / Paris)**.
3. Copiez la chaîne de connexion **Pooled connection string** (`postgresql://...?sslmode=require`).
4. Renseignez-la dans la variable d'environnement `DATABASE_URL` (local `.env.local` et Vercel).
5. Au premier appel, l'application crée automatiquement toutes les tables PostgreSQL définies dans `drizzle/schema.sql`.

---

## 2. API France Travail Offres d'emploi v2

1. Rendez-vous sur [https://francetravail.io/data/api](https://francetravail.io/data/api) et connectez-vous.
2. Créez une application nommée exactement : **`Job Hunter Agent - Fabien Lufbery`**.
3. Ajoutez l'API **Offres d'emploi v2** (`api_offresdemploiv2`, scope `o2dsoffre`).
4. Récupérez :
   - `FRANCE_TRAVAIL_CLIENT_ID` (Identifiant client)
   - `FRANCE_TRAVAIL_CLIENT_SECRET` (Clé secrète)
5. Ajoutez ces deux variables dans `.env.local` et dans les variables d'environnement Vercel.
6. Dans le tableau de bord → **Settings**, cliquez sur **« Tester la connexion France Travail »** pour vérifier l'authentification OAuth2 réelle et le nombre d'offres accessibles.

---

## 3. API Google Gemini (`@google/genai`)

1. Ouvrez [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Créez une clé API Gemini (`GEMINI_API_KEY`).
3. Configurez :
   - `GEMINI_API_KEY` = votre clé
   - `GEMINI_MODEL` = `gemini-3.5-flash-lite` *(successeur recommandé par Google suite à la dépréciation de `gemini-2.5-flash` au 1er décembre 2026)*
4. Vérifiez dans le tableau de bord → **Settings** → **« Tester la connexion Google Gemini »**.

---

## 4. Intégration Gmail OAuth2 (Google Cloud Console)

1. Ouvrez [https://console.cloud.google.com](https://console.cloud.google.com) et créez/sélectionnez un projet.
2. Dans **APIs & Services → Library**, activez **Gmail API**.
3. Dans **Google Auth Platform / OAuth consent screen** :
   - Type : **External**, statut **Testing**.
   - Ajoutez votre adresse Gmail dans **Test users**.
   - Ajoutez uniquement les scopes minimaux :
     - `https://www.googleapis.com/auth/gmail.compose`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/userinfo.email`
4. Dans **Credentials → Create Credentials → OAuth client ID (Web application)** :
   - Ajoutez les **Authorized redirect URIs** :
     - `http://localhost:3000/api/integrations/gmail/callback`
     - `https://job-hunter-agent-for-fabien-lufbery.vercel.app/api/integrations/gmail/callback`
5. Configurez `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `GOOGLE_REDIRECT_URI` dans `.env.local` et Vercel.
6. Dans **Integrations → Gmail API**, cliquez sur **Connecter Google**.

---

## 5. Secrets d'authentification et de sécurité

Générez trois secrets aléatoires robustes dans un terminal :

```bash
openssl rand -hex 32   # -> AUTH_SECRET
openssl rand -hex 24   # -> EXTENSION_INGEST_TOKEN
openssl rand -hex 24   # -> CRON_SECRET
```

Configurez également :
- `ADMIN_EMAIL` : votre email de connexion personnelle
- `ADMIN_PASSWORD` : votre mot de passe personnel fort

---

## 6. Déploiement Vercel & Automatisation GitHub Actions

1. Connectez-vous sur [https://vercel.com](https://vercel.com) → **Add New Project** → importez `fabienlufbery-hue/job-hunter-agent-for-fabien-lufbery`.
2. Vérifiez que le nom du projet est **`job-hunter-agent-for-fabien-lufbery`**.
3. Ajoutez toutes les variables d'environnement dans *Settings → Environment Variables* puis lancez **Deploy**.
4. Dans GitHub → *Repository Settings → Secrets and variables → Actions*, ajoutez :
   - `APP_URL` = `https://job-hunter-agent-for-fabien-lufbery.vercel.app`
   - `CRON_SECRET` = la même valeur que sur Vercel
5. Activez les workflows GitHub Actions (le jeton OAuth `gh` requiert le scope `workflow`) :
   ```bash
   gh auth refresh -s workflow
   mkdir -p .github/workflows
   cp automation/github-workflows/*.yml .github/workflows/
   git add .github/workflows && git commit -m "ci: enable GitHub Actions workflows" && git push
   ```
   Le workflow synchronisera automatiquement France Travail et scorera les nouvelles offres chaque jour à **09h00** et **18h00 (Europe/Paris)**.
