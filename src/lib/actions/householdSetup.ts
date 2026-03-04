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

const floorDeleteSchema = z.object({
  householdId: z.string().uuid(),
  floorId: z.string().uuid(),
});

export async function createFloorAction(input: unknown) {
  const parsed = householdFloorSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid floor payload" };
  try {
    const user = await requireSessionUser();
    await requireHouseholdWriteAccess(user.id, parsed.data.householdId);
    const floor = await createHouseholdFloor({
      userId: user.id,
      householdId: parsed.data.householdId,
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
    });
    return { ok: true as const, floor };
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to create floor" };
  }
}

export async function updateFloorAction(input: unknown) {
  const parsed = householdFloorUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid floor payload" };
  try {
    const user = await requireSessionUser();
    await requireHouseholdWriteAccess(user.id, parsed.data.householdId);
    const floor = await updateHouseholdFloor({
      userId: user.id,
      householdId: parsed.data.householdId,
      floorId: parsed.data.floorId,
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
    });
    return { ok: true as const, floor };
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to update floor" };
  }
}

export async function deleteFloorAction(input: unknown) {
  const parsed = floorDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid delete payload" };
  try {
    const user = await requireSessionUser();
    await requireHouseholdWriteAccess(user.id, parsed.data.householdId);
    const floor = await deleteHouseholdFloor({
      userId: user.id,
      householdId: parsed.data.householdId,
      floorId: parsed.data.floorId,
    });
    return { ok: true as const, floor };
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to delete floor" };
  }
}

export async function createSetupRoomAction(input: unknown) {
  const parsed = createRoomFromSetupSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid room payload" };
  try {
    const user = await requireSessionUser();
    await requireHouseholdWriteAccess(user.id, parsed.data.householdId);
    const result = await createRoomFromSetupFlow({
      userId: user.id,
      householdId: parsed.data.householdId,
      floorId: parsed.data.floorId,
      name: parsed.data.name,
      description: parsed.data.description,
    });
    return { ok: true as const, ...result };
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to create room" };
  }
}

export async function createSetupContainerAction(input: unknown) {
  const parsed = createContainerFromSetupSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid container payload" };
  try {
    const user = await requireSessionUser();
    await requireHouseholdWriteAccess(user.id, parsed.data.householdId);
    const result = await createContainerFromSetupFlow({
      userId: user.id,
      householdId: parsed.data.householdId,
      floorId: parsed.data.floorId,
      roomId: parsed.data.roomId ?? null,
      name: parsed.data.name,
      code: parsed.data.code,
      description: parsed.data.description,
    });
    return { ok: true as const, ...result };
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to create container" };
  }
}

