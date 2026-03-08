import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { STORAGE_BUCKET } from "@/lib/inventory/constants";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";
import { requireHouseholdMembership } from "@/lib/inventory/guards";
import { withRlsUserContext } from "@/server/db/tenant";

const pathSchema = z
  .string()
  .min(10)
  .max(500)
  .regex(/^household\/[0-9a-fA-F-]{36}\/[\w\-./]+$/);

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedPath = pathSchema.safeParse(body?.path);
  if (!parsedPath.success) {
    return NextResponse.json(
      { error: "Invalid storage path" },
      { status: 400 },
    );
  }
  const path = parsedPath.data;
  const householdId = path.split("/")[1];

  try {
    await withRlsUserContext(session.user.id, async () => {
      await requireHouseholdMembership(session.user.id, householdId);
    });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 60 * 15);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || "Unable to sign URL" },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ url: data.signedUrl });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
