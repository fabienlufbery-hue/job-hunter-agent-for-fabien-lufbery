import {
  pgTable,
  text,
  integer,
  boolean,
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

export const JOB_SOURCES = [
  'welcome_to_the_jungle',
  'indeed',
  'hellowork',
  'meteojob',
  'france_travail',
] as const;

export type JobSource = (typeof JOB_SOURCES)[number];

export const APPLICATION_STATUSES = [
  'new',
  'saved',
  'reviewing',
  'tailored',
  'draft_ready',
  'applied',
  'interview',
  'rejected',
  'archived',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// ---- Tables ----

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
    gmailDraftId: text('gmail_draft_id'),
    gmailMessageId: text('gmail_message_id'),
    modelUsed: text('model_used'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('applications_job_id_idx').on(table.jobId)]
);

export const emailLogs = pgTable('email_logs', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').references(() => applications.id, { onDelete: 'set null' }),
  jobId: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  recipientEmail: text('recipient_email').notNull(),
  subject: text('subject').notNull(),
  action: text('action').notNull(), // 'draft_created' | 'sent' | 'failed'
  gmailMessageId: text('gmail_message_id'),
  gmailDraftId: text('gmail_draft_id'),
  attachments: jsonb('attachments').$type<string[]>().notNull().default([]),
  humanConfirmed: boolean('human_confirmed').notNull().default(false),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const automationRuns = pgTable('automation_runs', {
  id: text('id').primaryKey(),
  triggerType: text('trigger_type').notNull(),
  sources: jsonb('sources').$type<string[]>().notNull().default([]),
  status: text('status').notNull().default('running'),
  jobsFetched: integer('jobs_fetched').notNull().default(0),
  jobsNew: integer('jobs_new').notNull().default(0),
  jobsDuplicates: integer('jobs_duplicates').notNull().default(0),
  jobsScored: integer('jobs_scored').notNull().default(0),
  errors: jsonb('errors').$type<AutomationErrorEntry[]>().notNull().default([]),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export const extensionHeartbeats = pgTable('extension_heartbeats', {
  id: text('id').primaryKey(),
  extensionVersion: text('extension_version'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastPlatform: text('last_platform'),
  totalImported: integer('total_imported').notNull().default(0),
  platformCounts: jsonb('platform_counts').$type<Record<string, number>>().notNull().default({}),
  lastError: text('last_error'),
  browserStatus: text('browser_status').notNull().default('offline'),
});

export const oauthTokens = pgTable('oauth_tokens', {
  provider: text('provider').primaryKey(),
  accountEmail: text('account_email'),
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  encryptedRefreshToken: text('encrypted_refresh_token'),
  scope: text('scope'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
