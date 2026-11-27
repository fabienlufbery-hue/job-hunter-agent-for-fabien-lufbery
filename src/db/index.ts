import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

export type AppDatabase = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

export type DbMode = 'postgres' | 'pglite_local' | 'pglite_memory' | 'unconfigured_vercel';

interface DbState {
  db: AppDatabase | null;
  mode: DbMode;
  initialized: boolean;
  initPromise: Promise<void> | null;
  pool: Pool | null;
  pglite: PGlite | null;
  lastError: string | null;
}

const globalForDb = globalThis as unknown as { __jobHunterDbState?: DbState };

function getState(): DbState {
  if (!globalForDb.__jobHunterDbState) {
    globalForDb.__jobHunterDbState = {
      db: null,
      mode: 'pglite_local',
      initialized: false,
      initPromise: null,
      pool: null,
      pglite: null,
      lastError: null,
    };
  }
  return globalForDb.__jobHunterDbState;
}

const BOOTSTRAP_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS master_cv (
    id TEXT PRIMARY KEY,
    file_name TEXT,
    file_type TEXT,
    raw_text TEXT NOT NULL DEFAULT '',
    full_name TEXT NOT NULL DEFAULT '',
    headline TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    experience_level TEXT NOT NULL DEFAULT '',
    education JSONB NOT NULL DEFAULT '[]'::jsonb,
    experiences JSONB NOT NULL DEFAULT '[]'::jsonb,
    technical_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    soft_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    languages JSONB NOT NULL DEFAULT '[]'::jsonb,
    certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    sectors JSONB NOT NULL DEFAULT '[]'::jsonb,
    links JSONB NOT NULL DEFAULT '[]'::jsonb,
    content_hash TEXT NOT NULL DEFAULT '',
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS search_preferences (
    id TEXT PRIMARY KEY,
    target_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    sectors JSONB NOT NULL DEFAULT '[]'::jsonb,
    cities JSONB NOT NULL DEFAULT '[]'::jsonb,
    department_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    commune_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    contract_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration TEXT NOT NULL DEFAULT '',
    remote_policy TEXT NOT NULL DEFAULT 'any',
    keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    min_fit_score INTEGER NOT NULL DEFAULT 6,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    external_id TEXT,
    dedupe_hash TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    contract_type TEXT,
    salary TEXT,
    description TEXT NOT NULL,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    published_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    original_url TEXT NOT NULL,
    source TEXT NOT NULL,
    provenance JSONB NOT NULL DEFAULT '[]'::jsonb,
    application_status TEXT NOT NULL DEFAULT 'new',
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    recruiter_email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS jobs_dedupe_hash_idx ON jobs (dedupe_hash)`,
  `CREATE INDEX IF NOT EXISTS jobs_source_idx ON jobs (source)`,
  `CREATE INDEX IF NOT EXISTS jobs_collected_at_idx ON jobs (collected_at)`,
  `CREATE TABLE IF NOT EXISTS job_analyses (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    cv_hash TEXT NOT NULL,
    job_content_hash TEXT NOT NULL,
    model_used TEXT NOT NULL,
    fit_score INTEGER NOT NULL,
    reasoning_summary TEXT NOT NULL,
    matched_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience_match TEXT NOT NULL,
    education_match TEXT NOT NULL,
    language_match TEXT NOT NULL,
    ats_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS job_analyses_job_id_idx ON job_analyses (job_id)`,
  `CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft',
    cover_letter TEXT NOT NULL,
    presentation_page TEXT NOT NULL,
    cv_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
    bullet_rewrites JSONB NOT NULL DEFAULT '[]'::jsonb,
    ats_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    recipient_email TEXT,
    gmail_draft_id TEXT,
    gmail_message_id TEXT,
    model_used TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS applications_job_id_idx ON applications (job_id)`,
  `CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
    job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    action TEXT NOT NULL,
    gmail_message_id TEXT,
    gmail_draft_id TEXT,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    human_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS automation_runs (
    id TEXT PRIMARY KEY,
    trigger_type TEXT NOT NULL,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'running',
    jobs_fetched INTEGER NOT NULL DEFAULT 0,
    jobs_new INTEGER NOT NULL DEFAULT 0,
    jobs_duplicates INTEGER NOT NULL DEFAULT 0,
    jobs_scored INTEGER NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS extension_heartbeats (
    id TEXT PRIMARY KEY,
    extension_version TEXT,
    last_seen_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    last_platform TEXT,
    total_imported INTEGER NOT NULL DEFAULT 0,
    platform_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_error TEXT,
    browser_status TEXT NOT NULL DEFAULT 'offline'
  )`,
  `CREATE TABLE IF NOT EXISTS oauth_tokens (
    provider TEXT PRIMARY KEY,
    account_email TEXT,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    scope TEXT,
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

export function detectDbMode(): DbMode {
  const url = process.env.DATABASE_URL?.trim();
  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    return 'postgres';
  }
  if (process.env.VERCEL === '1') {
    // Never treat ephemeral Vercel filesystem as persistent storage
    return 'unconfigured_vercel';
  }
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return 'pglite_memory';
  }
  return 'pglite_local';
}

export async function getDb(): Promise<AppDatabase> {
  const state = getState();
  const desiredMode = detectDbMode();

  if (desiredMode === 'unconfigured_vercel') {
    state.mode = 'unconfigured_vercel';
    state.lastError =
      'DATABASE_URL non configurée sur Vercel. Connectez une base PostgreSQL persistante (Neon ou Supabase).';
    throw new Error(state.lastError);
  }

  if (state.db && state.initialized && state.mode === desiredMode) {
    return state.db;
  }

  if (!state.initPromise || state.mode !== desiredMode) {
    state.mode = desiredMode;
    state.initPromise = (async () => {
      try {
        if (desiredMode === 'postgres') {
          const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 10,
            idleTimeoutMillis: 20_000,
            connectionTimeoutMillis: 10_000,
          });
          state.pool = pool;
          const connection = await pool.connect();
          try {
            await connection.query('BEGIN');
            await connection.query("SELECT pg_advisory_xact_lock(hashtext('job-hunter-schema'))");
            for (const stmt of BOOTSTRAP_STATEMENTS) {
              await connection.query(stmt);
            }
            await connection.query('COMMIT');
          } catch (error) {
            await connection.query('ROLLBACK').catch(() => {});
            throw error;
          } finally {
            connection.release();
          }
          state.db = drizzlePg(pool, { schema });
        } else if (desiredMode === 'pglite_memory') {
          const client = new PGlite('memory://');
          await client.waitReady;
          state.pglite = client;
          state.db = drizzlePglite(client, { schema });
          for (const stmt of BOOTSTRAP_STATEMENTS) {
            await client.exec(stmt);
          }
        } else {
          const dataDir = path.join(process.cwd(), '.data', 'pglite');
          fs.mkdirSync(dataDir, { recursive: true });
          const client = new PGlite(dataDir);
          await client.waitReady;
          state.pglite = client;
          state.db = drizzlePglite(client, { schema });
          for (const stmt of BOOTSTRAP_STATEMENTS) {
            await client.exec(stmt);
          }
        }
        state.initialized = true;
        state.lastError = null;
      } catch (err) {
        await state.pool?.end().catch(() => {});
        state.pool = null;
        state.db = null;
        state.initialized = false;
        state.initPromise = null;
        state.lastError = err instanceof Error ? err.message : 'Database connection failed';
        throw err;
      }
    })();
  }

  await state.initPromise;
  if (!state.db) {
    throw new Error(state.lastError || 'Database unavailable');
  }
  return state.db;
}

export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  mode: DbMode;
  persistent: boolean;
  detail: string;
}> {
  const mode = detectDbMode();
  if (mode === 'unconfigured_vercel') {
    return {
      connected: false,
      mode,
      persistent: false,
      detail:
        'DATABASE_URL manquante sur Vercel — stockage éphémère refusé. Configurez Neon ou Supabase PostgreSQL.',
    };
  }
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1 as ok`);
    return {
      connected: true,
      mode,
      persistent: mode === 'postgres' || mode === 'pglite_local',
      detail:
        mode === 'postgres'
          ? 'PostgreSQL distant (Neon / Supabase) vérifié'
          : mode === 'pglite_local'
            ? 'PostgreSQL local embarqué (PGlite dans .data/pglite)'
            : 'PostgreSQL en mémoire (mode test)',
    };
  } catch (err) {
    return {
      connected: false,
      mode,
      persistent: false,
      detail: err instanceof Error ? err.message : 'Erreur de connexion PostgreSQL',
    };
  }
}

export async function resetTestDatabase(): Promise<void> {
  const state = getState();
  if (state.pglite) {
    await state.pglite.close();
  }
  if (state.pool) {
    await state.pool.end();
  }
  state.db = null;
  state.pglite = null;
  state.pool = null;
  state.initialized = false;
  state.initPromise = null;
  state.lastError = null;
}

export { schema };
export * from './schema';
