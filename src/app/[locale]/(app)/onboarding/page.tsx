import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  ROOM_TEMPLATE_PRESETS,
  applyRoomTemplate,
  createContainerPathInRoom,
  createContainer,
  createHousehold,
  createLocation,
  listContainersForRoom,
  listLocations,
  listRoomsForLocation,
  quickCreatePathInLocation,
  setActiveHousehold,
  setActiveLocationPreference,
  setActiveRoomPreference,
} from "@/lib/inventory/service";
import {
  createContainerPathSchema,
  createContainerSchema,
  createHouseholdSchema,
  createLocationSchema,
  quickCreateLocationPathSchema,
} from "@/lib/inventory/validation";
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

const templateSchema = z.object({
  locationId: z.string().uuid(),
  template: z.enum(["apartment", "storage", "garage"]),
});

function isIdInCollection(id: string | undefined, validIds: string[]) {
  return !!id && validIds.includes(id);
}

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams?: Promise<{ locationId?: string; roomId?: string; boxId?: string }>;
}) {
  const { locale } = await params;
  const search = (await searchParams) || {};
  const context = await getInventoryContext(locale);
  const activeMembership = context.activeMembership;

  async function createHouseholdAction(formData: FormData) {
    "use server";

    const parsed = createHouseholdSchema.parse({
      name: String(formData.get("name") || ""),
    });

    const household = await createHousehold({
      userId: context.user.id,
      name: parsed.name,
    });

    await setActiveHousehold(context.user.id, household.id);
    redirect(`/${locale}/onboarding`);
  }

  if (!activeMembership) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Step 1/5: Create your first household</CardTitle>
          <CardDescription>
            A household is your shared workspace with partner/family access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createHouseholdAction} className="grid gap-3">
            <Label htmlFor="householdName">Household name</Label>
            <Input id="householdName" name="name" placeholder="Home" required />
            <Button type="submit" className="w-fit">
              Create household
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const householdId = activeMembership.household.id;

  async function createLocationAction(formData: FormData) {
    "use server";
    const parsed = createLocationSchema.parse({
      householdId,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
    });

    const location = await createLocation({
      userId: context.user.id,
      householdId: parsed.householdId,
      name: parsed.name,
      description: parsed.description,
    });

    await setActiveLocationPreference({
      userId: context.user.id,
      householdId,
      locationId: location.id,
    });

    revalidatePath(`/${locale}/onboarding`);
    redirect(`/${locale}/onboarding?locationId=${location.id}`);
  }

  const locations = await listLocations({
    userId: context.user.id,
    householdId,
  });
  const locationIds = locations.map((entry) => entry.location.id);
  const preferredLocationId = context.preferences?.activeLocationId || undefined;
  const selectedLocationId = isIdInCollection(search.locationId, locationIds)
    ? search.locationId
    : isIdInCollection(preferredLocationId, locationIds)
      ? preferredLocationId
      : locations[0]?.location.id;

  const rooms = selectedLocationId
    ? await listRoomsForLocation({
        userId: context.user.id,
        householdId,
        locationId: selectedLocationId,
      })
    : [];
  const roomIds = rooms.map((entry) => entry.room.id);
  const preferredRoomId = context.preferences?.activeRoomId || undefined;
  const selectedRoomId = isIdInCollection(search.roomId, roomIds)
    ? search.roomId
    : isIdInCollection(preferredRoomId, roomIds)
      ? preferredRoomId
      : rooms[0]?.room.id;

  async function applyTemplateAction(formData: FormData) {
    "use server";
    const parsed = templateSchema.parse({
      locationId: String(formData.get("locationId") || ""),
      template: String(formData.get("template") || ""),
    });

    await applyRoomTemplate({
      userId: context.user.id,
      householdId,
      locationId: parsed.locationId,
      template: parsed.template,
    });

    const nextRooms = await listRoomsForLocation({
      userId: context.user.id,
      householdId,
      locationId: parsed.locationId,
    });
    const nextRoomId = nextRooms[0]?.room.id || null;

    await setActiveLocationPreference({
      userId: context.user.id,
      householdId,
      locationId: parsed.locationId,
    });
    if (nextRoomId) {
      await setActiveRoomPreference({
        userId: context.user.id,
        householdId,
        roomId: nextRoomId,
      });
    }

    redirect(
      `/${locale}/onboarding?locationId=${parsed.locationId}${nextRoomId ? `&roomId=${nextRoomId}` : ""}`,
    );
  }

  async function createFirstBoxAction(formData: FormData) {
    "use server";

    const parsed = createContainerSchema.parse({
      householdId,
      roomId: String(formData.get("roomId") || ""),
      parentContainerId: null,
      name: String(formData.get("name") || ""),
      code: String(formData.get("code") || ""),
      description: String(formData.get("description") || ""),
    });

    const box = await createContainer({
      userId: context.user.id,
      householdId: parsed.householdId,
      roomId: parsed.roomId,
      parentContainerId: null,
      name: parsed.name,
      code: parsed.code,
      description: parsed.description,
    });

    await setActiveRoomPreference({
      userId: context.user.id,
      householdId,
      roomId: parsed.roomId,
    });

    redirect(
      `/${locale}/onboarding?locationId=${selectedLocationId || ""}&roomId=${parsed.roomId}&boxId=${box.id}`,
    );
  }

  async function quickCreateLocationPathAction(formData: FormData) {
    "use server";

    const parsed = quickCreateLocationPathSchema.parse({
      householdId,
      locationId: String(formData.get("locationId") || ""),
      path: String(formData.get("path") || ""),
      code: String(formData.get("code") || ""),
      description: String(formData.get("description") || ""),
    });

    const result = await quickCreatePathInLocation({
      userId: context.user.id,
      householdId: parsed.householdId,
      locationId: parsed.locationId,
      path: parsed.path,
      code: parsed.code,
      description: parsed.description,
    });

    if (!result.container) {
      throw new Error("Container was not created");
    }

    await setActiveLocationPreference({
      userId: context.user.id,
      householdId,
      locationId: parsed.locationId,
    });
    await setActiveRoomPreference({
      userId: context.user.id,
      householdId,
      roomId: result.room.id,
    });

    redirect(
      `/${locale}/rooms/${result.room.id}/map?focus=container:${result.container.id}`,
    );
  }

  async function quickCreateRoomPathAction(formData: FormData) {
    "use server";

    const parsed = createContainerPathSchema.parse({
      householdId,
      roomId: String(formData.get("roomId") || ""),
      rootParentContainerId: null,
      path: String(formData.get("path") || ""),
    });

    const result = await createContainerPathInRoom({
      userId: context.user.id,
      householdId: parsed.householdId,
      roomId: parsed.roomId,
      path: parsed.path,
    });

    if (!result.container) {
      throw new Error("Container was not created");
    }

    await setActiveRoomPreference({
      userId: context.user.id,
      householdId,
      roomId: parsed.roomId,
    });

    redirect(
      `/${locale}/rooms/${parsed.roomId}/map?focus=container:${result.container.id}`,
    );
  }

  const existingBoxes =
    selectedRoomId && householdId
      ? await listContainersForRoom({
          userId: context.user.id,
          householdId,
          roomId: selectedRoomId,
        })
      : [];

  const firstBoxId = search.boxId || existingBoxes[0]?.container.id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>StorageHo onboarding</CardTitle>
          <CardDescription>
            One flow to get from signup to your first useful box in under two minutes.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 1/5: Household</CardTitle>
          <CardDescription>
            Create your household. You can switch household later from the top bar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createHouseholdAction} className="grid gap-2">
            <Label htmlFor="newHousehold">Create household</Label>
            <div className="flex gap-2">
              <Input id="newHousehold" name="name" placeholder="Home" required />
              <Button type="submit">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2/5: First location</CardTitle>
          <CardDescription>
            Example: Apartment, Basement Storage, Garage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createLocationAction} className="grid gap-2">
            <Label htmlFor="locationName">Create location</Label>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input id="locationName" name="name" placeholder="Basement storage" required />
              <Input name="description" placeholder="Optional description" />
              <Button type="submit">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 3/5: Room template</CardTitle>
          <CardDescription>
            Pick a template to auto-create common rooms/zones for this location.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-3">
            {(Object.keys(ROOM_TEMPLATE_PRESETS) as Array<keyof typeof ROOM_TEMPLATE_PRESETS>).map(
              (template) => (
                <form key={template} action={applyTemplateAction} className="rounded-md border p-3">
                  <input type="hidden" name="locationId" value={selectedLocationId || ""} />
                  <input type="hidden" name="template" value={template} />
                  <div className="text-sm font-medium capitalize">{template}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {ROOM_TEMPLATE_PRESETS[template].join(" • ")}
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="mt-3 w-full"
                    disabled={!selectedLocationId}
                  >
                    Apply template
                  </Button>
                </form>
              ),
            )}
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 4/5: Fast path (fewer clicks)</CardTitle>
          <CardDescription>
            Create room + nested box path in one submit, then place it on map.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={quickCreateLocationPathAction} className="grid gap-2 md:grid-cols-[1fr_120px_1fr_auto]">
            <input type="hidden" name="locationId" value={selectedLocationId || ""} />
            <Input
              name="path"
              placeholder="Basement > Shelf A > Box 12"
              required
              disabled={!selectedLocationId}
            />
            <Input name="code" placeholder="B12" disabled={!selectedLocationId} />
            <Input
              name="description"
              placeholder="Optional description"
              disabled={!selectedLocationId}
            />
            <Button type="submit" disabled={!selectedLocationId}>
              Create + open map
            </Button>
          </form>
          <div className="text-xs text-muted-foreground">
            Tip: first segment becomes room/zone. Remaining segments become nested containers.
          </div>

          <form action={quickCreateRoomPathAction} className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input type="hidden" name="roomId" value={selectedRoomId || ""} />
            <Input
              name="path"
              placeholder="Shelf B > Box 07"
              required
              disabled={!selectedRoomId}
            />
            <Button type="submit" variant="outline" disabled={!selectedRoomId}>
              Create in active room
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 5/5: Continue</CardTitle>
          <CardDescription>
            Print labels or jump into mobile-first Scan Mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" disabled={!selectedLocationId}>
            <Link href={`/${locale}/print/labels?locationId=${selectedLocationId || ""}`}>
              Print labels
            </Link>
          </Button>
          <Button asChild disabled={!firstBoxId}>
            <Link href={`/${locale}/scan${firstBoxId ? `?boxId=${firstBoxId}` : ""}`}>
              Go to Scan Mode
            </Link>
          </Button>
          {firstBoxId ? (
            <Button asChild variant="ghost">
              <Link href={`/${locale}/boxes/${firstBoxId}`}>Open first box</Link>
            </Button>
          ) : null}
          {selectedRoomId ? (
            <Button asChild variant="ghost">
              <Link href={`/${locale}/rooms/${selectedRoomId}/map`}>Open active room map</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classic fallback</CardTitle>
          <CardDescription>
            Prefer the original step-by-step flow? Use this direct create form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createFirstBoxAction} className="grid gap-2 md:grid-cols-[1fr_140px_1fr_auto]">
            <input type="hidden" name="roomId" value={selectedRoomId || ""} />
            <Input name="name" placeholder="Winter Gear Box" required disabled={!selectedRoomId} />
            <Input name="code" placeholder="WG-01" disabled={!selectedRoomId} />
            <Input name="description" placeholder="Optional description" disabled={!selectedRoomId} />
            <Button type="submit" variant="outline" disabled={!selectedRoomId}>
              Create box
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
