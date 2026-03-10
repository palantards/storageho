import Link from "next/link";
import { Clock, Image as ImageIcon, Package, Settings, Sparkles } from "lucide-react";

import type { Locale } from "@/i18n/config";
import {
  addItemToBoxFormAction,
  deleteBoxFormAction,
  removeBoxItemFormAction,
  renameBoxItemFormAction,
  setBoxArchivedFormAction,
  updateBoxItemQuantityFormAction,
  updateBoxTagsFormAction,
} from "@/lib/actions/boxDetails";
import { getInventoryShellContext } from "@/lib/inventory/page-context";
import {
  getContainerById,
  listActivity,
  listContainerItems,
  listContainerPhotos,
  listContainerTags,
  listContainersForHousehold,
  listItemsForHousehold,
  listPhotoSuggestions,
} from "@/lib/inventory/service";
import { ActivityFeed } from "@/components/inventory/ActivityFeed";
import { BoxAddItemPanel } from "@/components/inventory/BoxAddItemPanel";
import { BoxSuggestionsPanel } from "@/components/inventory/BoxSuggestionsPanel";
import { ContainerItemRow } from "@/components/inventory/ContainerItemRow";
import { EmptyState } from "@/components/inventory/EmptyState";
import { ErrorState } from "@/components/inventory/ErrorState";
import { MoveItemDialog } from "@/components/inventory/MoveItemDialog";
import { PageFrame } from "@/components/inventory/PageFrame";
import { PhotoUploader } from "@/components/inventory/PhotoUploader";
import { QRCodeRenderer } from "@/components/inventory/QRCodeRenderer";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { SignedImage } from "@/components/inventory/SignedImage";
import { TagChips } from "@/components/inventory/TagChips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { withRlsUserContext } from "@/server/db/tenant";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

export default async function BoxPage({
  params,
}: {
  params: Promise<{ locale: Locale; boxId: string }>;
}) {
  const { locale, boxId } = await params;
  const context = await getInventoryShellContext(locale);
  const userId = context.user.id;
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return <ErrorState title="No active household." />;
  }
  const activeHouseholdId = householdId;

  const row = await withRlsUserContext(userId, async () =>
    getContainerById({
      userId,
      householdId,
      containerId: boxId,
    }),
  );

  if (!row) {
    return <ErrorState title="Box not found." />;
  }

  const absoluteDeepLink = `${appUrl}/${locale}/boxes/${boxId}`;
  const addItemUnifiedAction = addItemToBoxFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    boxId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const updateTagsAction = updateBoxTagsFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    boxId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const archiveBoxAction = setBoxArchivedFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    boxId,
    roomId: row.room.id,
  }) as unknown as (formData: FormData) => Promise<void>;
  const updateItemNameAction = renameBoxItemFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    boxId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const updateQuantityAction = updateBoxItemQuantityFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    boxId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const removeItemAction = removeBoxItemFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    boxId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const deleteBoxAction = deleteBoxFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    boxId,
    roomId: row.room.id,
  }) as unknown as (formData: FormData) => Promise<void>;

  const [
    containerItems,
    itemLibrary,
    moveTargets,
    photos,
    activity,
    containerTags,
    suggestions,
  ] = await withRlsUserContext(userId, async () =>
    Promise.all([
      listContainerItems({
        userId,
        householdId: activeHouseholdId,
        containerId: boxId,
      }),
      listItemsForHousehold({
        userId,
        householdId: activeHouseholdId,
      }),
      listContainersForHousehold({
        userId,
        householdId: activeHouseholdId,
        excludeContainerId: boxId,
      }),
      listContainerPhotos({
        userId,
        householdId: activeHouseholdId,
        containerId: boxId,
      }),
      listActivity({
        userId,
        householdId: activeHouseholdId,
        limit: 20,
      }),
      listContainerTags({
        userId,
        householdId: activeHouseholdId,
        containerId: boxId,
      }),
      listPhotoSuggestions({
        userId,
        householdId: activeHouseholdId,
        containerId: boxId,
      }),
    ]),
  );
  const pendingSuggestionsCount = suggestions.filter(
    (suggestion) => suggestion.status === "pending",
  ).length;
  const acceptedSuggestionsCount = suggestions.filter(
    (suggestion) => suggestion.status === "accepted",
  ).length;
  const rejectedSuggestionsCount = suggestions.filter(
    (suggestion) => suggestion.status === "rejected",
  ).length;

  return (
    <PageFrame className="space-y-5" padded>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-2xl font-semibold">{row.container.name}</div>
            {row.container.code ? (
              <Badge variant="outline" className="font-mono text-xs">
                {row.container.code}
              </Badge>
            ) : null}
          </div>
          <div className="text-sm text-muted-foreground">
            {row.location.name} → {row.room.name}
          </div>
          <TagChips
            tags={containerTags.map((tagRow) => ({
              id: tagRow.tag.id,
              name: tagRow.tag.name,
              color: tagRow.tag.color,
            }))}
          />
        </div>
        <div className="md:pt-1">
          <QRCodeRenderer value={absoluteDeepLink} />
        </div>
      </div>

      <Tabs defaultValue="contents" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-5 gap-1">
          <TabsTrigger className="gap-1.5 py-2 text-xs sm:text-sm" value="contents">
            <Package className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Contents</span>
          </TabsTrigger>
          <TabsTrigger className="gap-1.5 py-2 text-xs sm:text-sm" value="photos">
            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Photos</span>
          </TabsTrigger>
          <TabsTrigger className="relative gap-1.5 py-2 text-xs sm:text-sm" value="suggestions">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Suggestions</span>
            {pendingSuggestionsCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground sm:static sm:ml-0.5 sm:h-4 sm:min-w-4">
                {pendingSuggestionsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger className="gap-1.5 py-2 text-xs sm:text-sm" value="settings">
            <Settings className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
          <TabsTrigger className="gap-1.5 py-2 text-xs sm:text-sm" value="activity">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contents" className="space-y-4">
          <SectionDivider
            title="Add item"
            description="Use Form mode for precise control, or Quick-add to type multiple items at once."
          />
          <BoxAddItemPanel
            householdId={activeHouseholdId}
            containerId={boxId}
            itemLibrary={itemLibrary.map((it) => ({ id: it.id, name: it.name }))}
            addAction={addItemUnifiedAction}
          />

          <SectionDivider
            title="Items in this box"
            description="Rename, adjust quantity, move or remove items."
          />
          <div className="space-y-2">
            {containerItems.length === 0 ? (
              <EmptyState title="No items in this box." description="Add your first item using the form above." />
            ) : (
              containerItems.map((entry) => (
                <ContainerItemRow
                  key={entry.containerItem.id}
                  itemId={entry.item.id}
                  containerItemId={entry.containerItem.id}
                  name={entry.item.name}
                  quantity={entry.containerItem.quantity}
                  onRename={updateItemNameAction}
                  onUpdateQuantity={updateQuantityAction}
                  rightSlot={
                    <div className="flex items-center gap-2">
                      <MoveItemDialog
                        householdId={householdId}
                        itemId={entry.item.id}
                        fromContainerId={boxId}
                        maxQuantity={entry.containerItem.quantity}
                        containers={moveTargets.map((container) => ({
                          id: container.id,
                          name: container.name,
                        }))}
                      />
                      <form action={removeItemAction}>
                        <input type="hidden" name="containerItemId" value={entry.containerItem.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </Button>
                      </form>
                    </div>
                  }
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="photos" className="space-y-4">
          <SectionDivider
            title="Photos"
            description={`${photos.length} photo${photos.length === 1 ? "" : "s"} · Upload and manage box photos.`}
          />

          <PhotoUploader
            householdId={householdId}
            entityType="container"
            entityId={boxId}
            refreshOnComplete
          />

          {photos.length === 0 ? (
            <EmptyState
              variant="dashed"
              title="No photos yet."
              description="Add your first photo from the upload area above."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {photos.map((photo) => (
                <div key={photo.id} className="overflow-hidden rounded-lg border bg-muted/20">
                  <SignedImage
                    path={photo.storagePathThumb}
                    alt="Container photo"
                    className="h-32 w-full object-cover transition hover:scale-[1.02]"
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <SectionDivider
            title="AI capture suggestions"
            description={`${photos.length} photo(s) · ${pendingSuggestionsCount} pending · ${acceptedSuggestionsCount} accepted · ${rejectedSuggestionsCount} rejected`}
          />
          <BoxSuggestionsPanel
            householdId={householdId}
            containerId={boxId}
            photosCount={photos.length}
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
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <SectionDivider title="History" description="Recent changes related to this box." />
          <ActivityFeed
            locale={locale}
            items={activity.map((entry) => ({
              id: entry.activity.id,
              actionType: entry.activity.actionType,
              entityType: entry.activity.entityType,
              entityId: entry.activity.entityId,
              metadata: entry.activity.metadata as Record<string, unknown>,
              createdAt: entry.activity.createdAt,
              actorName: entry.profile?.displayName || entry.profile?.name || context.user.email,
            }))}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <SectionDivider title="Tags" description="Set default tags for this box." />
          <form action={updateTagsAction} className="flex flex-wrap gap-2">
            <Input
              name="tagNames"
              placeholder="winter, kitchen, electronics"
              defaultValue={containerTags.map((entry) => entry.tag.name).join(", ")}
              className="min-w-[220px]"
            />
            <Button type="submit">Save tags</Button>
          </form>

          <SectionDivider title="Box metadata" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>Room: {row.room.name}</div>
            <div>Floor: {row.location.name}</div>
            <div>Code: {row.container.code || "-"}</div>
            <div>Status: {row.container.status}</div>
          </div>

          <SectionDivider title="Danger zone" />
          <div className="flex flex-wrap gap-2">
            <form action={archiveBoxAction}>
              <input
                type="hidden"
                name="archived"
                value={row.container.archivedAt ? "0" : "1"}
              />
              <Button type="submit" variant="secondary">
                {row.container.archivedAt ? "Restore box" : "Archive box"}
              </Button>
            </form>
            <form action={deleteBoxAction}>
              <Button type="submit" variant="destructive">
                Delete box
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>

      <Button asChild variant="outline">
        <Link href={`/${locale}/rooms/${row.room.id}`}>Back to room</Link>
      </Button>
    </PageFrame>
  );
}
