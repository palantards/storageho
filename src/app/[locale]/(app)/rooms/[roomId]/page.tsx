import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  createContainerPathInRoom,
  createContainer,
  deleteContainer,
  deleteRoom,
  getRoomById,
  listContainersForRoom,
  listTags,
  setContainerArchived,
} from "@/lib/inventory/service";
import {
  createContainerPathSchema,
  createContainerSchema,
  deleteEntitySchema,
} from "@/lib/inventory/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; roomId: string }>;
  searchParams?: Promise<{ archived?: string; tag?: string }>;
}) {
  const { locale, roomId } = await params;
  const search = (await searchParams) || {};
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return <div className="text-sm text-muted-foreground">No active household.</div>;
  }
  const activeHouseholdId = householdId;

  const room = await getRoomById({
    userId: context.user.id,
    householdId: activeHouseholdId,
    roomId,
  });

  if (!room) {
    return <div className="text-sm text-muted-foreground">Room not found.</div>;
  }

  async function createContainerAction(formData: FormData) {
    "use server";

    const parsed = createContainerSchema.parse({
      householdId,
      roomId,
      parentContainerId:
        String(formData.get("parentContainerId") || "") === "__root__"
          ? null
          : String(formData.get("parentContainerId") || "") || null,
      name: String(formData.get("name") || ""),
      code: String(formData.get("code") || ""),
      description: String(formData.get("description") || ""),
    });

    await createContainer({
      userId: context.user.id,
      householdId: parsed.householdId,
      roomId: parsed.roomId,
      parentContainerId: parsed.parentContainerId,
      name: parsed.name,
      code: parsed.code,
      description: parsed.description,
    });

    revalidatePath(`/${locale}/rooms/${roomId}`);
  }

  async function bulkCreatePathsAction(formData: FormData) {
    "use server";

    const roomParsed = createContainerPathSchema.parse({
      householdId,
      roomId,
      rootParentContainerId:
        String(formData.get("rootParentContainerId") || "") === "__root__"
          ? null
          : String(formData.get("rootParentContainerId") || "") || null,
      path: "__placeholder__",
    });

    const raw = String(formData.get("paths") || "");
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 80);

    if (!lines.length) {
      throw new Error("Add at least one path line");
    }

    for (const path of lines) {
      await createContainerPathInRoom({
        userId: context.user.id,
        householdId: roomParsed.householdId,
        roomId: roomParsed.roomId,
        rootParentContainerId: roomParsed.rootParentContainerId ?? null,
        path,
      });
    }

    revalidatePath(`/${locale}/rooms/${roomId}`);
  }

  async function archiveContainerAction(formData: FormData) {
    "use server";

    const parsed = deleteEntitySchema.parse({
      householdId,
      id: String(formData.get("containerId") || ""),
    });
    const archived = String(formData.get("archived") || "0") === "1";

    await setContainerArchived({
      userId: context.user.id,
      householdId: parsed.householdId,
      containerId: parsed.id,
      archived,
    });

    revalidatePath(`/${locale}/rooms/${roomId}`);
  }

  async function deleteContainerAction(formData: FormData) {
    "use server";

    const parsed = deleteEntitySchema.parse({
      householdId,
      id: String(formData.get("containerId") || ""),
    });

    await deleteContainer({
      userId: context.user.id,
      householdId: parsed.householdId,
      containerId: parsed.id,
    });

    revalidatePath(`/${locale}/rooms/${roomId}`);
  }

  async function deleteRoomAction() {
    "use server";

    await deleteRoom({
      userId: context.user.id,
      householdId: activeHouseholdId,
      roomId,
    });

    redirect(`/${locale}/households/${activeHouseholdId}/canvas`);
  }

  const [containers, tags] = await Promise.all([
    listContainersForRoom({
      userId: context.user.id,
      householdId: activeHouseholdId,
      roomId,
      includeArchived: search.archived === "1",
      tagId: search.tag || undefined,
    }),
    listTags({ userId: context.user.id, householdId: activeHouseholdId }),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{room.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-xs">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/households/${activeHouseholdId}/canvas`}>
              Back to household canvas
            </Link>
          </Button>
          <Link
            href={`/${locale}/households/${activeHouseholdId}/canvas?focus=room:${roomId}`}
            className="rounded border px-2 py-1 underline-offset-2 hover:underline"
          >
            Household canvas
          </Link>
          <Link href={`/${locale}/rooms/${roomId}`} className="underline-offset-2 hover:underline">
            Active
          </Link>
          <Link href={`/${locale}/rooms/${roomId}?archived=1`} className="underline-offset-2 hover:underline">
            Include archived
          </Link>
          {tags.slice(0, 8).map((tag) => (
            <Link
              key={tag.id}
              href={`/${locale}/rooms/${roomId}?tag=${tag.id}`}
              className="rounded border px-2 py-1"
            >
              {tag.name}
            </Link>
          ))}
          <form action={deleteRoomAction} className="ml-auto">
            <Button type="submit" variant="destructive" size="sm">
              Delete room
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Add Container</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={createContainerAction} className="grid gap-2 md:grid-cols-5">
            <Input name="name" placeholder="Box A" required />
            <Input name="code" placeholder="A-01" />
            <Input name="description" placeholder="Description" />
            <Select name="parentContainerId" defaultValue="__root__">
              <SelectTrigger>
                <SelectValue placeholder="Parent container" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">Top-level box</SelectItem>
                {containers.map((entry) => (
                  <SelectItem key={entry.container.id} value={entry.container.id}>
                    Nested in: {entry.container.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" className="md:col-span-5 w-fit">
              Add container
            </Button>
          </form>

          <form action={bulkCreatePathsAction} className="grid gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bulk create paths
            </div>
            <Select name="rootParentContainerId" defaultValue="__root__">
              <SelectTrigger className="md:max-w-sm">
                <SelectValue placeholder="Top-level root" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">Top-level root</SelectItem>
                {containers.map((entry) => (
                  <SelectItem key={`bulk-${entry.container.id}`} value={entry.container.id}>
                    Under: {entry.container.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              name="paths"
              className="min-h-28"
              placeholder={"Shelf A > Box 01\nShelf A > Box 02\nShelf B > Box 10"}
            />
            <Button type="submit" variant="outline" className="w-fit">
              Create paths
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Containers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {containers.length === 0 ? (
            <div className="text-sm text-muted-foreground">No containers found.</div>
          ) : (
            containers.map((entry) => (
              <div
                key={entry.container.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <div className="font-medium">{entry.container.name}</div>
                  <div className="text-xs text-muted-foreground">
                    code: {entry.container.code || "-"} · {entry.itemCount} item rows · {entry.photoCount} photos ·{" "}
                    {entry.container.archivedAt ? "archived" : "active"}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/${locale}/boxes/${entry.container.id}`}>Open Box</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/${locale}/rooms/${roomId}/map?focus=container:${entry.container.id}`}>
                      Show on map
                    </Link>
                  </Button>
                  <form action={archiveContainerAction}>
                    <input type="hidden" name="containerId" value={entry.container.id} />
                    <input
                      type="hidden"
                      name="archived"
                      value={entry.container.archivedAt ? "0" : "1"}
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      {entry.container.archivedAt ? "Restore" : "Archive"}
                    </Button>
                  </form>
                  <form action={deleteContainerAction}>
                    <input type="hidden" name="containerId" value={entry.container.id} />
                    <Button type="submit" size="sm" variant="destructive">
                      Delete
                    </Button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
