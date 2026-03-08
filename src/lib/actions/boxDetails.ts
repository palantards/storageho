"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

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
  getFormNullableString,
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
  const scope = boxScopeSchema.parse(scopeInput);
  const parsed = addBoxItemSchema.parse({
    item: getFormString(formData, "item"),
    quantity: getFormString(formData, "quantity"),
    note: getFormOptionalString(formData, "note"),
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () => {
    const existingItems = await listItemsForHousehold({
      userId: user.id,
      householdId: scope.householdId,
    });
    const match = existingItems.find(
      (item) => item.name.trim().toLowerCase() === parsed.item.toLowerCase(),
    );

    let targetItemId = match?.id;
    if (!targetItemId) {
      const created = await createItem({
        userId: user.id,
        householdId: scope.householdId,
        name: parsed.item,
      });
      targetItemId = created.id;
    }

    await upsertContainerItem({
      userId: user.id,
      householdId: scope.householdId,
      containerId: scope.boxId,
      itemId: targetItemId,
      quantity: parsed.quantity,
      note: parsed.note,
    });
  });

  revalidatePath(boxPath(scope.locale, scope.boxId));
  revalidatePath(`/${scope.locale}/items`);
}

export async function updateBoxTagsFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = boxScopeSchema.parse(scopeInput);
  const parsed = updateBoxTagsSchema.parse({
    tagNames: getFormString(formData, "tagNames"),
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () => {
    const tagIds: string[] = [];
    for (const name of parsed.tagNames) {
      const tag = await createTag({
        userId: user.id,
        householdId: scope.householdId,
        name,
      });
      tagIds.push(tag.id);
    }

    await setContainerTags({
      userId: user.id,
      householdId: scope.householdId,
      containerId: scope.boxId,
      tagIds,
    });
  });

  revalidatePath(boxPath(scope.locale, scope.boxId));
}

export async function setBoxArchivedFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = boxRoomScopeSchema.parse(scopeInput);
  const parsed = archiveBoxSchema.parse({
    archived: getFormString(formData, "archived"),
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () =>
    setContainerArchived({
      userId: user.id,
      householdId: scope.householdId,
      containerId: scope.boxId,
      archived: parsed.archived,
    }),
  );

  revalidatePath(boxPath(scope.locale, scope.boxId));
  revalidatePath(`/${scope.locale}/rooms/${scope.roomId}`);
}

export async function renameBoxItemFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = boxScopeSchema.parse(scopeInput);
  const parsed = renameBoxItemSchema.parse({
    itemId: getFormString(formData, "itemId"),
    name: getFormString(formData, "name"),
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () =>
    updateItemName({
      userId: user.id,
      householdId: scope.householdId,
      itemId: parsed.itemId,
      name: parsed.name,
    }),
  );

  revalidatePath(boxPath(scope.locale, scope.boxId));
  revalidatePath(`/${scope.locale}/items`);
}

export async function updateBoxItemQuantityFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = boxScopeSchema.parse(scopeInput);
  const parsed = updateBoxItemQuantitySchema.parse({
    containerItemId: getFormString(formData, "containerItemId"),
    quantity: getFormString(formData, "quantity"),
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () =>
    updateContainerItemQuantity({
      userId: user.id,
      householdId: scope.householdId,
      containerItemId: parsed.containerItemId,
      quantity: parsed.quantity,
    }),
  );

  revalidatePath(boxPath(scope.locale, scope.boxId));
}

export async function removeBoxItemFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = boxScopeSchema.parse(scopeInput);
  const parsed = removeBoxItemSchema.parse({
    containerItemId: getFormString(formData, "containerItemId"),
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () =>
    deleteContainerItem({
      userId: user.id,
      householdId: scope.householdId,
      containerItemId: parsed.containerItemId,
    }),
  );

  revalidatePath(boxPath(scope.locale, scope.boxId));
}

export async function deleteBoxFormAction(scopeInput: unknown) {
  const scope = boxRoomScopeSchema.parse(scopeInput);
  const user = await requireSessionUser();

  await withRlsUserContext(user.id, async () =>
    deleteContainer({
      userId: user.id,
      householdId: scope.householdId,
      containerId: scope.boxId,
    }),
  );

  redirect(`/${scope.locale}/rooms/${scope.roomId}`);
}
