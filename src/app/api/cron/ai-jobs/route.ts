import { NextRequest, NextResponse } from "next/server";

import { runAiJobBatch } from "@/lib/inventory/ai-jobs";

function verifyCronRequest(request: NextRequest) {
  const token = process.env.AI_CRON_TOKEN || process.env.AI_JOB_RUNNER_TOKEN;
  if (!token) return false;

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const queryToken = request.nextUrl.searchParams.get("token");

  return bearerToken === token || queryToken === token;
}

async function run(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAiJobBatch({
    workerId: `cron-${crypto.randomUUID()}`,
    limit: 12,
  });

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  try {
    return await run(request);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

