import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { upsertRoomLayout } from "@/lib/inventory/service";

const bodySchema = z.object({
  householdId: z.string().uuid(),
  roomId: z.string().uuid(),
  width: z.number().min(1).max(10000),
  height: z.number().min(1).max(10000),
  backgroundPhotoId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const layout = await upsertRoomLayout({
      userId: session.user.id,
      householdId: body.householdId,
      roomId: body.roomId,
      width: body.width,
      height: body.height,
      backgroundPhotoId: body.backgroundPhotoId ?? null,
    });
    return NextResponse.json({ ok: true, layout });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save layout" },
      { status: 400 },
    );
  }
}
