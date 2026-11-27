-- Job Hunter Agent for Fabien Lufbery — PostgreSQL / Neon Schema (Apify + Gemini)
-- Non-destructive idempotent schema preserving existing personal tables.

CREATE TABLE IF NOT EXISTS master_cv (
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
);

CREATE TABLE IF NOT EXISTS search_preferences (
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
);

CREATE TABLE IF NOT EXISTS jobs (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_dedupe_hash_idx ON jobs (dedupe_hash);
CREATE INDEX IF NOT EXISTS jobs_source_idx ON jobs (source);
CREATE INDEX IF NOT EXISTS jobs_collected_at_idx ON jobs (collected_at);

CREATE TABLE IF NOT EXISTS job_analyses (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS job_analyses_job_id_idx ON job_analyses (job_id);

CREATE TABLE IF NOT EXISTS applications (
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
  notes TEXT,
  model_used TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS applications_job_id_idx ON applications (job_id);

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'running',
  jobs_fetched INTEGER NOT NULL DEFAULT 0,
  jobs_new INTEGER NOT NULL DEFAULT 0,
  jobs_duplicates INTEGER NOT NULL DEFAULT 0,
  jobs_scored INTEGER NOT NULL DEFAULT 0,
  cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  apify_run_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS apify_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'task',
  apify_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'other',
  execution_mode TEXT NOT NULL DEFAULT 'run_and_fetch',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  max_items INTEGER NOT NULL DEFAULT 30,
  max_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  timeout_secs INTEGER NOT NULL DEFAULT 120,
  memory_mbytes INTEGER NOT NULL DEFAULT 512,
  input_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_dataset_id TEXT,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS apify_sources_enabled_idx ON apify_sources (enabled);

CREATE TABLE IF NOT EXISTS apify_runs (
  id TEXT PRIMARY KEY,
  automation_run_id TEXT REFERENCES automation_runs(id) ON DELETE SET NULL,
  source_id TEXT REFERENCES apify_sources(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  apify_id TEXT NOT NULL,
  apify_run_id TEXT NOT NULL,
  dataset_id TEXT,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  items_fetched INTEGER NOT NULL DEFAULT 0,
  items_inserted INTEGER NOT NULL DEFAULT 0,
  items_duplicates INTEGER NOT NULL DEFAULT 0,
  items_rejected INTEGER NOT NULL DEFAULT 0,
  cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS apify_runs_started_at_idx ON apify_runs (started_at);
CREATE INDEX IF NOT EXISTS apify_runs_status_idx ON apify_runs (status);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  monthly_apify_budget_usd DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  max_cost_per_run_usd DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  max_items_per_source INTEGER NOT NULL DEFAULT 30,
  run_timeout_secs INTEGER NOT NULL DEFAULT 120,
  max_gemini_scores_per_run INTEGER NOT NULL DEFAULT 15,
  auto_score_on_sync BOOLEAN NOT NULL DEFAULT TRUE,
  min_cooldown_minutes INTEGER NOT NULL DEFAULT 5,
  last_apify_verified_at TIMESTAMPTZ,
  last_apify_verified_ok BOOLEAN,
  last_apify_account TEXT,
  last_gemini_verified_at TIMESTAMPTZ,
  last_gemini_verified_ok BOOLEAN,
  last_gemini_model TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
