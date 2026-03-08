"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  type ActionFail,
  type ActionOk,
  zodToFieldErrors,
} from "@/lib/forms/action-result";
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
  const scope = itemLibraryScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = bulkItemTextSchema.safeParse({
    bulkText: getFormString(formData, "bulkText"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid bulk item payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["bulkText"] as const),
    } satisfies ActionFail<"bulkText">;
  }

  const entries = parseQuickAddText(parsed.data.bulkText);

  if (!entries.length) {
    return {
      ok: false as const,
      error: "Add at least one item",
      fieldErrors: { bulkText: "Add at least one item" },
    } satisfies ActionFail<"bulkText">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () => {
      for (const entry of entries) {
        const item = await findOrCreateItemByName({
          userId: user.id,
          householdId: scope.data.householdId,
          name: entry.name,
        });
        await findOrCreateItemByName({
          userId: user.id,
          householdId: scope.data.householdId,
          name: item.name,
        });
      }
    });
  } catch (error) {
    console.error("Failed to bulk add items", error);
    return { ok: false as const, error: "Unable to add items" } satisfies ActionFail;
  }

  revalidatePath(itemLibraryPath(scope.data.locale));
  return { ok: true as const } satisfies ActionOk;
}

export async function mergeItemsFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = itemLibraryScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = mergeLibraryItemsSchema.safeParse({
    sourceItemId: getFormString(formData, "sourceItemId"),
    targetItemId: getFormString(formData, "targetItemId"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid merge payload",
      fieldErrors: zodToFieldErrors(
        parsed.error,
        ["sourceItemId", "targetItemId"] as const,
      ),
    } satisfies ActionFail<"sourceItemId" | "targetItemId">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      mergeItems({
        userId: user.id,
        householdId: scope.data.householdId,
        sourceItemId: parsed.data.sourceItemId,
        targetItemId: parsed.data.targetItemId,
      }),
    );
  } catch (error) {
    console.error("Failed to merge items", error);
    return { ok: false as const, error: "Unable to merge items" } satisfies ActionFail;
  }

  revalidatePath(itemLibraryPath(scope.data.locale));
  return { ok: true as const } satisfies ActionOk;
}
