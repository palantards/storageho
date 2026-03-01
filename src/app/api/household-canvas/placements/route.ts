import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import {
  deleteHouseholdCanvasPlacement,
  listHouseholdCanvasPlacements,
  upsertHouseholdCanvasPlacement,
} from "@/lib/inventory/service";
import { householdCanvasPlacementSchema } from "@/lib/inventory/validation";

const getSchema = z.object({
  householdId: z.string().uuid(),
  layerId: z.string().uuid().optional(),
});

const deleteSchema = z.object({
  householdId: z.string().uuid(),
  placementId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = getSchema.parse({
      householdId: request.nextUrl.searchParams.get("householdId") || "",
      layerId: request.nextUrl.searchParams.get("layerId") || undefined,
    });
    const placements = await listHouseholdCanvasPlacements({
      userId: session.user.id,
      householdId: parsed.householdId,
      layerId: parsed.layerId,
    });
    return NextResponse.json({ placements });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load canvas placements" },
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
    const body = householdCanvasPlacementSchema.parse(await request.json());
    const placement = await upsertHouseholdCanvasPlacement({
      userId: session.user.id,
      householdId: body.householdId,
      layerId: body.layerId,
      entityType: body.entityType,
      entityId: body.entityId,
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height,
      rotation: body.rotation,
      shapeType: body.shapeType,
      label: body.label,
    });
    return NextResponse.json({ ok: true, placement });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save canvas placement" },
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
    const placement = await deleteHouseholdCanvasPlacement({
      userId: session.user.id,
      householdId: body.householdId,
      placementId: body.placementId,
    });
    return NextResponse.json({ ok: true, placement });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete canvas placement" },
      { status: 400 },
    );
  }
}
