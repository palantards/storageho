"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  type ActionFail,
  type ActionOk,
  zodToFieldErrors,
} from "@/lib/forms/action-result";
import { requireSessionUser } from "@/lib/inventory/auth";
import {
  createItem,
  createTag,
  deleteContainer,
  deleteContainerItem,
  listItemsForHousehold,
  setContainerArchived,
  setContainerTags,
  updateContainerItemQuantity,
  updateItemName,
  upsertContainerItem,
} from "@/lib/inventory/service";
import {
  getFormOptionalString,
  getFormString,
} from "@/lib/forms/form-data";
import { withRlsUserContext } from "@/server/db/tenant";

const boxScopeSchema = z.object({
  locale: z.string().trim().min(2).max(10),
  householdId: z.string().uuid(),
  boxId: z.string().uuid(),
});

const boxRoomScopeSchema = boxScopeSchema.extend({
  roomId: z.string().uuid(),
});

const addBoxItemSchema = z.object({
  item: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().int().min(1).max(100000),
  note: z.string().trim().max(2000).optional(),
});

const updateBoxTagsSchema = z.object({
  tagNames: z
    .string()
    .transform((raw) =>
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
});

const archiveBoxSchema = z.object({
  archived: z.union([z.literal("0"), z.literal("1")]).transform((value) => value === "1"),
});

const renameBoxItemSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
});

const updateBoxItemQuantitySchema = z.object({
  containerItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(100000),
});

const removeBoxItemSchema = z.object({
  containerItemId: z.string().uuid(),
});

function boxPath(locale: string, boxId: string) {
  return `/${locale}/boxes/${boxId}`;
}

export async function addItemToBoxFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = boxScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = addBoxItemSchema.safeParse({
    item: getFormString(formData, "item"),
    quantity: getFormString(formData, "quantity"),
    note: getFormOptionalString(formData, "note"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid box item payload",
      fieldErrors: zodToFieldErrors(
        parsed.error,
        ["item", "quantity", "note"] as const,
      ),
    } satisfies ActionFail<"item" | "quantity" | "note">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () => {
      const existingItems = await listItemsForHousehold({
        userId: user.id,
        householdId: scope.data.householdId,
      });
      const match = existingItems.find(
        (item) =>
          item.name.trim().toLowerCase() === parsed.data.item.toLowerCase(),
      );

      let targetItemId = match?.id;
      if (!targetItemId) {
        const created = await createItem({
          userId: user.id,
          householdId: scope.data.householdId,
          name: parsed.data.item,
        });
        targetItemId = created.id;
      }

      await upsertContainerItem({
        userId: user.id,
        householdId: scope.data.householdId,
        containerId: scope.data.boxId,
        itemId: targetItemId,
        quantity: parsed.data.quantity,
        note: parsed.data.note,
      });
    });
  } catch (error) {
    console.error("Failed to add item to box", error);
    return { ok: false as const, error: "Unable to add item" } satisfies ActionFail;
  }

  revalidatePath(boxPath(scope.data.locale, scope.data.boxId));
  revalidatePath(`/${scope.data.locale}/items`);
  return { ok: true as const } satisfies ActionOk;
}

export async function updateBoxTagsFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = boxScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = updateBoxTagsSchema.safeParse({
    tagNames: getFormString(formData, "tagNames"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid tag payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["tagNames"] as const),
    } satisfies ActionFail<"tagNames">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () => {
      const tagIds: string[] = [];
      for (const name of parsed.data.tagNames) {
        const tag = await createTag({
          userId: user.id,
          householdId: scope.data.householdId,
          name,
        });
        tagIds.push(tag.id);
      }

      await setContainerTags({
        userId: user.id,
        householdId: scope.data.householdId,
        containerId: scope.data.boxId,
        tagIds,
      });
    });
  } catch (error) {
    console.error("Failed to update box tags", error);
    return { ok: false as const, error: "Unable to update tags" } satisfies ActionFail;
  }

  revalidatePath(boxPath(scope.data.locale, scope.data.boxId));
  return { ok: true as const } satisfies ActionOk;
}

export async function setBoxArchivedFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = boxRoomScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = archiveBoxSchema.safeParse({
    archived: getFormString(formData, "archived"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid archive payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["archived"] as const),
    } satisfies ActionFail<"archived">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      setContainerArchived({
        userId: user.id,
        householdId: scope.data.householdId,
        containerId: scope.data.boxId,
        archived: parsed.data.archived,
      }),
    );
  } catch (error) {
    console.error("Failed to archive box", error);
    return { ok: false as const, error: "Unable to update box" } satisfies ActionFail;
  }

  revalidatePath(boxPath(scope.data.locale, scope.data.boxId));
  revalidatePath(`/${scope.data.locale}/rooms/${scope.data.roomId}`);
  return { ok: true as const } satisfies ActionOk;
}

export async function renameBoxItemFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = boxScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = renameBoxItemSchema.safeParse({
    itemId: getFormString(formData, "itemId"),
    name: getFormString(formData, "name"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid rename payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["itemId", "name"] as const),
    } satisfies ActionFail<"itemId" | "name">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      updateItemName({
        userId: user.id,
        householdId: scope.data.householdId,
        itemId: parsed.data.itemId,
        name: parsed.data.name,
      }),
    );
  } catch (error) {
    console.error("Failed to rename box item", error);
    return { ok: false as const, error: "Unable to rename item" } satisfies ActionFail;
  }

  revalidatePath(boxPath(scope.data.locale, scope.data.boxId));
  revalidatePath(`/${scope.data.locale}/items`);
  return { ok: true as const } satisfies ActionOk;
}

export async function updateBoxItemQuantityFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = boxScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = updateBoxItemQuantitySchema.safeParse({
    containerItemId: getFormString(formData, "containerItemId"),
    quantity: getFormString(formData, "quantity"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid quantity payload",
      fieldErrors: zodToFieldErrors(
        parsed.error,
        ["containerItemId", "quantity"] as const,
      ),
    } satisfies ActionFail<"containerItemId" | "quantity">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      updateContainerItemQuantity({
        userId: user.id,
        householdId: scope.data.householdId,
        containerItemId: parsed.data.containerItemId,
        quantity: parsed.data.quantity,
      }),
    );
  } catch (error) {
    console.error("Failed to update box item quantity", error);
    return {
      ok: false as const,
      error: "Unable to update quantity",
    } satisfies ActionFail;
  }

  revalidatePath(boxPath(scope.data.locale, scope.data.boxId));
  return { ok: true as const } satisfies ActionOk;
}

export async function removeBoxItemFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = boxScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = removeBoxItemSchema.safeParse({
    containerItemId: getFormString(formData, "containerItemId"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid remove payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["containerItemId"] as const),
    } satisfies ActionFail<"containerItemId">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      deleteContainerItem({
        userId: user.id,
        householdId: scope.data.householdId,
        containerItemId: parsed.data.containerItemId,
      }),
    );
  } catch (error) {
    console.error("Failed to remove box item", error);
    return { ok: false as const, error: "Unable to remove item" } satisfies ActionFail;
  }

  revalidatePath(boxPath(scope.data.locale, scope.data.boxId));
  return { ok: true as const } satisfies ActionOk;
}

export async function deleteBoxFormAction(scopeInput: unknown) {
  const scope = boxRoomScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      deleteContainer({
        userId: user.id,
        householdId: scope.data.householdId,
        containerId: scope.data.boxId,
      }),
    );
  } catch (error) {
    console.error("Failed to delete box", error);
    return { ok: false as const, error: "Unable to delete box" } satisfies ActionFail;
  }

  redirect(`/${scope.data.locale}/rooms/${scope.data.roomId}`);
  return { ok: true as const } satisfies ActionOk;
}
