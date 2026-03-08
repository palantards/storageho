import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbAdmin as db, schema } from "@/server/db";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
} from "@/lib/security/rate-limit";

const supportPayloadSchema = z.object({
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(4000),
});

const SUPPORT_WINDOW_MS = 10 * 60 * 1000;
const SUPPORT_MAX_PER_WINDOW = 5;

function getRequesterKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  const connectingIp = request.headers.get("cf-connecting-ip");
  if (connectingIp) return connectingIp;
  return "unknown";
}

export async function POST(request: NextRequest) {
  const requesterKey = getRequesterKey(request);
  const rateLimit = await consumeRateLimit({
    scope: "support_request_ip",
    identifier: requesterKey,
    windowSec: Math.floor(SUPPORT_WINDOW_MS / 1000),
    limit: SUPPORT_MAX_PER_WINDOW,
  });

  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { error: "Too many support requests. Please try again later." },
      { status: 429 },
    );
    applyRateLimitHeaders(response.headers, rateLimit);
    return response;
  }

  try {
    const payload = await request.json();
    const parsed = supportPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid support request payload." }, { status: 400 });
    }
    const { email, subject, message } = parsed.data;

    await db
      .insert(schema.supportRequests)
      .values({ email, subject, message })
      .execute();

    const response = NextResponse.json({ ok: true }, { status: 200 });
    applyRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not create support request." },
      { status: 500 },
    );
  }
}

