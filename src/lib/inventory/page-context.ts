import "server-only";

import { cache } from "react";

import type { Locale } from "@/i18n/config";
import { requireSessionUser } from "@/lib/inventory/auth";
import {
  getActiveMembershipContext,
  getUserPreferences,
} from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

export const getInventoryShellContext = cache(async (locale: Locale) => {
  const user = await requireSessionUser(locale);

  const context = await withRlsUserContext(user.id, async () => {
    return getActiveMembershipContext(user.id, {
      includePreferences: false,
    });
  });

  return {
    user,
    memberships: context.memberships,
    activeMembership: context.active,
  };
});

export const getInventoryContext = cache(async (locale: Locale) => {
  const context = await getInventoryShellContext(locale);

  return {
    ...context,
    preferences: await withRlsUserContext(context.user.id, async () =>
      getUserPreferences(context.user.id),
    ),
  };
});

