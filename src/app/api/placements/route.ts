import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import {
  deletePlacement,
  listPlacementsForRoom,
  upsertPlacement,
  upsertRoomLayout,
} from "@/lib/inventory/service";

const getSchema = z.object({
  householdId: z.string().uuid(),
  roomId: z.string().uuid(),
});

const upsertSchema = z.object({
  householdId: z.string().uuid(),
  roomId: z.string().uuid(),
  entityType: z.enum(["container", "item"]),
  entityId: z.string().uuid(),
  x: z.number().min(0).max(100000),
  y: z.number().min(0).max(100000),
  rotation: z.number().min(-360).max(360).optional(),
  label: z.string().trim().max(120).optional(),
  layout: z
    .object({
      width: z.number().min(1).max(10000),
      height: z.number().min(1).max(10000),
      backgroundPhotoId: z.string().uuid().nullable().optional(),
    })
    .optional(),
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
      roomId: request.nextUrl.searchParams.get("roomId") || "",
    });

    const placements = await listPlacementsForRoom({
      userId: session.user.id,
      householdId: parsed.householdId,
      roomId: parsed.roomId,
    });

    return NextResponse.json({ placements });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load placements" },
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
    const parsed = upsertSchema.parse(await request.json());
    const placement = await upsertPlacement({
      userId: session.user.id,
      householdId: parsed.householdId,
      roomId: parsed.roomId,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      x: parsed.x,
      y: parsed.y,
      rotation: parsed.rotation,
      label: parsed.label,
    });

    if (parsed.layout) {
      await upsertRoomLayout({
        userId: session.user.id,
        householdId: parsed.householdId,
        roomId: parsed.roomId,
        width: parsed.layout.width,
        height: parsed.layout.height,
        backgroundPhotoId: parsed.layout.backgroundPhotoId ?? null,
      });
    }

    return NextResponse.json({ ok: true, placement });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save placement" },
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
    const parsed = deleteSchema.parse(await request.json());
    const placement = await deletePlacement({
      userId: session.user.id,
      householdId: parsed.householdId,
      placementId: parsed.placementId,
    });
    return NextResponse.json({ ok: true, placement });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete placement" },
      { status: 400 },
    );
  }
}
