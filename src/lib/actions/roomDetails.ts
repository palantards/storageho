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
  const scope = roomScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = createContainerSchema.safeParse({
    householdId: scope.data.householdId,
    roomId: scope.data.roomId,
    parentContainerId:
      getFormString(formData, "parentContainerId") === "__root__"
        ? null
        : getFormNullableString(formData, "parentContainerId"),
    name: getFormString(formData, "name"),
    code: getFormOptionalString(formData, "code"),
    description: getFormOptionalString(formData, "description"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid container payload",
      fieldErrors: zodToFieldErrors(
        parsed.error,
        ["parentContainerId", "name", "code", "description"] as const,
      ),
    } satisfies ActionFail<
      "parentContainerId" | "name" | "code" | "description"
    >;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      createContainer({
        userId: user.id,
        householdId: parsed.data.householdId,
        roomId: parsed.data.roomId,
        parentContainerId: parsed.data.parentContainerId,
        name: parsed.data.name,
        code: parsed.data.code,
        description: parsed.data.description,
      }),
    );
  } catch (error) {
    console.error("Failed to create room container", error);
    return { ok: false as const, error: "Unable to create container" } satisfies ActionFail;
  }

  revalidatePath(roomPath(scope.data.locale, scope.data.roomId));
  return { ok: true as const } satisfies ActionOk;
}

export async function bulkCreateRoomPathsFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = roomScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = bulkRoomPathsSchema.safeParse({
    rootParentContainerId:
      getFormString(formData, "rootParentContainerId") === "__root__"
        ? null
        : getFormNullableString(formData, "rootParentContainerId"),
    paths: getFormString(formData, "paths"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid container path payload",
      fieldErrors: zodToFieldErrors(
        parsed.error,
        ["rootParentContainerId", "paths"] as const,
      ),
    } satisfies ActionFail<"rootParentContainerId" | "paths">;
  }

  const pathInputs: z.infer<typeof createContainerPathSchema>[] = [];
  for (const path of parsed.data.paths) {
    const pathInput = createContainerPathSchema.safeParse({
      householdId: scope.data.householdId,
      roomId: scope.data.roomId,
      rootParentContainerId: parsed.data.rootParentContainerId ?? null,
      path,
    });

    if (!pathInput.success) {
      return {
        ok: false as const,
        error: "Invalid container path payload",
        fieldErrors: { paths: pathInput.error.issues[0]?.message ?? "Invalid path" },
      } satisfies ActionFail<"paths">;
    }

    pathInputs.push(pathInput.data);
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () => {
      for (const pathInput of pathInputs) {
        await createContainerPathInRoom({
          userId: user.id,
          householdId: pathInput.householdId,
          roomId: pathInput.roomId,
          rootParentContainerId: pathInput.rootParentContainerId ?? null,
          path: pathInput.path,
        });
      }
    });
  } catch (error) {
    console.error("Failed to bulk create room paths", error);
    return {
      ok: false as const,
      error: "Unable to create container paths",
    } satisfies ActionFail;
  }

  revalidatePath(roomPath(scope.data.locale, scope.data.roomId));
  return { ok: true as const } satisfies ActionOk;
}

export async function setRoomContainerArchivedFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = roomScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = z
    .object({
      archived: z.union([z.literal("0"), z.literal("1")]).transform((value) => value === "1"),
    })
    .merge(deleteEntitySchema)
    .safeParse({
      householdId: scope.data.householdId,
      id: getFormString(formData, "containerId"),
      archived: getFormString(formData, "archived"),
    });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid archive payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["id", "archived"] as const),
    } satisfies ActionFail<"id" | "archived">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      setContainerArchived({
        userId: user.id,
        householdId: parsed.data.householdId,
        containerId: parsed.data.id,
        archived: parsed.data.archived,
      }),
    );
  } catch (error) {
    console.error("Failed to archive room container", error);
    return {
      ok: false as const,
      error: "Unable to update container archive state",
    } satisfies ActionFail;
  }

  revalidatePath(roomPath(scope.data.locale, scope.data.roomId));
  return { ok: true as const } satisfies ActionOk;
}

export async function deleteRoomContainerFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = roomScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = deleteEntitySchema.safeParse({
    householdId: scope.data.householdId,
    id: getFormString(formData, "containerId"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid delete payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["id"] as const),
    } satisfies ActionFail<"id">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      deleteContainer({
        userId: user.id,
        householdId: parsed.data.householdId,
        containerId: parsed.data.id,
      }),
    );
  } catch (error) {
    console.error("Failed to delete room container", error);
    return { ok: false as const, error: "Unable to delete container" } satisfies ActionFail;
  }

  revalidatePath(roomPath(scope.data.locale, scope.data.roomId));
  return { ok: true as const } satisfies ActionOk;
}

export async function deleteRoomFormAction(scopeInput: unknown) {
  const scope = roomDeleteScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      deleteRoom({
        userId: user.id,
        householdId: scope.data.householdId,
        roomId: scope.data.roomId,
      }),
    );
  } catch (error) {
    console.error("Failed to delete room", error);
    return { ok: false as const, error: "Unable to delete room" } satisfies ActionFail;
  }

  redirect(`/${scope.data.locale}/households/${scope.data.canvasHouseholdId}/canvas`);
  return { ok: true as const } satisfies ActionOk;
}
