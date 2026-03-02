import Link from "next/link";

import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  getContainerById,
  listContainerItems,
  listContainersForHousehold,
  listPhotoSuggestions,
  listRecentContainers,
  listRoomsWithFloor,
} from "@/lib/inventory/service";
import { BoxSuggestionsPanel } from "@/components/inventory/BoxSuggestionsPanel";
import { MoveItemDialog } from "@/components/inventory/MoveItemDialog";
import { ScanModePanel } from "@/components/inventory/ScanModePanel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ScanModePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams?: Promise<{ boxId?: string; roomId?: string }>;
}) {
  const { locale } = await params;
  const search = (await searchParams) || {};
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return <div className="text-sm text-muted-foreground">No active household.</div>;
  }

  const rooms = await listRoomsWithFloor({
    userId: context.user.id,
    householdId,
  });

  const selectedRoomId =
    (search.roomId && rooms.some((entry) => entry.room.id === search.roomId)
      ? search.roomId
      : context.preferences?.activeRoomId &&
          rooms.some((entry) => entry.room.id === context.preferences?.activeRoomId)
        ? context.preferences.activeRoomId
        : rooms[0]?.room.id) || undefined;

  const recentBoxes = await listRecentContainers({
    userId: context.user.id,
    householdId,
    roomId: selectedRoomId,
    limit: 16,
  });

  const selectedBoxId =
    (search.boxId &&
    recentBoxes.some((entry) => entry.container.id === search.boxId)
      ? search.boxId
      : recentBoxes[0]?.container.id) || undefined;

  const activeBox = selectedBoxId
    ? await getContainerById({
        userId: context.user.id,
        householdId,
        containerId: selectedBoxId,
      })
    : null;

  const [itemsInBox, moveTargets, suggestions] =
    activeBox?.container.id
      ? await Promise.all([
          listContainerItems({
            userId: context.user.id,
            householdId,
            containerId: activeBox.container.id,
          }),
          listContainersForHousehold({
            userId: context.user.id,
            householdId,
            excludeContainerId: activeBox.container.id,
          }),
          listPhotoSuggestions({
            userId: context.user.id,
            householdId,
            containerId: activeBox.container.id,
            status: "pending",
            limit: 25,
          }),
        ])
      : [[], [], []];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Scan Mode</CardTitle>
          <CardDescription>
            Mobile-first loop: scan box QR, capture, quick add, move, next.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <ScanModePanel
          locale={locale}
          householdId={householdId}
          activeRoomId={selectedRoomId}
          rooms={rooms.map((entry) => ({
            id: entry.room.id,
            name: entry.room.name,
            locationName: entry.location.name,
          }))}
          recentBoxes={recentBoxes.map((entry) => ({
            id: entry.container.id,
            name: entry.container.name,
            roomName: entry.room.name,
            locationName: entry.location.name,
            code: entry.container.code,
          }))}
          activeBox={
            activeBox
              ? {
                  id: activeBox.container.id,
                  name: activeBox.container.name,
                  roomName: activeBox.room.name,
                  locationName: activeBox.location.name,
                  code: activeBox.container.code,
                }
              : null
          }
        />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI suggestions</CardTitle>
              <CardDescription>
                Review AI capture output before anything is committed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!activeBox ? (
                <div className="text-sm text-muted-foreground">
                  Select a box to view suggestions.
                </div>
              ) : (
                <BoxSuggestionsPanel
                  householdId={householdId}
                  containerId={activeBox.container.id}
                  suggestions={suggestions.map((suggestion) => ({
                    id: suggestion.id,
                    suggestedName: suggestion.suggestedName,
                    suggestedQty: suggestion.suggestedQty,
                    suggestedTags: suggestion.suggestedTags,
                    confidence: Number(suggestion.confidence ?? 0),
                    status: suggestion.status,
                    resolvedItemId: suggestion.resolvedItemId,
                    createdAt: suggestion.createdAt.toISOString(),
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3) Move items</CardTitle>
              <CardDescription>
                Split quantities by scanning/selecting destination box.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!activeBox ? (
                <div className="text-sm text-muted-foreground">
                  Select a box in Scan Mode to move items.
                </div>
              ) : itemsInBox.length === 0 ? (
                <div className="text-sm text-muted-foreground">This box has no items yet.</div>
              ) : (
                itemsInBox.map((entry) => (
                  <div
                    key={entry.containerItem.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <div className="font-medium">{entry.item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Qty: {entry.containerItem.quantity}
                      </div>
                    </div>
                    <MoveItemDialog
                      householdId={householdId}
                      itemId={entry.item.id}
                      fromContainerId={activeBox.container.id}
                      maxQuantity={entry.containerItem.quantity}
                      containers={moveTargets.map((container) => ({
                        id: container.id,
                        name: container.name,
                      }))}
                    />
                  </div>
                ))
              )}

              {activeBox ? (
                <Button asChild variant="outline" className="mt-2">
                  <Link href={`/${locale}/boxes/${activeBox.container.id}`}>
                    Open full box page
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
