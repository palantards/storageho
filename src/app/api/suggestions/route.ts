import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import {
  acceptPhotoSuggestion,
  listPhotoSuggestions,
  rejectPhotoSuggestion,
} from "@/lib/inventory/service";

const querySchema = z.object({
  householdId: z.string().uuid(),
  containerId: z.string().uuid().optional(),
  status: z.enum(["pending", "accepted", "rejected"]).optional(),
});

const bodySchema = z.object({
  householdId: z.string().uuid(),
  suggestionId: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
  name: z.string().trim().min(1).max(160).optional(),
  quantity: z.number().int().min(1).max(100000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
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

    const suggestions = await listPhotoSuggestions({
      userId: session.user.id,
      householdId: parsed.householdId,
      containerId: parsed.containerId,
      status: parsed.status,
      limit: 150,
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

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    if (body.action === "accept") {
      const suggestion = await acceptPhotoSuggestion({
        userId: session.user.id,
        householdId: body.householdId,
        suggestionId: body.suggestionId,
        name: body.name,
        quantity: body.quantity,
        tags: body.tags,
      });
      return NextResponse.json({ ok: true, suggestion });
    }

    const suggestion = await rejectPhotoSuggestion({
      userId: session.user.id,
      householdId: body.householdId,
      suggestionId: body.suggestionId,
    });
    return NextResponse.json({ ok: true, suggestion });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update suggestion" },
      { status: 400 },
    );
  }
}
