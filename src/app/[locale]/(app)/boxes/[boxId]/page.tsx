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
  upsertContainerItem,
} from "@/lib/inventory/service";
import { ActivityFeed } from "@/components/inventory/ActivityFeed";
import { BoxSuggestionsPanel } from "@/components/inventory/BoxSuggestionsPanel";
import { MoveItemDialog } from "@/components/inventory/MoveItemDialog";
import { PhotoUploader } from "@/components/inventory/PhotoUploader";
import { QRCodeRenderer } from "@/components/inventory/QRCodeRenderer";
import { SignedImage } from "@/components/inventory/SignedImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    return <div className="text-sm text-muted-foreground">No active household.</div>;
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

  async function addExistingItemAction(formData: FormData) {
    "use server";

    const itemId = String(formData.get("itemId") || "");
    const quantity = Number(formData.get("quantity") || "1");
    const note = String(formData.get("note") || "");

    if (!itemId || quantity < 1) {
      throw new Error("itemId and quantity are required");
    }

    await upsertContainerItem({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerId: boxId,
      itemId,
      quantity,
      note,
    });

    revalidatePath(`/${locale}/boxes/${boxId}`);
    revalidatePath(`/${locale}/items`);
  }

  async function createAndAddItemAction(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "");
    const quantity = Number(formData.get("quantity") || "1");
    const note = String(formData.get("note") || "");

    if (!name.trim() || quantity < 1) {
      throw new Error("name and quantity are required");
    }

    const item = await createItem({
      userId: context.user.id,
      householdId: activeHouseholdId,
      name,
    });

    await upsertContainerItem({
      userId: context.user.id,
      householdId: activeHouseholdId,
      containerId: boxId,
      itemId: item.id,
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
    listContainerItems({ userId: context.user.id, householdId: activeHouseholdId, containerId: boxId }),
    listItemsForHousehold({ userId: context.user.id, householdId: activeHouseholdId }),
    listContainersForHousehold({
      userId: context.user.id,
      householdId: activeHouseholdId,
      excludeContainerId: boxId,
    }),
    listContainerPhotos({ userId: context.user.id, householdId: activeHouseholdId, containerId: boxId }),
    listActivity({ userId: context.user.id, householdId: activeHouseholdId, limit: 20 }),
    listContainerTags({ userId: context.user.id, householdId: activeHouseholdId, containerId: boxId }),
    listPhotoSuggestions({ userId: context.user.id, householdId: activeHouseholdId, containerId: boxId, limit: 80 }),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{row.container.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-2 text-sm text-muted-foreground">
            <div>
              Path: {row.location.name} {"->"} {row.room.name} {"->"} {row.container.name}
            </div>
            <div>Code: {row.container.code || "-"}</div>
            <div>Deep link: {absoluteDeepLink}</div>
            <div className="flex flex-wrap gap-2 pt-1">
              {containerTags.map((tagRow) => (
                <span
                  key={tagRow.tag.id}
                  className="rounded border px-2 py-1 text-xs"
                  style={{ color: tagRow.tag.color || undefined }}
                >
                  {tagRow.tag.name}
                </span>
              ))}
            </div>
          </div>
          <QRCodeRenderer value={absoluteDeepLink} />
        </CardContent>
      </Card>

      <Tabs defaultValue="contents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="contents">Contents</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="contents" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Add Existing Item</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={addExistingItemAction} className="grid gap-2">
                  <select name="itemId" className="h-9 rounded-md border bg-background px-3 text-sm">
                    <option value="">Select item</option>
                    {itemLibrary.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <Input type="number" min={1} defaultValue={1} name="quantity" />
                  <Input name="note" placeholder="Optional note" />
                  <Button type="submit" className="w-fit">
                    Add item to box
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Create + Add Item</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createAndAddItemAction} className="grid gap-2">
                  <Input name="name" placeholder="Item name" required />
                  <Input type="number" min={1} defaultValue={1} name="quantity" />
                  <Input name="note" placeholder="Optional note" />
                  <Button type="submit" className="w-fit">
                    Create and add
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Items in this box</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {containerItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">No items in this box.</div>
              ) : (
                containerItems.map((entry) => (
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
                      fromContainerId={boxId}
                      maxQuantity={entry.containerItem.quantity}
                      containers={moveTargets.map((container) => ({
                        id: container.id,
                        name: container.name,
                      }))}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <PhotoUploader
                householdId={householdId}
                entityType="container"
                entityId={boxId}
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
          </Card>
        </TabsContent>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle>AI capture suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <BoxSuggestionsPanel
                householdId={householdId}
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
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed
                items={activity.map((entry) => ({
                  id: entry.activity.id,
                  actionType: entry.activity.actionType,
                  entityType: entry.activity.entityType,
                  metadata: entry.activity.metadata as Record<string, unknown>,
                  createdAt: entry.activity.createdAt,
                  actorName:
                    entry.profile?.displayName ||
                    entry.profile?.name ||
                    context.user.email,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Map placement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>Place this box on the room map for faster in-person retrieval.</div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/${locale}/rooms/${row.room.id}/map?focus=container:${row.container.id}`}>
                    Open room map
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link
                    href={`/${locale}/households/${activeHouseholdId}/canvas?focus=container:${row.container.id}`}
                  >
                    Open household canvas
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateTagsAction} className="flex gap-2">
                <Input
                  name="tagNames"
                  placeholder="winter, kitchen, electronics"
                  defaultValue={containerTags.map((entry) => entry.tag.name).join(", ")}
                />
                <Button type="submit">Save tags</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Box metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <div>Room: {row.room.name}</div>
              <div>Location: {row.location.name}</div>
              <div>Code: {row.container.code || "-"}</div>
              <div>Status: {row.container.status}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger zone</CardTitle>
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
          </Card>
        </TabsContent>
      </Tabs>

      <Button asChild variant="outline">
        <Link href={`/${locale}/rooms/${row.room.id}`}>Back to room</Link>
      </Button>
    </div>
  );
}
