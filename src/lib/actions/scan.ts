"use server";

import { z } from "zod";

import { requireSessionUser } from "@/lib/inventory/auth";
import { requireHouseholdWriteAccess } from "@/lib/inventory/guards";
import { parseQuickAddText } from "@/lib/inventory/quick-add";
import {
  addItemQuantityToContainer,
  findOrCreateItemByName,
} from "@/lib/inventory/service";

const quickAddSchema = z.object({
  householdId: z.string().uuid(),
  containerId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
});

const MAX_ENTRIES = 60;

export async function quickAddAction(
  input: unknown,
): Promise<
  | {
      ok: true;
      results: Array<{ itemId: string; name: string; quantity: number }>;
      processed: number;
    }
  | { ok: false; error: string }
> {
  const parsed = quickAddSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid quick-add payload" };
  }

  try {
    const user = await requireSessionUser();
    await requireHouseholdWriteAccess(user.id, parsed.data.householdId);

    const entries = parseQuickAddText(parsed.data.text).slice(0, MAX_ENTRIES);
    if (entries.length === 0) {
      return { ok: false, error: "No valid entries found in text input." };
    }

    const results: Array<{ itemId: string; name: string; quantity: number }> =
      [];
    for (const entry of entries) {
      const item = await findOrCreateItemByName({
        userId: user.id,
        householdId: parsed.data.householdId,
        name: entry.name,
      });

      await addItemQuantityToContainer({
        userId: user.id,
        householdId: parsed.data.householdId,
        containerId: parsed.data.containerId,
        itemId: item.id,
        quantityDelta: entry.quantity,
      });

      results.push({
        itemId: item.id,
        name: item.name,
        quantity: entry.quantity,
      });
    }

    return { ok: true, results, processed: results.length };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Quick add failed" };
  }
}
