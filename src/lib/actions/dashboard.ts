"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

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
  const scope = dashboardScopeSchema.parse(scopeInput);
  const parsed = createHouseholdSchema.parse({
    name: getFormString(formData, "name"),
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () => {
    const household = await createHousehold({
      userId: user.id,
      name: parsed.name,
      language: scope.locale,
    });

    await setActiveHousehold(user.id, household.id);
  });

  redirect(`/${scope.locale}/dashboard`);
}
