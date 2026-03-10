import Link from "next/link";
import { Map, Package, QrCode, Settings } from "lucide-react";

import { ActivityFeed } from "@/components/inventory/ActivityFeed";
import { CreateHouseholdForm } from "@/components/inventory/CreateHouseholdForm";
import { PageFrame } from "@/components/inventory/PageFrame";
import { PageHeader } from "@/components/inventory/PageHeader";
import { QuickAccessCard } from "@/components/inventory/QuickAccessCard";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { StatCard } from "@/components/inventory/StatCard";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { createHouseholdFormAction } from "@/lib/actions/dashboard";
import { getInventoryShellContext } from "@/lib/inventory/page-context";
import { getDashboardOverview } from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const context = await getInventoryShellContext(locale);
  const userId = context.user.id;
  const active = context.activeMembership;

  async function createHouseholdAction(
    _prev: { ok?: boolean; error?: string; fieldErrors?: { name?: string } },
    formData: FormData,
  ) {
    "use server";
    return createHouseholdFormAction({ locale }, formData);
  }

  if (!active) {
    return (
      <PageFrame className="max-w-xl space-y-4">
        <div className="space-y-1">
          <div className="text-2xl font-semibold">
            Create your first household
          </div>
          <div className="text-sm text-muted-foreground">
            Household is your shared workspace for home + storage inventory.
          </div>
        </div>
        <CreateHouseholdForm action={createHouseholdAction} />
      </PageFrame>
    );
  }

  const householdId = active.household.id;

  const { activity, usage } = await withRlsUserContext(userId, async () =>
    getDashboardOverview({
      userId,
      householdId,
      activityLimit: 12,
    }),
  );

  return (
    <PageFrame className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Track your household inventory at a glance."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/${locale}/onboarding`}>New household</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Containers"
          value={usage.containers}
          href={`/${locale}/households/${householdId}/canvas`}
        />
        <StatCard label="Items" value={usage.items} href={`/${locale}/items`} />
        <StatCard label="Photos" value={usage.photos} />
        <StatCard
          label="Rooms"
          value={usage.rooms ?? 0}
          href={`/${locale}/households/${householdId}/canvas`}
        />
      </div>

      <div className="space-y-3">
        <SectionDivider title="Quick access" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAccessCard
            href={`/${locale}/households/${householdId}/canvas`}
            icon={<Map className="h-5 w-5" />}
            title="Household canvas"
            description="Map floors, rooms and boxes"
          />
          <QuickAccessCard
            href={`/${locale}/scan`}
            icon={<QrCode className="h-5 w-5" />}
            title="Scan mode"
            description="Scan box QR and quick-add items"
          />
          <QuickAccessCard
            href={`/${locale}/items`}
            icon={<Package className="h-5 w-5" />}
            title="Items library"
            description="Browse and manage all items"
          />
          <QuickAccessCard
            href={`/${locale}/households/${householdId}/settings`}
            icon={<Settings className="h-5 w-5" />}
            title="Household settings"
            description="Members, usage and options"
          />
        </div>
      </div>

      <div className="space-y-2">
        <SectionDivider title="Recent activity" />
        <ActivityFeed
          items={activity.map((row) => ({
            activity: {
              ...row.activity,
              metadata: (row.activity.metadata ?? {}) as Record<
                string,
                unknown
              >,
            },
            profile: row.profile,
          }))}
          locale={locale}
        />
      </div>
    </PageFrame>
  );
}
