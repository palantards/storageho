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
import { withRlsUserContext } from "@/server/db/tenant";
import { BoxSuggestionsPanel } from "@/components/inventory/BoxSuggestionsPanel";
import { ErrorState } from "@/components/inventory/ErrorState";
import { MoveItemDialog } from "@/components/inventory/MoveItemDialog";
import { PageFrame } from "@/components/inventory/PageFrame";
import { ScanModePanel } from "@/components/inventory/ScanModePanel";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { Button } from "@/components/ui/button";

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
  const userId = context.user.id;
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return <ErrorState title="No active household." />;
  }

  const rooms = await withRlsUserContext(userId, async () =>
    listRoomsWithFloor({
      userId,
      householdId,
    }),
  );

  const selectedRoomId =
    (search.roomId && rooms.some((entry) => entry.room.id === search.roomId)
      ? search.roomId
      : context.preferences?.activeRoomId &&
          rooms.some(
            (entry) => entry.room.id === context.preferences?.activeRoomId,
          )
        ? context.preferences.activeRoomId
        : rooms[0]?.room.id) || undefined;

  const recentBoxes = await withRlsUserContext(userId, async () =>
    listRecentContainers({
      userId,
      householdId,
      roomId: selectedRoomId,
      limit: 16,
    }),
  );

  const selectedBoxId =
    (search.boxId &&
    recentBoxes.some((entry) => entry.container.id === search.boxId)
      ? search.boxId
      : recentBoxes[0]?.container.id) || undefined;

  const activeBox = selectedBoxId
    ? await withRlsUserContext(userId, async () =>
        getContainerById({
          userId,
          householdId,
          containerId: selectedBoxId,
        }),
      )
    : null;

  const [itemsInBox, moveTargets, suggestions] = activeBox?.container.id
    ? await withRlsUserContext(userId, async () =>
        Promise.all([
          listContainerItems({
            userId,
            householdId,
            containerId: activeBox.container.id,
          }),
          listContainersForHousehold({
            userId,
            householdId,
            excludeContainerId: activeBox.container.id,
          }),
          listPhotoSuggestions({
            userId,
            householdId,
            containerId: activeBox.container.id,
            status: "pending",
            limit: 25,
          }),
        ]),
      )
    : [[], [], []];

  return (
    <PageFrame className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Scan Mode</div>
          <div className="text-sm text-muted-foreground">
            Scan a box QR to open its session, capture photos, quick add, move
            items, and move on.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
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
            photoCount: entry.photoCount,
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

        <div className="space-y-6">
          <section className="space-y-3">
            <SectionDivider
              title="AI suggestions"
              description="Review AI capture output before anything is committed."
            />
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
          </section>

          <section className="space-y-3">
            <SectionDivider
              title="3) Move items"
              description="Split quantities by scanning/selecting destination box."
            />
            {!activeBox ? (
              <div className="text-sm text-muted-foreground">
                Select a box in Scan Mode to move items.
              </div>
            ) : itemsInBox.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                This box has no items yet.
              </div>
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
          </section>
        </div>
      </div>
    </PageFrame>
  );
}
