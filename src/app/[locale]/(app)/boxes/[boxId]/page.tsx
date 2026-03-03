import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  createItem,
  createTag,
  deleteContainer,
  getContainerById,
  listActivity,
  listContainerItems,
  listContainerPhotos,
  listContainerTags,
  listContainersForHousehold,
  listItemsForHousehold,
  listPhotoSuggestions,
  setContainerArchived,
  setContainerTags,
  updateContainerItemQuantity,
  updateItemName,
  deleteContainerItem,
  upsertContainerItem,
} from "@/lib/inventory/service";
import { ActivityFeed } from "@/components/inventory/ActivityFeed";
import { BoxSuggestionsPanel } from "@/components/inventory/BoxSuggestionsPanel";
import { ContainerItemRow } from "@/components/inventory/ContainerItemRow";
import { ItemAutocomplete } from "@/components/inventory/ItemAutocomplete";
import { MoveItemDialog } from "@/components/inventory/MoveItemDialog";
import { PhotoUploader } from "@/components/inventory/PhotoUploader";
import { QRCodeRenderer } from "@/components/inventory/QRCodeRenderer";
import { SignedImage } from "@/components/inventory/SignedImage";
import { SectionHeader } from "@/components/inventory/SectionHeader";
import { SurfaceCard } from "@/components/inventory/SurfaceCard";
import { TagChips } from "@/components/inventory/TagChips";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

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
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return (
      <div className="text-sm text-muted-foreground">No active household.</div>
    );
  }
  const activeHouseholdId = householdId;

  const row = await getContainerById({
    userId: context.user.id,
    householdId,
    containerId: boxId,
  });

  if (!row) {
    return <div className="text-sm text-muted-foreground">Box not found.</div>;
  }

  const absoluteDeepLink = `${appUrl}/${locale}/boxes/${boxId}`;

  async function addItemUnifiedAction(formData: FormData) {
    "use server";

    const rawName = String(formData.get("item") || "").trim();
    const quantity = Number(formData.get("quantity") || "1");
    const note = String(formData.get("note") || "");

    if (!rawName) {
      throw new Error("Item name is required");
    }
    if (quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    const existingItems = await listItemsForHousehold({
      userId: context.user.id,
      householdId: activeHouseholdId,
    });
    const match = existingItems.find(
      (it) => it.name.trim().toLowerCase() === rawName.toLowerCase(),
    );

    let targetItemId = match?.id;
    if (!targetItemId) {
      const created = await createItem({
        userId: context.user.id,
        householdId: activeHouseholdId,
        name: rawName,
      });
      targetItemId = created.id;
    }

    await upsertContainerItem({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerId: boxId,
      itemId: targetItemId,
      quantity,
      note,
    });

    revalidatePath(`/${locale}/boxes/${boxId}`);
    revalidatePath(`/${locale}/items`);
  }

  async function updateTagsAction(formData: FormData) {
    "use server";

    const raw = String(formData.get("tagNames") || "");
    const names = raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 20);

    const tagIds: string[] = [];
    for (const name of names) {
      const tag = await createTag({
        userId: context.user.id,
        householdId: activeHouseholdId,
        name,
      });
      tagIds.push(tag.id);
    }

    await setContainerTags({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerId: boxId,
      tagIds,
    });

    revalidatePath(`/${locale}/boxes/${boxId}`);
  }

  async function archiveBoxAction(formData: FormData) {
    "use server";

    const archived = String(formData.get("archived") || "0") === "1";
    await setContainerArchived({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerId: boxId,
      archived,
    });

    revalidatePath(`/${locale}/boxes/${boxId}`);
    revalidatePath(`/${locale}/rooms/${row.room.id}`);
  }

  async function updateItemNameAction(formData: FormData) {
    "use server";
    const itemId = String(formData.get("itemId") || "");
    const name = String(formData.get("name") || "");
    if (!itemId || !name.trim()) {
      throw new Error("Item name is required");
    }

    await updateItemName({
      userId: context.user.id,
      householdId: activeHouseholdId,
      itemId,
      name,
    });

    revalidatePath(`/${locale}/boxes/${boxId}`);
    revalidatePath(`/${locale}/items`);
  }

  async function updateQuantityAction(formData: FormData) {
    "use server";
    const containerItemId = String(formData.get("containerItemId") || "");
    const quantity = Number(formData.get("quantity") || "1");
    if (!containerItemId || quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    await updateContainerItemQuantity({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerItemId,
      quantity,
    });

    revalidatePath(`/${locale}/boxes/${boxId}`);
  }

  async function removeItemAction(formData: FormData) {
    "use server";
    const containerItemId = String(formData.get("containerItemId") || "");
    if (!containerItemId) throw new Error("containerItemId required");

    await deleteContainerItem({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerItemId,
    });

    revalidatePath(`/${locale}/boxes/${boxId}`);
  }

  async function deleteBoxAction() {
    "use server";

    await deleteContainer({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerId: boxId,
    });

    redirect(`/${locale}/rooms/${row.room.id}`);
  }

  const [
    containerItems,
    itemLibrary,
    moveTargets,
    photos,
    activity,
    containerTags,
    suggestions,
  ] = await Promise.all([
    listContainerItems({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerId: boxId,
    }),
    listItemsForHousehold({
      userId: context.user.id,
      householdId: activeHouseholdId,
    }),
    listContainersForHousehold({
      userId: context.user.id,
      householdId: activeHouseholdId,
      excludeContainerId: boxId,
    }),
    listContainerPhotos({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerId: boxId,
    }),
    listActivity({
      userId: context.user.id,
      householdId: activeHouseholdId,
      limit: 20,
    }),
    listContainerTags({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerId: boxId,
    }),
    listPhotoSuggestions({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerId: boxId,
      limit: 80,
    }),
  ]);

  return (
    <div className="space-y-4">
      <SurfaceCard variant="hero">
        <CardHeader>
          <SectionHeader
            title={row.container.name}
            description={`${row.location.name} → ${row.room.name}`}
            actions={
              <QRCodeRenderer
                value={absoluteDeepLink}
              />
            }
          />
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <div>Code: {row.container.code || "-"}</div>
            <div>Deep link: {absoluteDeepLink}</div>
            <TagChips
              tags={containerTags.map((tagRow) => ({
                id: tagRow.tag.id,
                name: tagRow.tag.name,
                color: tagRow.tag.color,
              }))}
            />
          </div>
        </CardContent>
      </SurfaceCard>

        <Tabs defaultValue="contents" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
            <TabsTrigger value="contents">Contents</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="contents" className="space-y-4">
          <SurfaceCard variant="muted" className="transition hover:shadow-md">
            <CardHeader>
              <SectionHeader
                title="Add item"
                description="Select an existing item or type a new name to create and add."
              />
            </CardHeader>
            <CardContent>
              <form action={addItemUnifiedAction} className="grid gap-3">
                <div className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="item-name"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Name
                    </Label>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground"
                            aria-label="Add item help"
                          >
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          Choose from suggestions or type. If the name doesn&apos;t match an
                          existing item, a new one will be created.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <ItemAutocomplete
                    name="item"
                    items={itemLibrary.map((it) => ({ id: it.id, name: it.name }))}
                    placeholder="e.g. Power bank"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1">
                    <Label htmlFor="item-qty" className="text-xs font-medium text-muted-foreground">
                      Quantity
                    </Label>
                    <Input
                      id="item-qty"
                      type="number"
                      min={1}
                      defaultValue={1}
                      name="quantity"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="item-note" className="text-xs font-medium text-muted-foreground">
                      Note
                    </Label>
                    <Input id="item-note" name="note" placeholder="Optional note" />
                  </div>
                </div>

                <Button type="submit" className="w-fit">
                  Add to box
                </Button>
              </form>
            </CardContent>
          </SurfaceCard>

          <SurfaceCard variant="muted" className="transition hover:shadow-md">
            <CardHeader>
              <SectionHeader
                title="Items in this box"
                description="Rename, adjust quantity, move or remove items."
              />
            </CardHeader>
            <CardContent className="space-y-2">
              {containerItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No items in this box.
                </div>
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
                          <input
                            type="hidden"
                            name="containerItemId"
                            value={entry.containerItem.id}
                          />
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
            </CardContent>
          </SurfaceCard>
        </TabsContent>

        <TabsContent value="photos">
          <SurfaceCard variant="muted" className="transition hover:shadow-md">
            <CardHeader>
              <SectionHeader title="Photos" description="Upload and manage box photos." />
            </CardHeader>
            <CardContent className="space-y-3">
              <PhotoUploader
                householdId={householdId}
                entityType="container"
                entityId={boxId}
                refreshOnComplete
                analyzeBatchOnComplete
              />
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {photos.map((photo) => (
                  <SignedImage
                    key={photo.id}
                    path={photo.storagePathThumb}
                    alt="Container photo"
                    className="h-28 w-full rounded-md object-cover"
                  />
                ))}
              </div>
            </CardContent>
          </SurfaceCard>
        </TabsContent>

        <TabsContent value="suggestions">
          <SurfaceCard variant="muted" className="transition hover:shadow-md">
            <CardHeader>
              <SectionHeader
                title="AI capture suggestions"
                description="Review and accept/reject AI-detected items."
              />
            </CardHeader>
            <CardContent>
              <BoxSuggestionsPanel
                householdId={householdId}
                containerId={boxId}
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
            </CardContent>
          </SurfaceCard>
        </TabsContent>

        <TabsContent value="activity">
          <SurfaceCard variant="muted" className="transition hover:shadow-md">
            <CardHeader>
              <SectionHeader title="History" description="Recent changes related to this box." />
            </CardHeader>
            <CardContent>
              <ActivityFeed
                locale={locale}
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
              />
            </CardContent>
          </SurfaceCard>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <SurfaceCard variant="muted" className="transition hover:shadow-md">
            <CardHeader>
              <SectionHeader title="Tags" description="Set default tags for this box." />
            </CardHeader>
            <CardContent>
              <form action={updateTagsAction} className="flex gap-2">
                <Input
                  name="tagNames"
                  placeholder="winter, kitchen, electronics"
                  defaultValue={containerTags
                    .map((entry) => entry.tag.name)
                    .join(", ")}
                />
                <Button type="submit">Save tags</Button>
              </form>
            </CardContent>
          </SurfaceCard>

          <SurfaceCard variant="muted" className="transition hover:shadow-md">
            <CardHeader>
              <SectionHeader title="Box metadata" />
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <div>Room: {row.room.name}</div>
              <div>Floor: {row.location.name}</div>
              <div>Code: {row.container.code || "-"}</div>
              <div>Status: {row.container.status}</div>
            </CardContent>
          </SurfaceCard>

          <SurfaceCard variant="danger" className="transition hover:shadow-md">
            <CardHeader>
              <SectionHeader title="Danger zone" />
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
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
            </CardContent>
          </SurfaceCard>
        </TabsContent>
      </Tabs>

      <Button asChild variant="outline">
        <Link href={`/${locale}/rooms/${row.room.id}`}>Back to room</Link>
      </Button>
    </div>
  );
}
