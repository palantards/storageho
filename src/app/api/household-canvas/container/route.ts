import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import {
  createAndPlaceContainerOnHouseholdCanvas,
  deleteContainer,
} from "@/lib/inventory/service";
import { householdCanvasCreateContainerSchema } from "@/lib/inventory/validation";

const deleteSchema = z.object({
  householdId: z.string().uuid(),
  containerId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = householdCanvasCreateContainerSchema.parse(await request.json());
    const result = await createAndPlaceContainerOnHouseholdCanvas({
      userId: session.user.id,
      householdId: body.householdId,
      layerId: body.layerId,
      roomId: body.roomId,
      parentContainerId: body.parentContainerId ?? null,
      name: body.name,
      code: body.code,
      description: body.description,
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height,
      rotation: body.rotation,
      label: body.label,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create container on canvas" },
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
    const result = await deleteContainer({
      userId: session.user.id,
      householdId: body.householdId,
      containerId: body.containerId,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete container" },
      { status: 400 },
    );
  }
}

