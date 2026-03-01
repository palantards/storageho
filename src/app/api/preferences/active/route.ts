import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import {
  setActiveLocationPreference,
  setActiveRoomPreference,
} from "@/lib/inventory/service";

const bodySchema = z.object({
  householdId: z.string().uuid(),
  locationId: z.string().uuid().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());

    if ("roomId" in body) {
      await setActiveRoomPreference({
        userId: session.user.id,
        householdId: body.householdId,
        roomId: body.roomId ?? null,
      });
    } else {
      await setActiveLocationPreference({
        userId: session.user.id,
        householdId: body.householdId,
        locationId: body.locationId ?? null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update preference" },
      { status: 400 },
    );
  }
}
