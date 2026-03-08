import "server-only";

import { eq } from "drizzle-orm";

import { ensureStripeCustomer } from "@/lib/stripe";
import { ensureUserRecord } from "@/lib/user-sync";
import { dbAdmin as db, schema } from "@/server/db";

export async function getOrCreateStripeCustomerId(input: {
  supabaseUserId: string;
  email: string;
  name?: string;
  company?: string;
}) {
  const userRecord = await ensureUserRecord({
    id: input.supabaseUserId,
    email: input.email,
  });

  if (userRecord.stripeCustomerId) {
    return userRecord.stripeCustomerId;
  }

  const stripeCustomerId = await ensureStripeCustomer({
    supabaseUserId: input.supabaseUserId,
    email: input.email,
    name: input.name,
    company: input.company,
  });

  await db
    .update(schema.users)
    .set({ stripeCustomerId })
    .where(eq(schema.users.id, userRecord.id));

  return stripeCustomerId;
}
