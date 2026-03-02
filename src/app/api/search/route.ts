import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  getActiveMembershipContext,
  globalSearch,
  semanticSearch,
} from "@/lib/inventory/service";
import {
  buildGroundedFindAnswer,
  fuseSearchResults,
} from "@/lib/inventory/search-fusion";
import { normalizeSearchQuery } from "@/lib/inventory/search-utils";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = normalizeSearchQuery(
    request.nextUrl.searchParams.get("q") || "",
  );
  const mode = request.nextUrl.searchParams.get("mode") || "default";
  if (!query) {
    return NextResponse.json({ results: [], answer: null });
  }

  const requestedHouseholdId = request.nextUrl.searchParams.get("householdId");

  const context = await getActiveMembershipContext(session.user.id);
  const activeHouseholdId = requestedHouseholdId || context.active?.household.id;
  if (!activeHouseholdId) {
    return NextResponse.json({ results: [] });
  }

  try {
    const [fuzzyResults, semanticResults] = await Promise.all([
      globalSearch({
        userId: session.user.id,
        householdId: activeHouseholdId,
        query,
        limit: 30,
      }),
      semanticSearch({
        userId: session.user.id,
        householdId: activeHouseholdId,
        query,
        limit: 24,
      }).catch(() => []),
    ]);

    const results = fuseSearchResults({
      fuzzy: fuzzyResults,
      semantic: semanticResults,
      limit: 30,
    });

    const answer =
      mode === "ai"
        ? buildGroundedFindAnswer({
            query,
            results,
          })
        : null;

    return NextResponse.json({ results, answer });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Search failed" }, { status: 400 });
  }
}

