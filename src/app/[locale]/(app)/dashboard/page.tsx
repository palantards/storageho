import Link from "next/link";
import { redirect } from "next/navigation";
import { Map, Package, QrCode, Settings } from "lucide-react";

import { ActivityFeed } from "@/components/inventory/ActivityFeed";
import { PageFrame } from "@/components/inventory/PageFrame";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { StatCard } from "@/components/inventory/StatCard";
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
          <Link
            href={`/${locale}/households/${householdId}/canvas`}
            className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-1 hover:ring-primary/20"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-primary">
              <Map className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Household canvas</div>
              <div className="text-xs text-muted-foreground">Map floors, rooms and boxes</div>
            </div>
          </Link>
          <Link
            href={`/${locale}/scan`}
            className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-1 hover:ring-primary/20"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Scan mode</div>
              <div className="text-xs text-muted-foreground">Scan box QR and quick-add items</div>
            </div>
          </Link>
          <Link
            href={`/${locale}/items`}
            className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-1 hover:ring-primary/20"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Items library</div>
              <div className="text-xs text-muted-foreground">Browse and manage all items</div>
            </div>
          </Link>
          <Link
            href={`/${locale}/households/${householdId}/settings`}
            className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-1 hover:ring-primary/20"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Household settings</div>
              <div className="text-xs text-muted-foreground">Members, usage and options</div>
            </div>
          </Link>
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
