import "server-only";

import { eq } from "drizzle-orm";

import { dbAdmin as db, schema } from "@/server/db";

export async function findDbUserBySupabaseId(supabaseUserId: string) {
  if (!supabaseUserId) {
    return null;
  }

  return db.query.users.findFirst({
    where: eq(schema.users.supabaseUserId, supabaseUserId),
  });
}

export async function findDbUserIdBySupabaseId(supabaseUserId: string) {
  if (!supabaseUserId) {
    return null;
  }

  return db.query.users.findFirst({
    where: eq(schema.users.supabaseUserId, supabaseUserId),
    columns: {
      id: true,
    },
  });
}
