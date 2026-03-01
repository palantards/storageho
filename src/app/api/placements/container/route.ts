import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { createAndPlaceContainer } from "@/lib/inventory/service";
import { createContainerSchema } from "@/lib/inventory/validation";

const bodySchema = createContainerSchema
  .extend({
    x: z.number().min(0).max(100000),
    y: z.number().min(0).max(100000),
    rotation: z.number().min(-360).max(360).optional(),
    label: z.string().trim().max(120).optional(),
  })
  .omit({ parentContainerId: true })
  .extend({
    parentContainerId: z.string().uuid().nullable().optional(),
  });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const result = await createAndPlaceContainer({
      userId: session.user.id,
      householdId: body.householdId,
      roomId: body.roomId,
      parentContainerId: body.parentContainerId ?? null,
      name: body.name,
      code: body.code,
      description: body.description,
      x: body.x,
      y: body.y,
      rotation: body.rotation,
      label: body.label,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create container placement" },
      { status: 400 },
    );
  }
}
