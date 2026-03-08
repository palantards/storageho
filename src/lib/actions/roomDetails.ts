"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSessionUser } from "@/lib/inventory/auth";
import {
  createContainer,
  createContainerPathInRoom,
  deleteContainer,
  deleteRoom,
  setContainerArchived,
} from "@/lib/inventory/service";
import {
  createContainerPathSchema,
  createContainerSchema,
  deleteEntitySchema,
} from "@/lib/inventory/validation";
import {
  getFormNullableString,
  getFormOptionalString,
  getFormString,
} from "@/lib/forms/form-data";
import { withRlsUserContext } from "@/server/db/tenant";

const roomScopeSchema = z.object({
  locale: z.string().trim().min(2).max(10),
  householdId: z.string().uuid(),
  roomId: z.string().uuid(),
});

const roomDeleteScopeSchema = roomScopeSchema.extend({
  canvasHouseholdId: z.string().uuid(),
});

const bulkRoomPathsSchema = z.object({
  rootParentContainerId: z.string().uuid().nullable().optional(),
  paths: z
    .string()
    .transform((raw) =>
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 80),
    )
    .refine((lines) => lines.length > 0, "Add at least one path line"),
});

function roomPath(locale: string, roomId: string) {
  return `/${locale}/rooms/${roomId}`;
}

export async function createRoomContainerFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = roomScopeSchema.parse(scopeInput);
  const parsed = createContainerSchema.parse({
    householdId: scope.householdId,
    roomId: scope.roomId,
    parentContainerId:
      getFormString(formData, "parentContainerId") === "__root__"
        ? null
        : getFormNullableString(formData, "parentContainerId"),
    name: getFormString(formData, "name"),
    code: getFormOptionalString(formData, "code"),
    description: getFormOptionalString(formData, "description"),
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () =>
    createContainer({
      userId: user.id,
      householdId: parsed.householdId,
      roomId: parsed.roomId,
      parentContainerId: parsed.parentContainerId,
      name: parsed.name,
      code: parsed.code,
      description: parsed.description,
    }),
  );

  revalidatePath(roomPath(scope.locale, scope.roomId));
}

export async function bulkCreateRoomPathsFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = roomScopeSchema.parse(scopeInput);
  const parsed = bulkRoomPathsSchema.parse({
    rootParentContainerId:
      getFormString(formData, "rootParentContainerId") === "__root__"
        ? null
        : getFormNullableString(formData, "rootParentContainerId"),
    paths: getFormString(formData, "paths"),
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () => {
    for (const path of parsed.paths) {
      const pathInput = createContainerPathSchema.parse({
        householdId: scope.householdId,
        roomId: scope.roomId,
        rootParentContainerId: parsed.rootParentContainerId ?? null,
        path,
      });

      await createContainerPathInRoom({
        userId: user.id,
        householdId: pathInput.householdId,
        roomId: pathInput.roomId,
        rootParentContainerId: pathInput.rootParentContainerId ?? null,
        path: pathInput.path,
      });
    }
  });

  revalidatePath(roomPath(scope.locale, scope.roomId));
}

export async function setRoomContainerArchivedFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = roomScopeSchema.parse(scopeInput);
  const parsed = z
    .object({
      archived: z.union([z.literal("0"), z.literal("1")]).transform((value) => value === "1"),
    })
    .merge(deleteEntitySchema)
    .parse({
      householdId: scope.householdId,
      id: getFormString(formData, "containerId"),
      archived: getFormString(formData, "archived"),
    });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () =>
    setContainerArchived({
      userId: user.id,
      householdId: parsed.householdId,
      containerId: parsed.id,
      archived: parsed.archived,
    }),
  );

  revalidatePath(roomPath(scope.locale, scope.roomId));
}

export async function deleteRoomContainerFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = roomScopeSchema.parse(scopeInput);
  const parsed = deleteEntitySchema.parse({
    householdId: scope.householdId,
    id: getFormString(formData, "containerId"),
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () =>
    deleteContainer({
      userId: user.id,
      householdId: parsed.householdId,
      containerId: parsed.id,
    }),
  );

  revalidatePath(roomPath(scope.locale, scope.roomId));
}

export async function deleteRoomFormAction(scopeInput: unknown) {
  const scope = roomDeleteScopeSchema.parse(scopeInput);
  const user = await requireSessionUser();

  await withRlsUserContext(user.id, async () =>
    deleteRoom({
      userId: user.id,
      householdId: scope.householdId,
      roomId: scope.roomId,
    }),
  );

  redirect(`/${scope.locale}/households/${scope.canvasHouseholdId}/canvas`);
}
