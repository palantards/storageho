"use server";

import { z } from "zod";

import { requireSessionUser } from "@/lib/inventory/auth";
import { setActiveHousehold } from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

const setActiveHouseholdSchema = z.object({
  householdId: z.string().uuid(),
});

export async function setActiveHouseholdAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = setActiveHouseholdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid household id" };
  }
  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () => {
      await setActiveHousehold(user.id, parsed.data.householdId);
    });
    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Unable to set household" };
  }
}
