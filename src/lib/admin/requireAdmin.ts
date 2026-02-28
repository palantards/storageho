import { getSession, type Session } from "@/lib/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export type AdminSessionGuard =
  | { ok: true; status: 200; session: Session; me: { isAdmin: true } }
  | { ok: false; status: 401 | 403; session: Session | null; me: null };

export async function requireAdmin(): Promise<AdminSessionGuard> {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    return { ok: false, status: 401, me: null, session: null };
  }

  const me = await db.query.users.findFirst({
    where: eq(users.supabaseUserId, userId),
    columns: { isAdmin: true },
  });

  if (!me?.isAdmin) {
    return { ok: false, status: 403, me: null, session };
  }

  return { ok: true, status: 200, session, me: { isAdmin: true } };
}
