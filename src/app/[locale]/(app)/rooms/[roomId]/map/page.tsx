import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  getRoomById,
  getRoomLayout,
  listContainersForRoom,
  listEntityPhotos,
  listPlacementsForRoom,
} from "@/lib/inventory/service";
import { RoomMapEditor } from "@/components/inventory/RoomMapEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RoomMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; roomId: string }>;
  searchParams?: Promise<{ focus?: string }>;
}) {
  const { locale, roomId } = await params;
  const search = (await searchParams) || {};
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return <div className="text-sm text-muted-foreground">No active household.</div>;
  }

  const room = await getRoomById({
    userId: context.user.id,
    householdId,
    roomId,
  });

  if (!room) {
    return <div className="text-sm text-muted-foreground">Room not found.</div>;
  }

  const [layout, containers, placements, photos] = await Promise.all([
    getRoomLayout({
      userId: context.user.id,
      householdId,
      roomId,
    }),
    listContainersForRoom({
      userId: context.user.id,
      householdId,
      roomId,
      includeArchived: false,
    }),
    listPlacementsForRoom({
      userId: context.user.id,
      householdId,
      roomId,
    }),
    listEntityPhotos({
      userId: context.user.id,
      householdId,
      entityType: "room_layout",
      entityId: roomId,
    }),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Room map: {room.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Place containers on a spatial map for faster retrieval.
        </CardContent>
      </Card>

      <RoomMapEditor
        locale={locale}
        householdId={householdId}
        roomId={roomId}
        layout={{
          width: Number(layout?.width ?? 12),
          height: Number(layout?.height ?? 8),
          backgroundPhotoId: layout?.backgroundPhotoId ?? null,
        }}
        containers={containers.map((entry) => ({
          id: entry.container.id,
          name: entry.container.name,
          code: entry.container.code,
        }))}
        placements={placements.map((placement) => ({
          id: placement.id,
          entityType: placement.entityType,
          entityId: placement.entityId,
          x: Number(placement.x ?? 0),
          y: Number(placement.y ?? 0),
          rotation: Number(placement.rotation ?? 0),
          label: placement.label ?? null,
        }))}
        photos={photos.map((photo) => ({
          id: photo.id,
          thumbPath: photo.storagePathThumb,
          originalPath: photo.storagePathOriginal,
        }))}
        focus={search.focus}
      />
    </div>
  );
}
