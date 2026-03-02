import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  createFloor,
  createHousehold,
  getUsageHints,
  listActivity,
  listFloors,
  setActiveHousehold,
} from "@/lib/inventory/service";
import { createHouseholdSchema, createLocationSchema } from "@/lib/inventory/validation";
import { ActivityFeed } from "@/components/inventory/ActivityFeed";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const context = await getInventoryContext(locale);
  const active = context.activeMembership;

  async function createHouseholdAction(formData: FormData) {
    "use server";

    const parsed = createHouseholdSchema.parse({
      name: String(formData.get("name") || ""),
    });

    const household = await createHousehold({
      userId: context.user.id,
      name: parsed.name,
      language: locale,
    });

    await setActiveHousehold(context.user.id, household.id);
    redirect(`/${locale}/dashboard`);
  }

  if (!active) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Create your first household</CardTitle>
          <CardDescription>
            Household is your shared workspace for home + storage inventory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createHouseholdAction} className="grid gap-3">
            <Label htmlFor="name">Household name</Label>
            <Input id="name" name="name" placeholder="Home" required />
            <Button type="submit" className="w-fit">
              Create household
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const householdId = active.household.id;

  async function quickFloorAction(formData: FormData) {
    "use server";

    const parsed = createLocationSchema.parse({
      householdId,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
    });

    await createFloor({
      userId: context.user.id,
      householdId: parsed.householdId,
      name: parsed.name,
      description: parsed.description,
    });

    revalidatePath(`/${locale}/dashboard`);
    revalidatePath(`/${locale}/households/${householdId}/canvas`);
  }

  const [activity, usage, floors] = await Promise.all([
    listActivity({ userId: context.user.id, householdId, limit: 12 }),
    getUsageHints({ userId: context.user.id, householdId }),
    listFloors({ userId: context.user.id, householdId }),
  ]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Containers</CardDescription>
            <CardTitle>{usage.containers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Items</CardDescription>
            <CardTitle>{usage.items}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Photos</CardDescription>
            <CardTitle>{usage.photos}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated storage</CardDescription>
            <CardTitle>{usage.estimatedStorageMb} MB</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Quick Add Floor</CardTitle>
            <CardDescription>
              Create floors like Basement, Floor 1, Floor 2, Attic.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={quickFloorAction} className="grid gap-3">
              <Input name="name" placeholder="Floor 1" required />
              <Input name="description" placeholder="Optional description" />
              <Button type="submit" className="w-fit">
                Add floor
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Inventory</CardTitle>
            <CardDescription>
              Fastest flow on mobile: Scan Mode. For setup, use Onboarding + map.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/${locale}/scan`}>Scan Mode</Link>
            </Button>
            <Button asChild>
              <Link href={`/${locale}/canvas`}>Household Canvas</Link>
            </Button>
            <Button asChild>
              <Link href={`/${locale}/onboarding`}>Onboarding Wizard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${locale}/items`}>Item Library</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${locale}/import`}>Import CSV</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${locale}/export`}>Export CSV</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${locale}/households/${householdId}/settings`}>
                Household Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Latest create/move/photo/invite events in this household.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityFeed
            items={activity.map((entry) => ({
              id: entry.activity.id,
              actionType: entry.activity.actionType,
              entityType: entry.activity.entityType,
              entityId: entry.activity.entityId,
              metadata: entry.activity.metadata as Record<string, unknown>,
              createdAt: entry.activity.createdAt,
              actorName:
                entry.profile?.displayName ||
                entry.profile?.name ||
                context.user.email,
            }))}
            locale={locale}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Floors in this household</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {floors.length === 0 ? (
            <div className="text-sm text-muted-foreground">No floors yet.</div>
          ) : (
            floors.map((row) => (
              <div
                key={row.location.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <div className="font-medium">{row.location.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.roomCount} rooms
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/${locale}/households/${householdId}/canvas`}>Open</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
