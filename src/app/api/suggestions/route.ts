import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { listPhotoSuggestions } from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

const querySchema = z.object({
  householdId: z.string().uuid(),
  containerId: z.string().uuid().optional(),
  status: z.enum(["pending", "accepted", "rejected"]).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = querySchema.parse({
      householdId: request.nextUrl.searchParams.get("householdId") || "",
      containerId: request.nextUrl.searchParams.get("containerId") || undefined,
      status: request.nextUrl.searchParams.get("status") || undefined,
    });

    const suggestions = await withRlsUserContext(session.user.id, async () => {
      return listPhotoSuggestions({
        userId: session.user.id,
        householdId: parsed.householdId,
        containerId: parsed.containerId,
        status: parsed.status,
      });
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load suggestions" },
      { status: 400 },
    );
  }
}

