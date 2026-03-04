import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/server/db";

const supportPayloadSchema = z.object({
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(4000),
});

const supportRateLimit = new Map<string, { count: number; resetAt: number }>();
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

function checkSupportRateLimit(key: string) {
  const now = Date.now();
  const current = supportRateLimit.get(key);

  if (!current || current.resetAt <= now) {
    supportRateLimit.set(key, { count: 1, resetAt: now + SUPPORT_WINDOW_MS });
    return true;
  }

  if (current.count >= SUPPORT_MAX_PER_WINDOW) {
    return false;
  }

  current.count += 1;
  supportRateLimit.set(key, current);
  return true;
}

export async function POST(request: NextRequest) {
  const requesterKey = getRequesterKey(request);
  if (!checkSupportRateLimit(requesterKey)) {
    return NextResponse.json(
      { error: "Too many support requests. Please try again later." },
      { status: 429 },
    );
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not create support request." },
      { status: 500 },
    );
  }
}

