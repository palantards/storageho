import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { createAndPlaceRoomOnHouseholdCanvas, deleteRoom } from "@/lib/inventory/service";
import { householdCanvasCreateRoomSchema } from "@/lib/inventory/validation";

const deleteSchema = z.object({
  householdId: z.string().uuid(),
  roomId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = householdCanvasCreateRoomSchema.parse(await request.json());
    const result = await createAndPlaceRoomOnHouseholdCanvas({
      userId: session.user.id,
      householdId: body.householdId,
      layerId: body.layerId,
      name: body.name,
      description: body.description,
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height,
      rotation: body.rotation,
      shapeType: body.shapeType,
      label: body.label,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create room on canvas" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = deleteSchema.parse(await request.json());
    const result = await deleteRoom({
      userId: session.user.id,
      householdId: body.householdId,
      roomId: body.roomId,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete room" },
      { status: 400 },
    );
  }
}

