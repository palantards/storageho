"use server";

import { z } from "zod";

import { requireSessionUser } from "@/lib/inventory/auth";
import { requireHouseholdWriteAccess } from "@/lib/inventory/guards";
import {
  createHouseholdFloor,
  createContainerFromSetupFlow,
  createRoomFromSetupFlow,
  deleteHouseholdFloor,
  updateHouseholdFloor,
} from "@/lib/inventory/service";
import {
  householdFloorSchema,
  householdFloorUpdateSchema,
  createRoomFromSetupSchema,
  createContainerFromSetupSchema,
} from "@/lib/inventory/validation";
import {
  type ActionFail,
  type ActionOk,
  zodToFieldErrors,
} from "@/lib/forms/action-result";
import { withRlsUserContext } from "@/server/db/tenant";

const floorDeleteSchema = z.object({
  householdId: z.string().uuid(),
  floorId: z.string().uuid(),
});

export async function createFloorAction(input: unknown) {
  const parsed = householdFloorSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid floor payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["name"] as const),
    } satisfies ActionFail<"name">;
  }
  try {
    const user = await requireSessionUser();
    const floor = await withRlsUserContext(user.id, async () => {
      await requireHouseholdWriteAccess(user.id, parsed.data.householdId);
      return createHouseholdFloor({
        userId: user.id,
        householdId: parsed.data.householdId,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder,
      });
    });
    return { ok: true as const, floor } satisfies ActionOk<{ floor: typeof floor }>;
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to create floor" } satisfies ActionFail;
  }
}

export async function updateFloorAction(input: unknown) {
  const parsed = householdFloorUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid floor payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["name"] as const),
    } satisfies ActionFail<"name">;
  }
  try {
    const user = await requireSessionUser();
    const floor = await withRlsUserContext(user.id, async () => {
      await requireHouseholdWriteAccess(user.id, parsed.data.householdId);
      return updateHouseholdFloor({
        userId: user.id,
        householdId: parsed.data.householdId,
        floorId: parsed.data.floorId,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder,
      });
    });
    return { ok: true as const, floor } satisfies ActionOk<{ floor: typeof floor }>;
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to update floor" } satisfies ActionFail;
  }
}

export async function deleteFloorAction(input: unknown) {
  const parsed = floorDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid delete payload" } satisfies ActionFail;
  }
  try {
    const user = await requireSessionUser();
    const floor = await withRlsUserContext(user.id, async () => {
      await requireHouseholdWriteAccess(user.id, parsed.data.householdId);
      return deleteHouseholdFloor({
        userId: user.id,
        householdId: parsed.data.householdId,
        floorId: parsed.data.floorId,
      });
    });
    return { ok: true as const, floor } satisfies ActionOk<{ floor: typeof floor }>;
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to delete floor" } satisfies ActionFail;
  }
}

export async function createSetupRoomAction(input: unknown) {
  const parsed = createRoomFromSetupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid room payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["name"] as const),
    } satisfies ActionFail<"name">;
  }
  try {
    const user = await requireSessionUser();
    const result = await withRlsUserContext(user.id, async () => {
      await requireHouseholdWriteAccess(user.id, parsed.data.householdId);
      return createRoomFromSetupFlow({
        userId: user.id,
        householdId: parsed.data.householdId,
        floorId: parsed.data.floorId,
        name: parsed.data.name,
        description: parsed.data.description,
      });
    });
    return { ok: true as const, ...result } satisfies ActionOk<typeof result>;
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to create room" } satisfies ActionFail;
  }
}

export async function createSetupContainerAction(input: unknown) {
  const parsed = createContainerFromSetupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid container payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["name"] as const),
    } satisfies ActionFail<"name">;
  }
  try {
    const user = await requireSessionUser();
    const result = await withRlsUserContext(user.id, async () => {
      await requireHouseholdWriteAccess(user.id, parsed.data.householdId);
      return createContainerFromSetupFlow({
        userId: user.id,
        householdId: parsed.data.householdId,
        floorId: parsed.data.floorId,
        roomId: parsed.data.roomId ?? null,
        name: parsed.data.name,
        code: parsed.data.code,
        description: parsed.data.description,
      });
    });
    return { ok: true as const, ...result } satisfies ActionOk<typeof result>;
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to create container" } satisfies ActionFail;
  }
}

