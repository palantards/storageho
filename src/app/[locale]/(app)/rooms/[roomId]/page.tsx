import Link from "next/link";
import { revalidatePath } from "next/cache";

import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  createContainer,
  getRoomById,
  listContainersForRoom,
  listTags,
} from "@/lib/inventory/service";
import { createContainerSchema } from "@/lib/inventory/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

  const room = await getRoomById({
    userId: context.user.id,
    householdId,
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
      parentContainerId: String(formData.get("parentContainerId") || "") || null,
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

  const [containers, tags] = await Promise.all([
    listContainersForRoom({
      userId: context.user.id,
      householdId,
      roomId,
      includeArchived: search.archived === "1",
      tagId: search.tag || undefined,
    }),
    listTags({ userId: context.user.id, householdId }),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{room.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Add Container</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createContainerAction} className="grid gap-2 md:grid-cols-4">
            <Input name="name" placeholder="Box A" required />
            <Input name="code" placeholder="A-01" />
            <Input name="description" placeholder="Description" />
            <Input name="parentContainerId" placeholder="Parent container id (optional)" />
            <Button type="submit" className="md:col-span-4 w-fit">
              Add container
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
                    code: {entry.container.code || "-"} · {entry.itemCount} item rows · {entry.photoCount} photos
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/${locale}/boxes/${entry.container.id}`}>Open Box</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
