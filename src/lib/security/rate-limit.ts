import "server-only";

import { sql } from "drizzle-orm";

import { dbAdmin } from "@/server/db/admin";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
};

const RATE_LIMIT_RETENTION_DAYS = 7;
const RATE_LIMIT_PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;

const globalForRateLimit = globalThis as unknown as {
  rateLimitLastPrunedAt?: number;
};

function bucketStartFor(now: Date, windowSec: number) {
  const windowMs = windowSec * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

function maybePruneExpiredBuckets() {
  const now = Date.now();
  const lastPrunedAt = globalForRateLimit.rateLimitLastPrunedAt ?? 0;
  if (now - lastPrunedAt < RATE_LIMIT_PRUNE_INTERVAL_MS) {
    return;
  }

  globalForRateLimit.rateLimitLastPrunedAt = now;
  void dbAdmin
    .execute(sql`
      delete from public.request_rate_limits
      where bucket_start < now() - (${RATE_LIMIT_RETENTION_DAYS} * interval '1 day')
    `)
    .catch((error) => {
      console.error("Failed to prune request rate limits", error);
    });
}

export async function consumeRateLimit(input: {
  scope: string;
  identifier: string;
  windowSec: number;
  limit: number;
  now?: Date;
}): Promise<RateLimitResult> {
  const scope = input.scope.trim();
  const identifier = input.identifier.trim();
  if (!scope) {
    throw new Error("Rate limit scope is required");
  }
  if (!identifier) {
    throw new Error("Rate limit identifier is required");
  }
  if (!Number.isInteger(input.windowSec) || input.windowSec <= 0) {
    throw new Error("Rate limit windowSec must be a positive integer");
  }
  if (!Number.isInteger(input.limit) || input.limit <= 0) {
    throw new Error("Rate limit limit must be a positive integer");
  }

  const now = input.now ?? new Date();
  const bucketStart = bucketStartFor(now, input.windowSec);
  const bucketEndMs = bucketStart.getTime() + input.windowSec * 1000;

  const result = await dbAdmin.execute<{ count: number }>(sql`
    insert into public.request_rate_limits (
      scope,
      identifier,
      bucket_start,
      count,
      created_at,
      updated_at
    )
    values (
      ${scope},
      ${identifier},
      ${bucketStart},
      1,
      now(),
      now()
    )
    on conflict (scope, identifier, bucket_start)
    do update set
      count = public.request_rate_limits.count + 1,
      updated_at = now()
    returning count
  `);

  maybePruneExpiredBuckets();

  const count = Number(result.rows[0]?.count ?? 0);
  return {
    allowed: count <= input.limit,
    limit: input.limit,
    remaining: Math.max(0, input.limit - count),
    retryAfterSec: Math.max(1, Math.ceil((bucketEndMs - now.getTime()) / 1000)),
  };
}

export function applyRateLimitHeaders(headers: Headers, result: RateLimitResult) {
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("Retry-After", String(result.retryAfterSec));
}
