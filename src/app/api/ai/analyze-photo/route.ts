import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { analyzePhotoWithAi } from "@/lib/inventory/ai";

const bodySchema = z.object({
  signedUrl: z.string().url(),
  maxSuggestions: z.number().int().min(1).max(20).optional(),
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
    const result = await analyzePhotoWithAi({
      signedUrl: body.signedUrl,
      maxSuggestions: body.maxSuggestions,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analyze failed" },
      { status: 400 },
    );
  }
}
