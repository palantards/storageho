import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin as db, schema } from "@/server/db";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";
import { analyzePhotoWithAi, embedTextForSearch } from "@/lib/inventory/ai";
import { STORAGE_BUCKET } from "@/lib/inventory/constants";

const photoAnalyzePayloadSchema = z.object({
  photoId: z.string().uuid(),
  householdId: z.string().uuid(),
  entityType: z.enum(["container", "item", "room_layout"]),
  entityId: z.string().uuid(),
  originalPath: z.string().min(1),
  thumbPath: z.string().min(1).optional(),
});

const embeddingPayloadSchema = z.object({
  householdId: z.string().uuid(),
  entityType: z.enum(["item", "container", "room", "location", "tag"]),
  entityId: z.string().uuid(),
});

const MAX_ATTEMPTS = 6;

type AiJobRecord = typeof schema.aiJobs.$inferSelect;
type SearchEntityType = typeof schema.searchDocuments.$inferSelect.entityType;

function getJobRunnerDispatchConfig() {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  if (process.env.AI_DISPATCH_ON_ENQUEUE === "0") {
    return null;
  }

  const token = process.env.AI_JOB_RUNNER_TOKEN;
  const appUrl =
    process.env.INTERNAL_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (!token || !appUrl) {
    return null;
  }

  const base = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  return { token, base };
}

export function dispatchAiRunner(input?: { reason?: string; limit?: number }) {
  const config = getJobRunnerDispatchConfig();
  if (!config) return;

  const limit = Math.min(30, Math.max(1, input?.limit ?? 6));
  const url = `${config.base}/api/jobs/run?limit=${limit}`;

  void fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      "x-storageho-dispatch-reason": input?.reason || "enqueue",
    },
    cache: "no-store",
  }).catch((error) => {
    console.error("AI runner dispatch failed", error);
  });
}

export async function enqueueEmbeddingJob(input: {
  householdId: string;
  entityType: SearchEntityType;
  entityId: string;
}) {
  const existing = await db.query.aiJobs.findFirst({
    where: and(
      eq(schema.aiJobs.householdId, input.householdId),
      eq(schema.aiJobs.jobType, "embedding_upsert"),
      sql`${schema.aiJobs.status} in ('queued', 'running')`,
      sql`${schema.aiJobs.payload}->>'entityType' = ${input.entityType}`,
      sql`${schema.aiJobs.payload}->>'entityId' = ${input.entityId}`,
    ),
    columns: { id: true },
  });

  if (existing) {
    return existing;
  }

  const [job] = await db
    .insert(schema.aiJobs)
    .values({
      householdId: input.householdId,
      jobType: "embedding_upsert",
      status: "queued",
      payload: {
        householdId: input.householdId,
        entityType: input.entityType,
        entityId: input.entityId,
      },
      runAfter: new Date(),
    })
    .returning({ id: schema.aiJobs.id });

  dispatchAiRunner({ reason: "embedding_upsert_enqueue", limit: 4 });

  return job;
}

export async function claimAiJobs(input: {
  limit?: number;
  workerId: string;
}) {
  const limit = Math.min(30, Math.max(1, input.limit ?? 8));

  const rows = await db.execute<AiJobRecord>(sql`
    with next_jobs as (
      select j.id
      from ${schema.aiJobs} j
      where j.status in ('queued', 'failed')
        and j.run_after <= now()
        and j.attempt_count < ${MAX_ATTEMPTS}
      order by j.created_at asc
      limit ${limit}
      for update skip locked
    )
    update ${schema.aiJobs} j
    set
      status = 'running',
      locked_at = now(),
      locked_by = ${input.workerId},
      attempt_count = j.attempt_count + 1,
      updated_at = now()
    from next_jobs nj
    where j.id = nj.id
    returning j.*;
  `);

  return rows.rows;
}

export async function claimAiJobById(input: {
  jobId: string;
  workerId: string;
}) {
  const rows = await db
    .update(schema.aiJobs)
    .set({
      status: "running",
      lockedAt: new Date(),
      lockedBy: input.workerId,
      attemptCount: sql`${schema.aiJobs.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.aiJobs.id, input.jobId),
        sql`${schema.aiJobs.status} in ('queued', 'failed')`,
        sql`${schema.aiJobs.runAfter} <= now()`,
        sql`${schema.aiJobs.attemptCount} < ${MAX_ATTEMPTS}`,
      ),
    )
    .returning();

  return rows[0] ?? null;
}

async function markJobSucceeded(jobId: string) {
  await db
    .update(schema.aiJobs)
    .set({
      status: "succeeded",
      error: null,
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.aiJobs.id, jobId));
}

async function markJobFailed(job: AiJobRecord, error: unknown) {
  const attempts = (job.attemptCount ?? 1) + 1;
  const backoffSeconds = Math.min(3600, Math.pow(2, Math.max(1, attempts)) * 10);
  await db
    .update(schema.aiJobs)
    .set({
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 3000) : String(error),
      runAfter: new Date(Date.now() + backoffSeconds * 1000),
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.aiJobs.id, job.id));
}

async function upsertSearchDocument(input: {
  householdId: string;
  entityType: SearchEntityType;
  entityId: string;
  content: string;
}) {
  const vector = await embedTextForSearch(input.content);

  await db
    .insert(schema.searchDocuments)
    .values({
      householdId: input.householdId,
      entityType: input.entityType,
      entityId: input.entityId,
      content: input.content,
      embedding: vector,
    })
    .onConflictDoUpdate({
      target: [schema.searchDocuments.entityType, schema.searchDocuments.entityId],
      set: {
        householdId: input.householdId,
        content: input.content,
        embedding: vector,
        updatedAt: new Date(),
      },
    });
}

async function buildSearchDocumentContent(input: {
  householdId: string;
  entityType: SearchEntityType;
  entityId: string;
}) {
  if (input.entityType === "item") {
    const rows = await db.execute<{
      name: string;
      description: string | null;
      barcode: string | null;
      serial_number: string | null;
      aliases: string | null;
      tags: string | null;
      paths: string | null;
    }>(sql`
      select
        i.name,
        i.description,
        i.barcode,
        i.serial_number,
        (
          select string_agg(distinct a.alias_text, ', ')
          from ${schema.itemAliases} a
          where a.item_id = i.id
        ) as aliases,
        (
          select string_agg(distinct t.name, ', ')
          from ${schema.itemTags} it
          inner join ${schema.tags} t on t.id = it.tag_id
          where it.item_id = i.id
        ) as tags,
        (
          select string_agg(distinct concat_ws(' / ', l.name, r.name, c.name), ' | ')
          from ${schema.containerItems} ci
          inner join ${schema.containers} c on c.id = ci.container_id
          inner join ${schema.rooms} r on r.id = c.room_id
          inner join ${schema.householdFloors} l on l.id = r.location_id
          where ci.item_id = i.id
        ) as paths
      from ${schema.items} i
      where i.household_id = ${input.householdId}
        and i.id = ${input.entityId}
      limit 1
    `);
    const row = rows.rows[0];
    if (!row) return null;
    return [
      row.name,
      row.description,
      row.barcode,
      row.serial_number,
      row.aliases,
      row.tags,
      row.paths,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (input.entityType === "container") {
    const rows = await db.execute<{
      name: string;
      code: string | null;
      description: string | null;
      room_name: string | null;
      location_name: string | null;
      parent_name: string | null;
      tags: string | null;
    }>(sql`
      select
        c.name,
        c.code,
        c.description,
        r.name as room_name,
        l.name as location_name,
        pc.name as parent_name,
        (
          select string_agg(distinct t.name, ', ')
          from ${schema.containerTags} ct
          inner join ${schema.tags} t on t.id = ct.tag_id
          where ct.container_id = c.id
        ) as tags
      from ${schema.containers} c
      inner join ${schema.rooms} r on r.id = c.room_id
      inner join ${schema.householdFloors} l on l.id = r.location_id
      left join ${schema.containers} pc on pc.id = c.parent_container_id
      where c.household_id = ${input.householdId}
        and c.id = ${input.entityId}
      limit 1
    `);
    const row = rows.rows[0];
    if (!row) return null;
    return [
      row.name,
      row.code,
      row.description,
      row.location_name,
      row.room_name,
      row.parent_name,
      row.tags,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (input.entityType === "room") {
    const room = await db
      .select({
        room: schema.rooms,
        location: schema.householdFloors,
      })
      .from(schema.rooms)
      .innerJoin(
        schema.householdFloors,
        eq(schema.householdFloors.id, schema.rooms.locationId),
      )
      .where(
        and(
          eq(schema.rooms.householdId, input.householdId),
          eq(schema.rooms.id, input.entityId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!room) return null;
    return [room.room.name, room.room.description, room.location.name]
      .filter(Boolean)
      .join(" | ");
  }

  if (input.entityType === "location") {
    const location = await db.query.householdFloors.findFirst({
      where: and(
        eq(schema.householdFloors.householdId, input.householdId),
        eq(schema.householdFloors.id, input.entityId),
      ),
    });
    if (!location) return null;
    return [location.name].filter(Boolean).join(" | ");
  }

  const tag = await db.query.tags.findFirst({
    where: and(
      eq(schema.tags.householdId, input.householdId),
      eq(schema.tags.id, input.entityId),
    ),
  });
  if (!tag) return null;
  return [tag.name].join(" | ");
}

async function processEmbeddingJob(job: AiJobRecord) {
  const parsed = embeddingPayloadSchema.parse(job.payload);
  await runEmbeddingUpsertNow({
    householdId: parsed.householdId,
    entityType: parsed.entityType,
    entityId: parsed.entityId,
  });
}

async function processPhotoAnalyzeJob(job: AiJobRecord) {
  const parsed = photoAnalyzePayloadSchema.parse(job.payload);
  if (parsed.entityType !== "container") {
    return;
  }

  const householdRow = await db.query.households.findFirst({
    where: eq(schema.households.id, parsed.householdId),
    columns: { language: true },
  });
  const language = householdRow?.language || "en";

  const supabase = createSupabaseAdminClient();
  const signed = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(parsed.originalPath, 60 * 10);

  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message || "Unable to create signed photo URL");
  }

  const analysis = await analyzePhotoWithAi({
    signedUrl: signed.data.signedUrl,
    language,
  });

  await db
    .delete(schema.photoSuggestions)
    .where(
      and(
        eq(schema.photoSuggestions.householdId, parsed.householdId),
        eq(schema.photoSuggestions.photoId, parsed.photoId),
        eq(schema.photoSuggestions.status, "pending"),
      ),
    );

  if (analysis.suggestions.length) {
    await db.insert(schema.photoSuggestions).values(
      analysis.suggestions.map((suggestion) => ({
        householdId: parsed.householdId,
        photoId: parsed.photoId,
        containerId: parsed.entityId,
        suggestedName: suggestion.name,
        suggestedQty: suggestion.qty ?? null,
        suggestedTags: suggestion.tags ?? [],
        confidence: suggestion.confidence,
        status: "pending" as const,
      })),
    );
  }
}

export async function processAiJob(job: AiJobRecord) {
  if (job.jobType === "photo_analyze") {
    await processPhotoAnalyzeJob(job);
    return;
  }

  if (job.jobType === "embedding_upsert") {
    await processEmbeddingJob(job);
    return;
  }
}

export async function runAiJobBatch(input: { workerId: string; limit?: number }) {
  const jobs = await claimAiJobs({
    workerId: input.workerId,
    limit: input.limit ?? 8,
  });

  const results: Array<{ id: string; status: "succeeded" | "failed"; error?: string }> = [];

  for (const job of jobs) {
    try {
      await processAiJob(job);
      await markJobSucceeded(job.id);
      results.push({ id: job.id, status: "succeeded" });
    } catch (error) {
      await markJobFailed(job, error);
      results.push({
        id: job.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    claimed: jobs.length,
    results,
  };
}

export async function runAiJobNow(input: { jobId: string; workerId: string }) {
  const job = await claimAiJobById({
    jobId: input.jobId,
    workerId: input.workerId,
  });

  if (!job) {
    return {
      ran: false as const,
      status: "skipped" as const,
      reason: "Job not claimable (already running/succeeded or delayed).",
    };
  }

  try {
    await processAiJob(job);
    await markJobSucceeded(job.id);
    return {
      ran: true as const,
      status: "succeeded" as const,
      jobId: job.id,
    };
  } catch (error) {
    await markJobFailed(job, error);
    return {
      ran: true as const,
      status: "failed" as const,
      jobId: job.id,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runEmbeddingUpsertNow(input: {
  householdId: string;
  entityType: SearchEntityType;
  entityId: string;
}) {
  const content = await buildSearchDocumentContent({
    householdId: input.householdId,
    entityType: input.entityType,
    entityId: input.entityId,
  });

  if (!content) {
    await db
      .delete(schema.searchDocuments)
      .where(
        and(
          eq(schema.searchDocuments.entityType, input.entityType),
          eq(schema.searchDocuments.entityId, input.entityId),
        ),
      );
    return { deleted: true };
  }

  await upsertSearchDocument({
    householdId: input.householdId,
    entityType: input.entityType,
    entityId: input.entityId,
    content,
  });
  return { deleted: false };
}



