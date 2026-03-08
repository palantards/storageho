import Link from "next/link";
import { redirect } from "next/navigation";

import { ActivityFeed } from "@/components/inventory/ActivityFeed";
import { PageFrame } from "@/components/inventory/PageFrame";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { createHouseholdFormAction } from "@/lib/actions/dashboard";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  getUsageHints,
  listActivity,
} from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const context = await getInventoryContext(locale);
  const userId = context.user.id;
  const active = context.activeMembership;
  const createHouseholdAction = createHouseholdFormAction.bind(null, { locale });

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Dashboard</div>
          <div className="text-sm text-muted-foreground">
            Track your household inventory at a glance.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={`/${locale}/onboarding`}>New household</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Containers", value: usage.containers },
          { label: "Items", value: usage.items },
          { label: "Photos", value: usage.photos },
          { label: "Rooms", value: usage.rooms ?? 0 },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border bg-gradient-to-br from-muted/40 to-muted p-4 shadow-sm"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {metric.label}
            </div>
            <div className="text-2xl font-semibold">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <SectionDivider title="Household" />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/${locale}/households/${householdId}/canvas`}>
              Household canvas
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/households/${householdId}/settings`}>
              Household settings
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/items`}>Items library</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/scan`}>Scan mode</Link>
          </Button>
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
