"use server";

import { z } from "zod";

import { requireSessionUser } from "@/lib/inventory/auth";
import {
  setActiveLocationPreference,
  setActiveRoomPreference,
} from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

const preferenceSchema = z.object({
  householdId: z.string().uuid(),
  locationId: z.string().uuid().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
});

export async function setActivePreferenceAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = preferenceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid preference payload" };
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () => {
      if (parsed.data.roomId !== undefined) {
        await setActiveRoomPreference({
          userId: user.id,
          householdId: parsed.data.householdId,
          roomId: parsed.data.roomId ?? null,
        });
      } else {
        await setActiveLocationPreference({
          userId: user.id,
          householdId: parsed.data.householdId,
          locationId: parsed.data.locationId ?? null,
        });
      }
    });

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Unable to update preference" };
  }
}
