import "server-only";

import { cache } from "react";

import type { Locale } from "@/i18n/config";
import { requireSessionUser } from "@/lib/inventory/auth";
import {
  getActiveMembershipContext,
  claimPendingInvitesForUser,
} from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

export const getInventoryContext = cache(async (locale: Locale) => {
  const user = await requireSessionUser(locale);

  const context = await withRlsUserContext(user.id, async () => {
    await claimPendingInvitesForUser({
      userId: user.id,
      email: user.email,
    });

    return getActiveMembershipContext(user.id);
  });

  return {
    user,
    memberships: context.memberships,
    activeMembership: context.active,
    preferences: context.preferences,
  };
});

