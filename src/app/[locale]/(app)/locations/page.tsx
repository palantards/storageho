import Link from "next/link";
import { revalidatePath } from "next/cache";

import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { createLocation, listLocations } from "@/lib/inventory/service";
import { createLocationSchema } from "@/lib/inventory/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function LocationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams?: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = (await searchParams) || {};
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active household</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  async function createLocationAction(formData: FormData) {
    "use server";
    const parsed = createLocationSchema.parse({
      householdId,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
    });

    await createLocation({
      userId: context.user.id,
      householdId: parsed.householdId,
      name: parsed.name,
      description: parsed.description,
    });

    revalidatePath(`/${locale}/locations`);
    revalidatePath(`/${locale}/dashboard`);
  }

  const rows = await listLocations({
    userId: context.user.id,
    householdId,
    q,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex gap-2" method="get">
            <Input name="q" defaultValue={q || ""} placeholder="Search locations" />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>

          <form action={createLocationAction} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input name="name" placeholder="New location" required />
            <Input name="description" placeholder="Description" />
            <Button type="submit">Create</Button>
          </form>

          <div className="space-y-2">
            {rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No locations found.</div>
            ) : (
              rows.map((row) => (
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
                    <Link href={`/${locale}/locations/${row.location.id}`}>Open</Link>
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}