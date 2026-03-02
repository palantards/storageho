import { NextRequest, NextResponse } from "next/server";

import { runAiJobBatch } from "@/lib/inventory/ai-jobs";

function isAllowed(request: NextRequest) {
  const token = process.env.AI_JOB_RUNNER_TOKEN;
  if (!token) {
    return process.env.NODE_ENV !== "production";
  }

  const queryToken = request.nextUrl.searchParams.get("token");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  return queryToken === token || bearerToken === token;
}

async function runJobs(request: NextRequest) {
  if (!isAllowed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const result = await runAiJobBatch({
    workerId: `manual-${crypto.randomUUID()}`,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  try {
    return await runJobs(request);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Job runner failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

