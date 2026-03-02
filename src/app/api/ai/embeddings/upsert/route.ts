import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  enqueueEmbeddingJob,
  runEmbeddingUpsertNow,
} from "@/lib/inventory/ai-jobs";

const bodySchema = z.object({
  householdId: z.string().uuid(),
  entityType: z.enum(["item", "container", "room", "location", "tag"]),
  entityId: z.string().uuid(),
  mode: z.enum(["queue", "now"]).optional().default("now"),
});

function isAuthorized(request: NextRequest) {
  const token = process.env.AI_INTERNAL_TOKEN || process.env.AI_JOB_RUNNER_TOKEN;
  if (!token) {
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const queryToken = request.nextUrl.searchParams.get("token");
  return bearer === token || queryToken === token;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    if (body.mode === "queue") {
      const job = await enqueueEmbeddingJob({
        householdId: body.householdId,
        entityType: body.entityType,
        entityId: body.entityId,
      });
      return NextResponse.json({ ok: true, queued: true, job });
    }

    const result = await runEmbeddingUpsertNow({
      householdId: body.householdId,
      entityType: body.entityType,
      entityId: body.entityId,
    });
    return NextResponse.json({ ok: true, queued: false, result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Embedding upsert failed" },
      { status: 400 },
    );
  }
}

