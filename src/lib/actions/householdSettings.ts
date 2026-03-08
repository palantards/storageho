"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  type ActionFail,
  type ActionOk,
  zodToFieldErrors,
} from "@/lib/forms/action-result";
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
  const scope = householdSettingsScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = updateHouseholdLanguageSchema.safeParse({
    householdId: scope.data.householdId,
    language: getFormString(formData, "language") || "en",
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid household language payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["language"] as const),
    } satisfies ActionFail<"language">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      updateHouseholdLanguage({
        userId: user.id,
        householdId: parsed.data.householdId,
        language: parsed.data.language,
      }),
    );
  } catch (error) {
    console.error("Failed to update household language", error);
    return {
      ok: false as const,
      error: "Unable to update household language",
    } satisfies ActionFail;
  }

  revalidatePath(settingsPath(scope.data.locale, scope.data.householdId));
  return { ok: true as const } satisfies ActionOk;
}

export async function inviteHouseholdMemberFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = householdSettingsScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = inviteMemberSchema.safeParse({
    householdId: scope.data.householdId,
    email: getFormString(formData, "email"),
    role: getFormString(formData, "role") || "viewer",
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid invite payload",
      fieldErrors: zodToFieldErrors(parsed.error, ["email", "role"] as const),
    } satisfies ActionFail<"email" | "role">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      inviteMember({
        userId: user.id,
        householdId: parsed.data.householdId,
        email: parsed.data.email,
        role: parsed.data.role,
      }),
    );
  } catch (error) {
    console.error("Failed to invite household member", error);
    return { ok: false as const, error: "Unable to invite member" } satisfies ActionFail;
  }

  revalidatePath(settingsPath(scope.data.locale, scope.data.householdId));
  return { ok: true as const } satisfies ActionOk;
}

export async function updateHouseholdMemberFormAction(
  scopeInput: unknown,
  formData: FormData,
) {
  const scope = householdSettingsScopeSchema.safeParse(scopeInput);
  if (!scope.success) {
    return { ok: false as const, error: "Invalid request context" } satisfies ActionFail;
  }

  const parsed = updateMemberRoleSchema.safeParse({
    householdId: scope.data.householdId,
    memberId: getFormString(formData, "memberId"),
    role: getFormString(formData, "role") || "member",
    status: getFormString(formData, "status") || "active",
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid member update payload",
      fieldErrors: zodToFieldErrors(
        parsed.error,
        ["memberId", "role", "status"] as const,
      ),
    } satisfies ActionFail<"memberId" | "role" | "status">;
  }

  try {
    const user = await requireSessionUser();
    await withRlsUserContext(user.id, async () =>
      updateMemberRole({
        userId: user.id,
        householdId: parsed.data.householdId,
        memberId: parsed.data.memberId,
        role: parsed.data.role,
        status: parsed.data.status,
      }),
    );
  } catch (error) {
    console.error("Failed to update household member", error);
    return {
      ok: false as const,
      error: "Unable to update household member",
    } satisfies ActionFail;
  }

  revalidatePath(settingsPath(scope.data.locale, scope.data.householdId));
  return { ok: true as const } satisfies ActionOk;
}
