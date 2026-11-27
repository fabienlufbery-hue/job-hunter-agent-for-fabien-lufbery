import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { mergeProvenance, normalizeJobInput, type RawJobInput } from './normalize';

export interface UpsertJobsResult {
  fetched: number;
  inserted: number;
  duplicates: number;
  updated: number;
  jobIds: string[];
  newJobIds: string[];
}

export async function upsertNormalizedJobs(rawInputs: RawJobInput[]): Promise<UpsertJobsResult> {
  const db = await getDb();
  let inserted = 0;
  let duplicates = 0;
  let updated = 0;
  const jobIds: string[] = [];
  const newJobIds: string[] = [];

  for (const raw of rawInputs) {
    const normalized = normalizeJobInput(raw);

    const existingRows = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.dedupeHash, normalized.dedupeHash))
      .limit(1);

    const existing = existingRows[0];

    if (existing) {
      duplicates += 1;
      jobIds.push(existing.id);

      const mergedProvenance = mergeProvenance(existing.provenance || [], normalized.provenance);
      const mergedSkills = Array.from(
        new Map(
          [...(existing.skills || []), ...normalized.skills].map((s) => [s.toLowerCase(), s])
        ).values()
      );

      // Enrich missing nullable fields without overwriting existing verified fields
      const bestDescription =
        normalized.description.length > (existing.description?.length || 0)
          ? normalized.description
          : existing.description;

      const shouldUpdate =
        mergedProvenance.length !== (existing.provenance?.length || 0) ||
        bestDescription !== existing.description ||
        (!existing.salary && Boolean(normalized.salary)) ||
        (!existing.recruiterEmail && Boolean(normalized.recruiterEmail)) ||
        mergedSkills.length !== (existing.skills?.length || 0);

      if (shouldUpdate) {
        updated += 1;
        await db
          .update(schema.jobs)
          .set({
            description: bestDescription,
            salary: existing.salary || normalized.salary,
            contractType: existing.contractType || normalized.contractType,
            location: existing.location || normalized.location,
            recruiterEmail: existing.recruiterEmail || normalized.recruiterEmail,
            skills: mergedSkills,
            provenance: mergedProvenance,
            contentHash:
              bestDescription !== existing.description ? normalized.contentHash : existing.contentHash,
            updatedAt: new Date(),
          })
          .where(eq(schema.jobs.id, existing.id));
      }
      continue;
    }

    const id = crypto.randomUUID();
    await db.insert(schema.jobs).values({
      id,
      externalId: normalized.externalId,
      dedupeHash: normalized.dedupeHash,
      contentHash: normalized.contentHash,
      title: normalized.title,
      company: normalized.company,
      location: normalized.location,
      contractType: normalized.contractType,
      salary: normalized.salary,
      description: normalized.description,
      skills: normalized.skills,
      publishedAt: normalized.publishedAt,
      collectedAt: normalized.collectedAt,
      originalUrl: normalized.originalUrl,
      source: normalized.source,
      provenance: normalized.provenance,
      applicationStatus: 'new',
      isFavorite: false,
      recruiterEmail: normalized.recruiterEmail,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    inserted += 1;
    jobIds.push(id);
    newJobIds.push(id);
  }

  return {
    fetched: rawInputs.length,
    inserted,
    duplicates,
    updated,
    jobIds,
    newJobIds,
  };
}

export async function listJobsWithAnalyses() {
  const db = await getDb();
  const [allJobs, allAnalyses] = await Promise.all([
    db.select().from(schema.jobs).orderBy(desc(schema.jobs.collectedAt)),
    db.select().from(schema.jobAnalyses),
  ]);

  const analysisByJobId = new Map(allAnalyses.map((a) => [a.jobId, a]));

  return allJobs.map((job) => {
    const a = analysisByJobId.get(job.id) || null;
    return {
      ...job,
      publishedAt: job.publishedAt ? job.publishedAt.toISOString() : null,
      collectedAt: job.collectedAt.toISOString(),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      analysis: a
        ? {
            fitScore: a.fitScore,
            reasoningSummary: a.reasoningSummary,
            matchedSkills: a.matchedSkills,
            missingSkills: a.missingSkills,
            experienceMatch: a.experienceMatch,
            educationMatch: a.educationMatch,
            languageMatch: a.languageMatch,
            atsKeywords: a.atsKeywords,
            strengths: a.strengths,
            weaknesses: a.weaknesses,
            recommendation: a.recommendation,
            modelUsed: a.modelUsed,
            updatedAt: a.updatedAt.toISOString(),
          }
        : null,
    };
  });
}
