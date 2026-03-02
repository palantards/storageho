import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { STORAGE_BUCKET } from "@/lib/inventory/constants";
import { listMembershipsForUser } from "@/lib/inventory/service";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get("path") || "";
  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const parts = path.split("/");
  const householdId = parts[0] === "household" ? parts[1] : "";
  if (!householdId) {
    return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
  }

  const memberships = await listMembershipsForUser(session.user.id);
  const isMember = memberships.some((m) => m.household.id === householdId);
  if (!isMember) {
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

  return NextResponse.json({ url: data.signedUrl });
}
