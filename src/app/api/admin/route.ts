import { NextResponse } from "next/server";
import { getUsers } from "@/lib/admin/users";

import { requireAdmin } from "@/lib/admin/requireAdmin";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) throw new Error("Forbidden");

  const { searchParams } = new URL(req.url);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = parseInt(searchParams.get("limit") || "30", 10);

  const usersList = await getUsers({ offset, limit });
  return NextResponse.json(usersList);
}

