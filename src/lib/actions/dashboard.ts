"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  type ActionFail,
  type ActionOk,
  zodToFieldErrors,
} from "@/lib/forms/action-result";
import { requireSessionUser } from "@/lib/inventory/auth";
import {
  createHousehold,
  setActiveHousehold,
} from "@/lib/inventory/service";
import { createHouseholdSchema } from "@/lib/inventory/validation";
import { getFormString } from "@/lib/forms/form-data";
import { withRlsUserContext } from "@/server/db/tenant";

const dashboardScopeSchema = z.object({
  locale: z.string().trim().min(2).max(10),
});

export async function createHouseholdFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = dashboardScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = createHouseholdSchema.safeParse({
    name: getFormString(formData, "name"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid household payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["name"] as const),
    } satisfies ActionFail<"name">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () => {
      const household = await createHousehold({
        userId: user.id,
        name: parsed.data.name,
        language: scope.data.locale,
      });

      await setActiveHousehold(user.id, household.id);
    });
  } catch (error) {
    console.error("Failed to create household", error);
    return { ok: false as const, error: "Unable to create household" } satisfies ActionFail;
  }

  redirect(`/${scope.data.locale}/dashboard`);
  return { ok: true as const } satisfies ActionOk;
}
