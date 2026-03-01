import Link from "next/link";

import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  ensureHouseholdCanvasInitialized,
  getHouseholdById,
  getHouseholdCanvasLayout,
  listContainersWithRoomLocation,
  listHouseholdCanvasLayers,
  listHouseholdCanvasPlacements,
  listLocations,
  listRoomsWithLocation,
} from "@/lib/inventory/service";
import { HouseholdCanvasEditor } from "@/components/inventory/HouseholdCanvasEditor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function HouseholdCanvasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams?: Promise<{ focus?: string }>;
}) {
  const { locale, id: householdId } = await params;
  const search = (await searchParams) || {};
  const context = await getInventoryContext(locale);

  const household = await getHouseholdById({
    userId: context.user.id,
    householdId,
  });

  if (!household) {
    return <div className="text-sm text-muted-foreground">Household not found.</div>;
  }

  await ensureHouseholdCanvasInitialized({
    userId: context.user.id,
    householdId,
  });

  const [layout, layers, placements, locations, rooms, containers] = await Promise.all([
    getHouseholdCanvasLayout({
      userId: context.user.id,
      householdId,
    }),
    listHouseholdCanvasLayers({
      userId: context.user.id,
      householdId,
    }),
    listHouseholdCanvasPlacements({
      userId: context.user.id,
      householdId,
    }),
    listLocations({
      userId: context.user.id,
      householdId,
    }),
    listRoomsWithLocation({
      userId: context.user.id,
      householdId,
      limit: 5000,
    }),
    listContainersWithRoomLocation({
      userId: context.user.id,
      householdId,
      includeArchived: false,
      limit: 5000,
    }),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Home Builder</CardTitle>
          <CardDescription>
            Build floor by floor: drag rooms, place boxes, zoom, and map where things are.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <div>{household.name}</div>
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>

      <HouseholdCanvasEditor
        householdId={householdId}
        householdName={household.name}
        layout={{
          width: Number(layout?.width ?? 30),
          height: Number(layout?.height ?? 20),
        }}
        layers={layers.map((layer) => ({
          id: layer.id,
          name: layer.name,
          locationId: layer.locationId ?? null,
          sortOrder: Number(layer.sortOrder ?? 0),
        }))}
        placements={placements.map((placement) => ({
          id: placement.id,
          layerId: placement.layerId,
          entityType: placement.entityType,
          entityId: placement.entityId,
          x: Number(placement.x ?? 0),
          y: Number(placement.y ?? 0),
          width: Number(placement.width ?? 3),
          height: Number(placement.height ?? 2),
          rotation: Number(placement.rotation ?? 0),
          shapeType: placement.shapeType ?? "rectangle",
          label: placement.label ?? null,
        }))}
        locations={locations.map((row) => ({
          id: row.location.id,
          name: row.location.name,
        }))}
        rooms={rooms.map((row) => ({
          id: row.room.id,
          name: row.room.name,
          locationId: row.location.id,
          locationName: row.location.name,
        }))}
        containers={containers.map((row) => ({
          id: row.container.id,
          name: row.container.name,
          code: row.container.code,
          roomId: row.room.id,
          roomName: row.room.name,
          locationId: row.location.id,
          locationName: row.location.name,
        }))}
        focus={search.focus}
      />
    </div>
  );
}
