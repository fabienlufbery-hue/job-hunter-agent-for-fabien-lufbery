# Job Hunter Agent for Fabien Lufbery

**Migration : Gemini + Apify uniquement.** PostgreSQL, authentification, CV, candidatures, exports et mode démonstration sont conservés.

- Gemini analyse les offres et prépare les candidatures.
- Apify importe le dernier dataset réussi d'une tâche autorisée. Configurez la tâche et son planning dans Apify avant les imports 09h00 / 18h00. Aucun Actor payant n'est lancé par l'application.
- France Travail API, Gmail OAuth et ingestion Chrome sont désactivés (HTTP 410). Les offres historiques et les anciens envois sont conservés. Les candidatures sont désormais envoyées manuellement.
- Les modules et documents historiques restent présents pour traçabilité, mais ne constituent plus la configuration active.

## Configuration
Voir [docs/APIFY.md](docs/APIFY.md). Configurez `APIFY_API_TOKEN` et `APIFY_TASK_ID` dans Vercel. Conservez `GEMINI_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET` et les identifiants de connexion. Ne publiez aucun secret. Révoquez les accès historiques Gmail et France Travail côté fournisseurs après la migration. 

## Développement
```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run lint
npm run build
```

Ancienne documentation : disponible dans l'historique Git (commit antérieur à la migration).
