# Texte final à déposer sur Trello — Job Hunter Agent for Fabien Lufbery

Copiez-collez le bloc ci-dessous dans votre carte Trello (en remplaçant l'URL Vercel une fois le déploiement connecté à votre compte Vercel) :

---

**Projet :** Job Hunter Agent for Fabien Lufbery
**Exercice :** Antigravity Developer Challenge — Building an Autonomous Job Search Assistant

### Liens du projet
- **Dépôt GitHub :** https://github.com/fabienlufbery-hue/job-hunter-agent-for-fabien-lufbery
- **Application déployée (Vercel) :** https://job-hunter-agent-for-fabien-lufbery.vercel.app *(à confirmer après connexion Vercel + Neon PostgreSQL)*
- **Mode Démonstration Public (Évaluation) :** Sur la page de connexion, cliquez directement sur **« Explorer le Mode Démonstration (Données Fictives) »** pour visiter les 7 sections sans exposer mes données privées.

### Fonctionnalités livrées
1. **Extension Chrome Manifest V3 (`/extension`)** : collecte autorisée (JSON-LD + sélecteurs DOM) sur Welcome to the Jungle, Indeed, HelloWork et Meteojob, synchronisation sécurisée vers `POST /api/jobs/ingest` (zéro cookie, détection anti-bot sans contournement + importation assistée).
2. **API officielle France Travail Offres d'emploi v2** : authentification OAuth2 Client Credentials (`Job Hunter Agent - Fabien Lufbery`), gestion expiration/pagination/quotas `429`/erreurs, bouton de test réel dans *Settings*.
3. **Moteur IA Google Gemini (`@google/genai`)** : scoring structuré 1 à 10 validé Zod (11 champs + grille reproductible), protection anti-injection de prompts, cache anti-doublon par hash CV/Offre, génération complète (lettre de motivation, page de présentation, suggestions CV, bullet points, ATS, email) et export PDF/DOCX. *(Note : utilisation par défaut de `gemini-3.5-flash-lite` documentée suite à la dépréciation de `gemini-2.5-flash` au 1er décembre 2026, configurable via `GEMINI_MODEL`).*
4. **Dashboard Dark Glassmorphism personnalisé** : Overview, Job Matches, My CV (import PDF/DOCX + préférences), Applications (éditeur côte à côte + validation humaine obligatoire Gmail OAuth2), Automation (09h00 & 18h00 Europe/Paris DST-safe via GitHub Actions), Integrations (état réel vérifié des 9 services) et Settings.
5. **Qualité & Sécurité** : 26 tests automatisés Vitest (unitaires + intégration PostgreSQL + fixtures DOM 4 plateformes + round-trip PDF/DOCX), chiffrement AES-256-GCM des tokens OAuth2, scan de secrets propre, rapport complet dans `FINAL_REPORT.md` et matrice de conformité dans `docs/COMPLIANCE_MATRIX.md`.
