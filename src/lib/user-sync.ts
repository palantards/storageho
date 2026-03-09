import "server-only";

import { eq, sql } from "drizzle-orm";

import { type SessionUser } from "@/lib/auth";
import { dbAdmin as db, schema } from "@/server/db";

type ProfileDefaults = {
  name?: string | null;
  displayName?: string | null;
  company?: string | null;
  locale?: string | null;
};

export async function ensureUserRecord(
  sessionUser: SessionUser,
  profileDefaults?: ProfileDefaults,
) {
  if (!sessionUser?.id || !sessionUser.email) {
    throw new Error("Session user is missing id or email");
  }

  const stripeCustomerId = sessionUser.stripeCustomerId ?? null;
  const displayName = profileDefaults?.displayName ?? profileDefaults?.name ?? null;
  const name = profileDefaults?.name ?? null;
  const company = profileDefaults?.company ?? null;
  const locale = profileDefaults?.locale ?? null;

  const [user] = await db
    .insert(schema.users)
    .values({
      supabaseUserId: sessionUser.id,
      email: sessionUser.email,
      stripeCustomerId,
      displayName,
      name,
      company,
      locale,
    })
    .onConflictDoUpdate({
      target: schema.users.supabaseUserId,
      set: {
        email: sessionUser.email,
        stripeCustomerId:
          stripeCustomerId ??
          sql`coalesce("users"."stripe_customer_id", EXCLUDED."stripe_customer_id")`,
        // Only overwrite profile fields when explicitly provided
        ...(displayName !== null && { displayName }),
        ...(name !== null && { name }),
        ...(company !== null && { company }),
        ...(locale !== null && { locale }),
        updatedAt: new Date(),
      },
    })
    .returning();

  return user;
}

export async function ensureProfileRecord(
  userId: string,
  defaults?: ProfileDefaults,
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

  // Mirror profile data into users table for consolidation
  await db
    .update(schema.users)
    .set({
      displayName: displayName ?? sql`coalesce("users"."display_name", ${displayName})`,
      name: name ?? sql`coalesce("users"."name", ${name})`,
      company: company ?? sql`coalesce("users"."company", ${company})`,
      locale: locale ?? sql`coalesce("users"."locale", ${locale})`,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.supabaseUserId, userId));

  return profile;
}

