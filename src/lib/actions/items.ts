"use server";

import { z } from "zod";

import { requireSessionUser } from "@/lib/inventory/auth";
import { requireHouseholdWriteAccess } from "@/lib/inventory/guards";
import { moveItemBetweenContainers } from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

const moveSchema = z.object({
  householdId: z.string().uuid(),
  itemId: z.string().uuid(),
  fromContainerId: z.string().uuid(),
  toContainerId: z.string().uuid(),
  quantity: z.number().int().min(1),
});

export async function moveItemAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid move payload" };
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () => {
      await requireHouseholdWriteAccess(user.id, parsed.data.householdId);

      await moveItemBetweenContainers({
        userId: user.id,
        householdId: parsed.data.householdId,
        itemId: parsed.data.itemId,
        fromContainerId: parsed.data.fromContainerId,
        toContainerId: parsed.data.toContainerId,
        quantity: parsed.data.quantity,
      });
    });

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Move failed" };
  }
}
