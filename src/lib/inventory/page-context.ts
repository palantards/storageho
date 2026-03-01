import "server-only";

import type { Locale } from "@/i18n/config";
import { requireSessionUser } from "@/lib/inventory/auth";
import {
  getActiveMembershipContext,
  claimPendingInvitesForUser,
} from "@/lib/inventory/service";

export async function getInventoryContext(locale: Locale) {
  const user = await requireSessionUser(locale);

  await claimPendingInvitesForUser({
    userId: user.id,
    email: user.email,
  });

  const context = await getActiveMembershipContext(user.id);

  return {
    user,
    memberships: context.memberships,
    activeMembership: context.active,
    preferences: context.preferences,
  };
}
