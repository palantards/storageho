import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { AppShell } from "@/components/shell/AppShell";
import { getInventoryShellContext } from "@/lib/inventory/page-context";

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
  const context = await getInventoryShellContext(locale);
  if (!context.user) redirect(`/${locale}/login`);

  return (
    <AppShell
      locale={locale}
      user={{
        ...context.user,
        name: context.user.name || "",
      }}
      activeHouseholdId={context.activeMembership?.household.id}
      householdMemberships={context.memberships.map((entry) => ({
        householdId: entry.household.id,
        householdName: entry.household.name,
        role: entry.membership.role,
      }))}
    >
      {children}
    </AppShell>
  );
}
