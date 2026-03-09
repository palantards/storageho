import Link from "next/link";

import { ContainerActionsDropdown } from "@/components/inventory/ContainerActionsDropdown";
import { EmptyState } from "@/components/inventory/EmptyState";
import { ErrorState } from "@/components/inventory/ErrorState";
import { PageFrame } from "@/components/inventory/PageFrame";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/config";
import {
  bulkCreateRoomPathsFormAction,
  createRoomContainerFormAction,
  deleteRoomContainerFormAction,
  deleteRoomFormAction,
  setRoomContainerArchivedFormAction,
} from "@/lib/actions/roomDetails";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  getRoomById,
  listContainersForRoom,
  listTags,
} from "@/lib/inventory/service";
import {
} from "@/lib/inventory/validation";
import { withRlsUserContext } from "@/server/db/tenant";

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
  const userId = context.user.id;
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return <ErrorState title="No active household." />;
  }
  const activeHouseholdId = householdId;

  const room = await withRlsUserContext(userId, async () =>
    getRoomById({
      userId,
      householdId: activeHouseholdId,
      roomId,
    }),
  );

  if (!room) {
    return <ErrorState title="Room not found." />;
  }
  const createContainerAction = createRoomContainerFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    roomId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const bulkCreatePathsAction = bulkCreateRoomPathsFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    roomId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const archiveContainerAction = setRoomContainerArchivedFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    roomId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const deleteContainerAction = deleteRoomContainerFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    roomId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const deleteRoomAction = deleteRoomFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
    roomId,
    canvasHouseholdId: activeHouseholdId,
  }) as unknown as (formData: FormData) => Promise<void>;

  const [containers, tags] = await withRlsUserContext(userId, async () =>
    Promise.all([
      listContainersForRoom({
        userId,
        householdId: activeHouseholdId,
        roomId,
        includeArchived: search.archived === "1",
        tagId: search.tag || undefined,
      }),
      listTags({ userId, householdId: activeHouseholdId }),
    ]),
  );

  return (
    <PageFrame className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">{room.name}</div>
            <div className="text-sm text-muted-foreground">
              <Link
                href={`/${locale}/households/${activeHouseholdId}/canvas`}
                className="hover:underline underline-offset-2"
              >
                Household canvas
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter:</span>
          <Link
            href={`/${locale}/rooms/${roomId}`}
            className="rounded border bg-muted/60 px-2 py-1 text-xs hover:bg-muted transition-colors"
          >
            Active
          </Link>
          <Link
            href={`/${locale}/rooms/${roomId}?archived=1`}
            className="rounded border bg-muted/60 px-2 py-1 text-xs hover:bg-muted transition-colors"
          >
            Include archived
          </Link>
          {tags.slice(0, 8).map((tag) => (
            <Link
              key={tag.id}
              href={`/${locale}/rooms/${roomId}?tag=${tag.id}`}
              className="rounded border bg-muted/60 px-2 py-1 text-xs hover:bg-muted transition-colors"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SectionDivider title="Quick add container" />
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
      </div>

      <div className="space-y-3">
        <SectionDivider title="Bulk create paths" />
        <form action={bulkCreatePathsAction} className="grid gap-2">
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
      </div>

      <div className="space-y-3">
        <SectionDivider title="Containers" />
        {containers.length === 0 ? (
          <EmptyState title="No containers found." description="Add your first container using the form above." />
        ) : (
          <div className="space-y-2">
            {containers.map((entry) => (
              <div
                key={entry.container.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3 transition hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{entry.container.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {entry.container.code ? (
                      <span className="mr-2 rounded border bg-muted/60 px-1.5 py-0.5 font-mono">
                        {entry.container.code}
                      </span>
                    ) : null}
                    {entry.itemCount} items · {entry.photoCount} photos
                    {entry.container.archivedAt ? (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">archived</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/${locale}/boxes/${entry.container.id}`}>Open box</Link>
                  </Button>
                  <ContainerActionsDropdown
                    containerId={entry.container.id}
                    mapHref={`/${locale}/rooms/${roomId}/map?focus=container:${entry.container.id}`}
                    isArchived={!!entry.container.archivedAt}
                    archiveAction={archiveContainerAction}
                    deleteAction={deleteContainerAction}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SectionDivider title="Danger zone" />
        <form action={deleteRoomAction}>
          <Button type="submit" variant="destructive" size="sm">
            Delete room
          </Button>
        </form>
      </div>
    </PageFrame>
  );
}
