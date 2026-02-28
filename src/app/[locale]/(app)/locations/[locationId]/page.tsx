import Link from "next/link";
import { revalidatePath } from "next/cache";

import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  createRoom,
  getLocationById,
  listRoomsForLocation,
} from "@/lib/inventory/service";
import { createRoomSchema } from "@/lib/inventory/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function LocationDetailsPage({
  params,
}: {
  params: Promise<{ locale: Locale; locationId: string }>;
}) {
  const { locale, locationId } = await params;
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return <div className="text-sm text-muted-foreground">No active household.</div>;
  }

  const location = await getLocationById({
    userId: context.user.id,
    householdId,
    locationId,
  });

  if (!location) {
    return <div className="text-sm text-muted-foreground">Location not found.</div>;
  }

  async function createRoomAction(formData: FormData) {
    "use server";

    const parsed = createRoomSchema.parse({
      householdId,
      locationId,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
    });

    await createRoom({
      userId: context.user.id,
      householdId: parsed.householdId,
      locationId: parsed.locationId,
      name: parsed.name,
      description: parsed.description,
    });

    revalidatePath(`/${locale}/locations/${locationId}`);
  }

  const rooms = await listRoomsForLocation({
    userId: context.user.id,
    householdId,
    locationId,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{location.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/print/labels?locationId=${locationId}`}>
              Print Labels
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create room / zone</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createRoomAction} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input name="name" placeholder="Kitchen" required />
            <Input name="description" placeholder="Optional" />
            <Button type="submit">Add room</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((entry) => (
          <Card key={entry.room.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{entry.room.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {entry.containerCount} containers
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/${locale}/rooms/${entry.room.id}`}>Open Room</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}