import { eq, sql } from "drizzle-orm";

import { db, schema } from "@/server/db";

export async function getProfileBySupabaseId(supabaseUserId: string) {
  if (!supabaseUserId) return null;
  return db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, supabaseUserId),
    columns: {
      userId: true,
      displayName: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateProfile({
  supabaseUserId,
  name,
  company,
}: {
  supabaseUserId: string;
  name: string;
  company?: string;
}) {
  const trimmedName = name.trim();
  const trimmedCompany = company?.trim() || null;
  if (!trimmedName) {
    throw new Error("Name is required");
  }

  try {
    await db.execute(sql`
      insert into public.profiles (user_id, display_name, company)
      values (${supabaseUserId}, ${trimmedName}, ${trimmedCompany})
      on conflict (user_id) do update
      set
        display_name = excluded.display_name,
        company = excluded.company,
        updated_at = now()
    `);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null
        ? ((error as { cause?: { code?: string }; code?: string }).cause
            ?.code ?? (error as { code?: string }).code)
        : undefined;
    if (code !== "42703") {
      throw error;
    }

    await db.execute(sql`
      insert into public.profiles (user_id, display_name)
      values (${supabaseUserId}, ${trimmedName})
      on conflict (user_id) do update
      set
        display_name = excluded.display_name,
        updated_at = now()
    `);
  }
}
