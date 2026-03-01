import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import {
  createHouseholdCanvasLayer,
  deleteHouseholdCanvasLayer,
  listHouseholdCanvasLayers,
  updateHouseholdCanvasLayer,
} from "@/lib/inventory/service";
import {
  householdCanvasLayerSchema,
  householdCanvasLayerUpdateSchema,
} from "@/lib/inventory/validation";

const getSchema = z.object({
  householdId: z.string().uuid(),
});

const deleteSchema = z.object({
  householdId: z.string().uuid(),
  layerId: z.string().uuid(),
});

function getPgCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const typed = error as { code?: string; cause?: { code?: string } };
  return typed.cause?.code ?? typed.code;
}

function toErrorMessage(error: unknown, fallback: string) {
  if (getPgCode(error) === "42P01") {
    return "Database schema is missing household canvas tables. Run: npm run db:migrate";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = getSchema.parse({
      householdId: request.nextUrl.searchParams.get("householdId") || "",
    });
    const layers = await listHouseholdCanvasLayers({
      userId: session.user.id,
      householdId: parsed.householdId,
    });
    return NextResponse.json({ layers });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: toErrorMessage(error, "Unable to load canvas layers") },
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
    const body = householdCanvasLayerSchema.parse(await request.json());
    const layer = await createHouseholdCanvasLayer({
      userId: session.user.id,
      householdId: body.householdId,
      name: body.name,
      locationId: body.locationId ?? null,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ ok: true, layer });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: toErrorMessage(error, "Unable to create canvas layer") },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = householdCanvasLayerUpdateSchema.parse(await request.json());
    const layer = await updateHouseholdCanvasLayer({
      userId: session.user.id,
      householdId: body.householdId,
      layerId: body.layerId,
      name: body.name,
      locationId: body.locationId,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ ok: true, layer });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: toErrorMessage(error, "Unable to update canvas layer") },
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
    const layer = await deleteHouseholdCanvasLayer({
      userId: session.user.id,
      householdId: body.householdId,
      layerId: body.layerId,
    });
    return NextResponse.json({ ok: true, layer });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: toErrorMessage(error, "Unable to delete canvas layer") },
      { status: 400 },
    );
  }
}
