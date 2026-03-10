import Link from "next/link";
import { redirect } from "next/navigation";
import { Map, Package, QrCode, Settings } from "lucide-react";

import { ActivityFeed } from "@/components/inventory/ActivityFeed";
import { PageFrame } from "@/components/inventory/PageFrame";
import { PageHeader } from "@/components/inventory/PageHeader";
import { QuickAccessCard } from "@/components/inventory/QuickAccessCard";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { StatCard } from "@/components/inventory/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { createHouseholdFormAction } from "@/lib/actions/dashboard";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { getUsageHints, listActivity } from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";
import { Logo } from "@/components/brand/Logo";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const context = await getInventoryContext(locale);
  const userId = context.user.id;
  const active = context.activeMembership;
  const createHouseholdAction = createHouseholdFormAction.bind(null, {
    locale,
  }) as unknown as (formData: FormData) => Promise<void>;

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
        <form action={createHouseholdAction} className="grid gap-3">
          <Label htmlFor="name">Household name</Label>
          <Input id="name" name="name" placeholder="Home" required />
          <Button type="submit" className="w-fit">
            Create household
          </Button>
        </form>
      </PageFrame>
    );
  }

  const householdId = active.household.id;

  const [activity, usage] = await withRlsUserContext(userId, async () =>
    Promise.all([
      listActivity({ userId, householdId, limit: 12 }),
      getUsageHints({ userId, householdId }),
    ]),
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
