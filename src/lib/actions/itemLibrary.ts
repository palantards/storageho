"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSessionUser } from "@/lib/inventory/auth";
import { parseQuickAddText } from "@/lib/inventory/quick-add";
import {
  findOrCreateItemByName,
  mergeItems,
} from "@/lib/inventory/service";
import { getFormString } from "@/lib/forms/form-data";
import { withRlsUserContext } from "@/server/db/tenant";

const itemLibraryScopeSchema = z.object({
  locale: z.string().trim().min(2).max(10),
  householdId: z.string().uuid(),
});

const bulkItemTextSchema = z.object({
  bulkText: z.string().trim().min(1).max(10000),
});

const mergeLibraryItemsSchema = z
  .object({
    sourceItemId: z.string().uuid(),
    targetItemId: z.string().uuid(),
  })
  .refine((value) => value.sourceItemId !== value.targetItemId, {
    message: "Choose two different items to merge",
    path: ["targetItemId"],
  });

function itemLibraryPath(locale: string) {
  return `/${locale}/items`;
}

export async function bulkAddItemsFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = itemLibraryScopeSchema.parse(scopeInput);
  const parsed = bulkItemTextSchema.parse({
    bulkText: getFormString(formData, "bulkText"),
  });
  const entries = parseQuickAddText(parsed.bulkText);

  if (!entries.length) {
    throw new Error("Add at least one item.");
  }

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () => {
    for (const entry of entries) {
      const item = await findOrCreateItemByName({
        userId: user.id,
        householdId: scope.householdId,
        name: entry.name,
      });
      await findOrCreateItemByName({
        userId: user.id,
        householdId: scope.householdId,
        name: item.name,
      });
    }
  });

  revalidatePath(itemLibraryPath(scope.locale));
}

export async function mergeItemsFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = itemLibraryScopeSchema.parse(scopeInput);
  const parsed = mergeLibraryItemsSchema.parse({
    sourceItemId: getFormString(formData, "sourceItemId"),
    targetItemId: getFormString(formData, "targetItemId"),
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () =>
    mergeItems({
      userId: user.id,
      householdId: scope.householdId,
      sourceItemId: parsed.sourceItemId,
      targetItemId: parsed.targetItemId,
    }),
  );

  revalidatePath(itemLibraryPath(scope.locale));
}
