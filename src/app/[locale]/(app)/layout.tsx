import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/shell/AppShell";
import { getActiveMembershipContext } from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "sv" ? "sv" : ("en" as Locale);
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  if (!session.user) redirect(`/${locale}/login`);

  const membershipContext = await withRlsUserContext(session.user.id, async () =>
    getActiveMembershipContext(session.user.id),
  );

  return (
    <AppShell
      locale={locale}
      user={{
        ...session.user,
        name: session.user.name || "",
      }}
      activeHouseholdId={membershipContext.active?.household.id}
      householdMemberships={membershipContext.memberships.map((entry) => ({
        householdId: entry.household.id,
        householdName: entry.household.name,
        role: entry.membership.role,
      }))}
    >
      {children}
    </AppShell>
  );
}
