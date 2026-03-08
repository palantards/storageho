import "server-only";

import { sql } from "drizzle-orm";

import { type SessionUser } from "@/lib/auth";
import { dbAdmin as db, schema } from "@/server/db";

type ProfileDefaults = {
  name?: string | null;
  displayName?: string | null;
  company?: string | null;
  locale?: string | null;
};

export async function ensureUserRecord(sessionUser: SessionUser) {
  if (!sessionUser?.id || !sessionUser.email) {
    throw new Error("Session user is missing id or email");
  }

  const stripeCustomerId = sessionUser.stripeCustomerId ?? null;

  const [user] = await db
    .insert(schema.users)
    .values({
      supabaseUserId: sessionUser.id,
      email: sessionUser.email,
      stripeCustomerId,
    })
    .onConflictDoUpdate({
      target: schema.users.supabaseUserId,
      set: {
        email: sessionUser.email,
        stripeCustomerId:
          stripeCustomerId ??
          sql`coalesce("users"."stripe_customer_id", EXCLUDED."stripe_customer_id")`,
        updatedAt: new Date(),
      },
    })
    .returning();

  return user;
}

export async function ensureProfileRecord(
  userId: string,
  defaults?: ProfileDefaults
) {
  if (!userId) throw new Error("User id is required to ensure profile");

  const name = defaults?.name ?? null;
  const displayName = defaults?.displayName ?? name ?? null;
  const company = defaults?.company ?? null;
  const locale = defaults?.locale ?? null;

  const [profile] = await db
    .insert(schema.profiles)
    .values({
      userId,
      displayName,
      name,
      company,
      locale,
    })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: {
        displayName: displayName ?? sql`"profiles"."display_name"`,
        name: name ?? sql`"profiles"."name"`,
        company: company ?? sql`"profiles"."company"`,
        locale: locale ?? sql`"profiles"."locale"`,
        updatedAt: new Date(),
      },
    })
    .returning();

  return profile;
}

