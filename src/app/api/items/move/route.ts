import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { moveItemBetweenContainers } from "@/lib/inventory/service";

const bodySchema = z.object({
  householdId: z.string().uuid(),
  itemId: z.string().uuid(),
  fromContainerId: z.string().uuid(),
  toContainerId: z.string().uuid(),
  quantity: z.number().int().min(1),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = bodySchema.parse(await request.json());

    await moveItemBetweenContainers({
      userId: session.user.id,
      householdId: payload.householdId,
      itemId: payload.itemId,
      fromContainerId: payload.fromContainerId,
      toContainerId: payload.toContainerId,
      quantity: payload.quantity,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Move failed" },
      { status: 400 },
    );
  }
}
