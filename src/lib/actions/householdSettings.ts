"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSessionUser } from "@/lib/inventory/auth";
import {
  inviteMember,
  updateHouseholdLanguage,
  updateMemberRole,
} from "@/lib/inventory/service";
import {
  inviteMemberSchema,
  updateHouseholdLanguageSchema,
  updateMemberRoleSchema,
} from "@/lib/inventory/validation";
import { getFormString } from "@/lib/forms/form-data";
import { withRlsUserContext } from "@/server/db/tenant";

const householdSettingsScopeSchema = z.object({
  locale: z.string().trim().min(2).max(10),
  householdId: z.string().uuid(),
});

function settingsPath(locale: string, householdId: string) {
  return `/${locale}/households/${householdId}/settings`;
}

export async function updateHouseholdLanguageFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = householdSettingsScopeSchema.parse(scopeInput);
  const parsed = updateHouseholdLanguageSchema.parse({
    householdId: scope.householdId,
    language: getFormString(formData, "language") || "en",
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () =>
    updateHouseholdLanguage({
      userId: user.id,
      householdId: parsed.householdId,
      language: parsed.language,
    }),
  );

  revalidatePath(settingsPath(scope.locale, scope.householdId));
}

export async function inviteHouseholdMemberFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = householdSettingsScopeSchema.parse(scopeInput);
  const parsed = inviteMemberSchema.parse({
    householdId: scope.householdId,
    email: getFormString(formData, "email"),
    role: getFormString(formData, "role") || "viewer",
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () =>
    inviteMember({
      userId: user.id,
      householdId: parsed.householdId,
      email: parsed.email,
      role: parsed.role,
    }),
  );

  revalidatePath(settingsPath(scope.locale, scope.householdId));
}

export async function updateHouseholdMemberFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = householdSettingsScopeSchema.parse(scopeInput);
  const parsed = updateMemberRoleSchema.parse({
    householdId: scope.householdId,
    memberId: getFormString(formData, "memberId"),
    role: getFormString(formData, "role") || "member",
    status: getFormString(formData, "status") || "active",
  });

  const user = await requireSessionUser();
  await withRlsUserContext(user.id, async () =>
    updateMemberRole({
      userId: user.id,
      householdId: parsed.householdId,
      memberId: parsed.memberId,
      role: parsed.role,
      status: parsed.status,
    }),
  );

  revalidatePath(settingsPath(scope.locale, scope.householdId));
}
