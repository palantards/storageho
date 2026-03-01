import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { parseQuickAddText } from "@/lib/inventory/quick-add";
import {
  addItemQuantityToContainer,
  findOrCreateItemByName,
} from "@/lib/inventory/service";

const bodySchema = z.object({
  householdId: z.string().uuid(),
  containerId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
});

const MAX_ENTRIES = 60;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const entries = parseQuickAddText(body.text).slice(0, MAX_ENTRIES);

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No valid entries found in text input." },
        { status: 400 },
      );
    }

    const results: Array<{ itemId: string; name: string; quantity: number }> = [];
    for (const entry of entries) {
      const item = await findOrCreateItemByName({
        userId: session.user.id,
        householdId: body.householdId,
        name: entry.name,
      });

      await addItemQuantityToContainer({
        userId: session.user.id,
        householdId: body.householdId,
        containerId: body.containerId,
        itemId: item.id,
        quantityDelta: entry.quantity,
      });

      results.push({
        itemId: item.id,
        name: item.name,
        quantity: entry.quantity,
      });
    }

    return NextResponse.json({ ok: true, results, processed: results.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quick add failed" },
      { status: 400 },
    );
  }
}
