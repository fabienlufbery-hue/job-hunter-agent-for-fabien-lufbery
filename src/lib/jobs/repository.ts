import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { computeJobContentHash, mergeProvenance, normalizeJobInput, type RawJobInput } from './normalize';

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

    const result = await db.transaction(async (tx) => {
      const id = crypto.randomUUID();
      const [created] = await tx.insert(schema.jobs).values({
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
      }).onConflictDoNothing({ target: schema.jobs.dedupeHash }).returning();

      if (created) return { id: created.id, created: true, updated: false };

      const [existing] = await tx.select()
        .from(schema.jobs)
        .where(eq(schema.jobs.dedupeHash, normalized.dedupeHash))
        .for('update');
      if (!existing) throw new Error('Offre concurrente introuvable après déduplication.');

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
        (!existing.location && Boolean(normalized.location)) ||
        (!existing.contractType && Boolean(normalized.contractType)) ||
        (!existing.salary && Boolean(normalized.salary)) ||
        (!existing.recruiterEmail && Boolean(normalized.recruiterEmail)) ||
        mergedSkills.length !== (existing.skills?.length || 0);

      if (shouldUpdate) {
        const content = {
          title: existing.title,
          company: existing.company,
          description: bestDescription,
          contractType: existing.contractType || normalized.contractType,
          location: existing.location || normalized.location,
          skills: mergedSkills,
        };
        await tx
          .update(schema.jobs)
          .set({
            ...content,
            salary: existing.salary || normalized.salary,
            recruiterEmail: existing.recruiterEmail || normalized.recruiterEmail,
            provenance: mergedProvenance,
            contentHash: computeJobContentHash(content),
            updatedAt: new Date(),
          })
          .where(eq(schema.jobs.id, existing.id));
      }
      return { id: existing.id, created: false, updated: shouldUpdate };
    });

    jobIds.push(result.id);
    if (result.created) {
      inserted += 1;
      newJobIds.push(result.id);
    } else {
      duplicates += 1;
      if (result.updated) updated += 1;
    }
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
