# Matrice de Conformité Académique — Job Hunter Agent for Fabien Lufbery

> **Avertissement d'intégrité** : Cette matrice relie chaque exigence du barème académique à son implémentation réelle, à ses tests vérifiés et à ses éventuels blocages externes. Seule l'évaluation du professeur détermine la note finale.

---

## Synthèse des 5 critères (5 × 20 % = 100 %)

| Critère | Poids | Implémentation | Preuves de tests | Statut factuel |
| --- | --- | --- | --- | --- |
| **1. Extension Chrome & collecte (4 plateformes)** | 20 % | `extension/manifest.json` (MV3), `extractors/{common,wttj,indeed,hellowork,meteojob}.js`, `content.js`, `background.js`, `popup.*`, `POST /api/jobs/ingest`, `GET/POST /api/extension/status` | 6 tests Vitest (`tests/extension-extractors.test.ts` + `tests/api-routes.test.ts`) validant JSON-LD/DOM des 4 plateformes, détection CAPTCHA sans contournement, zéro cookie, ingestion sécurisée + déduplication | **PASS** (code + fixtures + API ingest vérifiés ; collecte live navigateur à confirmer sur Chrome utilisateur) |
| **2. France Travail API v2** | 20 % | `src/lib/france-travail/{client,normalizer}.ts`, `POST /api/integrations/france-travail/test`, `POST /api/jobs/sync/france-travail` | 4 tests Vitest (`tests/france-travail.test.ts`) sur OAuth2 `client_credentials`, pagination `206`, `204`, refresh `401`, retry `429`, erreur clés invalides, refus de simulation | **PARTIAL / BLOCKED (Live)** — Implémentation 100 % réelle et tests simulés `PASS` ; appel live `BLOCKED` en attente des clés `FRANCE_TRAVAIL_CLIENT_ID` / `SECRET` de Fabien |
| **3. Gemini Fit & Tailoring** | 20 % | `src/lib/gemini/{client,scoring,tailoring}.ts`, `src/lib/export/documents.ts`, `POST /api/jobs/[id]/score`, `POST /api/applications`, `GET /api/applications/[id]/export` | 10 tests Vitest (`tests/gemini-and-security.test.ts` + `tests/cv-and-export.test.ts`) couvrant scoring 1–10 Zod, défense prompt injection, cache hash, tailoring complet, export PDF & DOCX round-trip | **PARTIAL / BLOCKED (Live)** — Implémentation `@google/genai` (`gemini-3.5-flash-lite`) + exports `PASS` ; appel live `BLOCKED` en attente de `GEMINI_API_KEY` |
| **4. Dashboard UI & Branding** | 20 % | Interface Next.js 16 dark glassmorphism (`src/app/(dashboard)/*`, `src/app/login/page.tsx`, `DashboardShell.tsx`), 7 sections complètes, éditeur côte à côte, validation humaine Gmail, Mode Démo isolé | Build production `next build` réussi + vérification navigateur réelle & captures d'écran desktop/mobile sur les 7 sections + branding explicite *Job Hunter Agent for Fabien Lufbery* | **PASS** |
| **5. GitHub, Vercel & Trello** | 20 % | Dépôt `job-hunter-agent-for-fabien-lufbery`, CI/CD & cron GitHub Actions, `README.md`, `docs/SETUP.md`, `docs/TRELLO_SUBMISSION.md`, `FINAL_REPORT.md` | Scan de secrets propre (`scripts/check-secrets.sh`), dépôt GitHub poussé, texte Trello prêt ; déploiement Vercel en attente d'authentification Vercel + `DATABASE_URL` | **PARTIAL / BLOCKED (Vercel)** — GitHub & Trello `PASS` ; déploiement cloud Vercel `BLOCKED` en attente de connexion au compte Vercel/Neon de Fabien |

---

## Détail des exigences transverses

| Exigence | Implémentation | Tests / Preuves | Statut |
| --- | --- | --- | --- |
| Import CV PDF & DOCX + édition/suppression | `src/lib/cv/{parser,extractor}.ts`, `/api/cv`, `/api/cv/upload`, `/cv` | `tests/cv-and-export.test.ts` (round-trip PDF `unpdf` & DOCX `mammoth`, zéro hallucination) | **PASS** |
| Normalisation + déduplication multi-sources + provenance | `src/lib/jobs/{normalize,repository}.ts`, table `jobs` | `tests/jobs-dedup-and-db.test.ts` (5 sources + fusion provenance WTTJ/Indeed en PostgreSQL) | **PASS** |
| Gmail OAuth2 + validation humaine + zéro email inventé | `src/lib/gmail/client.ts`, `/api/integrations/gmail/*`, `/api/applications/[id]/gmail/*` | `tests/gemini-and-security.test.ts` (blocage sans confirmation, blocage `.invalid`, MIME PDF, chiffrement AES-256-GCM) | **PARTIAL / BLOCKED (OAuth Live)** |
| Planification 09h00 & 18h00 Europe/Paris (DST) | `.github/workflows/daily-job-sync.yml`, `src/lib/automation/scheduler.ts`, `/api/cron/sync`, `scripts/install-macos-launchd.sh` | `tests/gemini-and-security.test.ts` (hiver CET + été CEST) + `tests/api-routes.test.ts` (`CRON_SECRET`) | **PASS** (activation GitHub Secrets après déploiement Vercel) |
| Sécurité & Mode Démonstration Public | `src/lib/auth/index.ts`, `src/lib/crypto/index.ts`, `src/lib/security/index.ts`, `src/lib/demo/data.ts` | Cookies HMAC HttpOnly, scrypt, rate-limit, séparation stricte Demo vs Owner, scan secrets 0 fuite | **PASS** |
