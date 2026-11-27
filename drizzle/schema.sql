-- Job Hunter Agent for Fabien Lufbery — PostgreSQL Schema
-- Compatible with Neon, Supabase, PostgreSQL 15+, and local PGlite

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
  gmail_draft_id TEXT,
  gmail_message_id TEXT,
  model_used TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS applications_job_id_idx ON applications (job_id);

CREATE TABLE IF NOT EXISTS email_logs (
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
);

CREATE TABLE IF NOT EXISTS automation_runs (
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
);

CREATE TABLE IF NOT EXISTS extension_heartbeats (
  id TEXT PRIMARY KEY,
  extension_version TEXT,
  last_seen_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_platform TEXT,
  total_imported INTEGER NOT NULL DEFAULT 0,
  platform_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  browser_status TEXT NOT NULL DEFAULT 'offline'
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider TEXT PRIMARY KEY,
  account_email TEXT,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
