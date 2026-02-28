import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  getActiveMembershipContext,
  globalSearch,
} from "@/lib/inventory/service";
import { normalizeSearchQuery } from "@/lib/inventory/search-utils";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = normalizeSearchQuery(
    request.nextUrl.searchParams.get("q") || "",
  );
  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const requestedHouseholdId = request.nextUrl.searchParams.get("householdId");

  const context = await getActiveMembershipContext(session.user.id);
  const activeHouseholdId = requestedHouseholdId || context.active?.household.id;
  if (!activeHouseholdId) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await globalSearch({
      userId: session.user.id,
      householdId: activeHouseholdId,
      query,
      limit: 30,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Search failed" }, { status: 400 });
  }
}
