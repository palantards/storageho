import { NextResponse } from "next/server";
import { getUsers } from "@/lib/admin/users";

import { requireAdmin } from "@/lib/admin/requireAdmin";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: guard.status });
  }

  const { searchParams } = new URL(req.url);
  const offsetRaw = parseInt(searchParams.get("offset") || "0", 10);
  const limitRaw = parseInt(searchParams.get("limit") || "30", 10);
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
  const limit =
    Number.isFinite(limitRaw) && limitRaw >= 1 && limitRaw <= 100
      ? limitRaw
      : 30;

  const usersList = await getUsers({ offset, limit });
  return NextResponse.json(usersList);
}

