import {
  pgTable,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ---- Structured Types stored in JSONB columns ----

export interface CvEducation {
  degree: string;
  institution: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  details?: string;
}

export interface CvExperience {
  role: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  sector?: string;
  bullets: string[];
}

export interface CvLanguage {
  name: string;
  level: string;
}

export interface CvCertification {
  name: string;
  issuer?: string;
  date?: string;
}

export interface CvLink {
  label: string;
  url: string;
}

export interface JobProvenance {
  source: JobSource;
  url: string;
  externalId?: string | null;
  seenAt: string;
  apifyRunId?: string | null;
}

export interface CvSuggestion {
  section: string;
  currentText: string;
  suggestedImprovement: string;
  reason: string;
}

export interface BulletRewrite {
  original: string;
  rewritten: string;
  impactNote: string;
}

export interface AutomationErrorEntry {
  source: string;
  message: string;
  code?: string;
}

export const ACTIVE_JOB_SOURCES = [
  'welcome_to_the_jungle',
  'indeed',
  'hellowork',
  'meteojob',
  'linkedin',
  'other',
] as const;

export const JOB_SOURCES = [
  ...ACTIVE_JOB_SOURCES,
  'france_travail', // Kept strictly for backward compatibility with historical rows
] as const;

export type ActiveJobSource = (typeof ACTIVE_JOB_SOURCES)[number];
export type JobSource = (typeof JOB_SOURCES)[number];

export const APPLICATION_STATUSES = [
  'new',
  'saved',
  'reviewing',
  'tailored',
  'applied',
  'interview',
  'offer',
  'rejected',
  'archived',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APIFY_SOURCE_KINDS = ['task', 'actor'] as const;
export type ApifySourceKind = (typeof APIFY_SOURCE_KINDS)[number];

export const APIFY_EXECUTION_MODES = ['run_and_fetch', 'fetch_last_dataset'] as const;
export type ApifyExecutionMode = (typeof APIFY_EXECUTION_MODES)[number];

// ---- Existing Core Tables (Preserved non-destructively) ----

export const masterCv = pgTable('master_cv', {
  id: text('id').primaryKey(),
  fileName: text('file_name'),
  fileType: text('file_type'), // 'pdf' | 'docx' | 'manual'
  rawText: text('raw_text').notNull().default(''),
  fullName: text('full_name').notNull().default(''),
  headline: text('headline').notNull().default(''),
  summary: text('summary').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  location: text('location').notNull().default(''),
  experienceLevel: text('experience_level').notNull().default(''),
  education: jsonb('education').$type<CvEducation[]>().notNull().default([]),
  experiences: jsonb('experiences').$type<CvExperience[]>().notNull().default([]),
  technicalSkills: jsonb('technical_skills').$type<string[]>().notNull().default([]),
  softSkills: jsonb('soft_skills').$type<string[]>().notNull().default([]),
  languages: jsonb('languages').$type<CvLanguage[]>().notNull().default([]),
  certifications: jsonb('certifications').$type<CvCertification[]>().notNull().default([]),
  sectors: jsonb('sectors').$type<string[]>().notNull().default([]),
  links: jsonb('links').$type<CvLink[]>().notNull().default([]),
  contentHash: text('content_hash').notNull().default(''),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const searchPreferences = pgTable('search_preferences', {
  id: text('id').primaryKey(),
  targetRoles: jsonb('target_roles').$type<string[]>().notNull().default([]),
  sectors: jsonb('sectors').$type<string[]>().notNull().default([]),
  cities: jsonb('cities').$type<string[]>().notNull().default([]),
  departmentCodes: jsonb('department_codes').$type<string[]>().notNull().default([]),
  communeCodes: jsonb('commune_codes').$type<string[]>().notNull().default([]),
  contractTypes: jsonb('contract_types').$type<string[]>().notNull().default([]),
  duration: text('duration').notNull().default(''),
  remotePolicy: text('remote_policy').notNull().default('any'), // 'any' | 'remote' | 'hybrid' | 'onsite'
  keywords: jsonb('keywords').$type<string[]>().notNull().default([]),
  minFitScore: integer('min_fit_score').notNull().default(6),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    externalId: text('external_id'),
    dedupeHash: text('dedupe_hash').notNull(),
    contentHash: text('content_hash').notNull(),
    title: text('title').notNull(),
    company: text('company'),
    location: text('location'),
    contractType: text('contract_type'),
    salary: text('salary'),
    description: text('description').notNull(),
    skills: jsonb('skills').$type<string[]>().notNull().default([]),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow().notNull(),
    originalUrl: text('original_url').notNull(),
    source: text('source').$type<JobSource>().notNull(),
    provenance: jsonb('provenance').$type<JobProvenance[]>().notNull().default([]),
    applicationStatus: text('application_status').$type<ApplicationStatus>().notNull().default('new'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    recruiterEmail: text('recruiter_email'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('jobs_dedupe_hash_idx').on(table.dedupeHash),
    index('jobs_source_idx').on(table.source),
    index('jobs_collected_at_idx').on(table.collectedAt),
  ]
);

export const jobAnalyses = pgTable(
  'job_analyses',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    cvHash: text('cv_hash').notNull(),
    jobContentHash: text('job_content_hash').notNull(),
    modelUsed: text('model_used').notNull(),
    fitScore: integer('fit_score').notNull(),
    reasoningSummary: text('reasoning_summary').notNull(),
    matchedSkills: jsonb('matched_skills').$type<string[]>().notNull().default([]),
    missingSkills: jsonb('missing_skills').$type<string[]>().notNull().default([]),
    experienceMatch: text('experience_match').notNull(),
    educationMatch: text('education_match').notNull(),
    languageMatch: text('language_match').notNull(),
    atsKeywords: jsonb('ats_keywords').$type<string[]>().notNull().default([]),
    strengths: jsonb('strengths').$type<string[]>().notNull().default([]),
    weaknesses: jsonb('weaknesses').$type<string[]>().notNull().default([]),
    recommendation: text('recommendation').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('job_analyses_job_id_idx').on(table.jobId)]
);

export const applications = pgTable(
  'applications',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('draft'),
    coverLetter: text('cover_letter').notNull(),
    presentationPage: text('presentation_page').notNull(),
    cvSuggestions: jsonb('cv_suggestions').$type<CvSuggestion[]>().notNull().default([]),
    bulletRewrites: jsonb('bullet_rewrites').$type<BulletRewrite[]>().notNull().default([]),
    atsKeywords: jsonb('ats_keywords').$type<string[]>().notNull().default([]),
    emailSubject: text('email_subject').notNull(),
    emailBody: text('email_body').notNull(),
    recipientEmail: text('recipient_email'),
    notes: text('notes'),
    modelUsed: text('model_used'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('applications_job_id_idx').on(table.jobId)]
);

export const automationRuns = pgTable('automation_runs', {
  id: text('id').primaryKey(),
  triggerType: text('trigger_type').notNull(),
  sources: jsonb('sources').$type<string[]>().notNull().default([]),
  status: text('status').notNull().default('running'),
  jobsFetched: integer('jobs_fetched').notNull().default(0),
  jobsNew: integer('jobs_new').notNull().default(0),
  jobsDuplicates: integer('jobs_duplicates').notNull().default(0),
  jobsScored: integer('jobs_scored').notNull().default(0),
  costUsd: doublePrecision('cost_usd').notNull().default(0),
  apifyRunIds: jsonb('apify_run_ids').$type<string[]>().notNull().default([]),
  summary: text('summary'),
  errors: jsonb('errors').$type<AutomationErrorEntry[]>().notNull().default([]),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

// ---- New Apify & Consumption Control Tables ----

export const apifySources = pgTable(
  'apify_sources',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind').$type<ApifySourceKind>().notNull().default('task'),
    apifyId: text('apify_id').notNull(),
    platform: text('platform').$type<ActiveJobSource>().notNull().default('other'),
    executionMode: text('execution_mode')
      .$type<ApifyExecutionMode>()
      .notNull()
      .default('run_and_fetch'),
    enabled: boolean('enabled').notNull().default(true),
    maxItems: integer('max_items').notNull().default(30),
    maxCostUsd: doublePrecision('max_cost_usd').notNull().default(0.5),
    timeoutSecs: integer('timeout_secs').notNull().default(120),
    memoryMbytes: integer('memory_mbytes').notNull().default(512),
    inputTemplate: jsonb('input_template').$type<Record<string, unknown>>().notNull().default({}),
    lastDatasetId: text('last_dataset_id'),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    lastStatus: text('last_status'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('apify_sources_enabled_idx').on(table.enabled)]
);

export const apifyRuns = pgTable(
  'apify_runs',
  {
    id: text('id').primaryKey(),
    automationRunId: text('automation_run_id').references(() => automationRuns.id, {
      onDelete: 'set null',
    }),
    sourceId: text('source_id').references(() => apifySources.id, { onDelete: 'set null' }),
    sourceName: text('source_name').notNull(),
    kind: text('kind').$type<ApifySourceKind>().notNull(),
    apifyId: text('apify_id').notNull(),
    apifyRunId: text('apify_run_id').notNull(),
    datasetId: text('dataset_id'),
    status: text('status').notNull().default('RUNNING'),
    itemsFetched: integer('items_fetched').notNull().default(0),
    itemsInserted: integer('items_inserted').notNull().default(0),
    itemsDuplicates: integer('items_duplicates').notNull().default(0),
    itemsRejected: integer('items_rejected').notNull().default(0),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    importedAt: timestamp('imported_at', { withTimezone: true }),
  },
  (table) => [
    index('apify_runs_started_at_idx').on(table.startedAt),
    index('apify_runs_status_idx').on(table.status),
  ]
);

export const appSettings = pgTable('app_settings', {
  id: text('id').primaryKey(),
  monthlyApifyBudgetUsd: doublePrecision('monthly_apify_budget_usd').notNull().default(5.0),
  maxCostPerRunUsd: doublePrecision('max_cost_per_run_usd').notNull().default(0.75),
  maxItemsPerSource: integer('max_items_per_source').notNull().default(30),
  runTimeoutSecs: integer('run_timeout_secs').notNull().default(120),
  maxGeminiScoresPerRun: integer('max_gemini_scores_per_run').notNull().default(15),
  autoScoreOnSync: boolean('auto_score_on_sync').notNull().default(true),
  minCooldownMinutes: integer('min_cooldown_minutes').notNull().default(5),
  lastApifyVerifiedAt: timestamp('last_apify_verified_at', { withTimezone: true }),
  lastApifyVerifiedOk: boolean('last_apify_verified_ok'),
  lastApifyAccount: text('last_apify_account'),
  lastGeminiVerifiedAt: timestamp('last_gemini_verified_at', { withTimezone: true }),
  lastGeminiVerifiedOk: boolean('last_gemini_verified_ok'),
  lastGeminiModel: text('last_gemini_model'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
