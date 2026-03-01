import Link from "next/link";
import { revalidatePath } from "next/cache";

import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { parseQuickAddText } from "@/lib/inventory/quick-add";
import {
  findOrCreateItemByName,
  listItemPlacements,
  listItems,
  listTags,
  mergeItems,
} from "@/lib/inventory/service";
import {
  ItemsVirtualizedList,
  type ItemsVirtualizedRow,
} from "@/components/inventory/ItemsVirtualizedList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function ItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams?: Promise<{ q?: string; item?: string; tag?: string }>;
}) {
  const { locale } = await params;
  const search = (await searchParams) || {};
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return (
      <div className="text-sm text-muted-foreground">No active household.</div>
    );
  }
  const activeHouseholdId = householdId;

  const [items, tags] = await Promise.all([
    listItems({
      userId: context.user.id,
      householdId: activeHouseholdId,
      q: search.q,
      tagId: search.tag,
    }),
    listTags({
      userId: context.user.id,
      householdId: activeHouseholdId,
    }),
  ]);

  const itemRows: ItemsVirtualizedRow[] = items.map((entry) => ({
    id: entry.item.id,
    name: entry.item.name,
    quantityTotal: Number(entry.quantityTotal ?? 0),
    placements: Number(entry.placements ?? 0),
  }));

  const selectedItemId = search.item;
  const placements = selectedItemId
    ? await listItemPlacements({
        userId: context.user.id,
        householdId: activeHouseholdId,
        itemId: selectedItemId,
      })
    : [];

  const duplicates = Array.from(
    itemRows.reduce((acc, row) => {
      const key = row.name.trim().toLowerCase();
      const group = acc.get(key) || [];
      group.push(row);
      acc.set(key, group);
      return acc;
    }, new Map<string, ItemsVirtualizedRow[]>()),
  )
    .map(([, rows]) => rows)
    .filter((rows) => rows.length > 1)
    .slice(0, 30);

  async function bulkAddAction(formData: FormData) {
    "use server";

    const raw = String(formData.get("bulkText") || "");
    const entries = parseQuickAddText(raw).slice(0, 200);
    if (!entries.length) {
      throw new Error("No valid rows to import");
    }

    const seen = new Set<string>();
    for (const entry of entries) {
      const key = entry.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      await findOrCreateItemByName({
        userId: context.user.id,
        householdId: activeHouseholdId,
        name: entry.name,
      });
    }

    revalidatePath(`/${locale}/items`);
  }

  async function mergeItemsAction(formData: FormData) {
    "use server";
    const sourceItemId = String(formData.get("sourceItemId") || "");
    const targetItemId = String(formData.get("targetItemId") || "");
    if (!sourceItemId || !targetItemId) {
      throw new Error("Both source and target are required");
    }

    await mergeItems({
      userId: context.user.id,
      householdId: activeHouseholdId,
      sourceItemId,
      targetItemId,
    });

    revalidatePath(`/${locale}/items`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Item Library</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex gap-2">
            <Input
              name="q"
              defaultValue={search.q || ""}
              placeholder="Search items"
            />
            <select
              name="tag"
              defaultValue={search.tag || ""}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">All tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemsVirtualizedList
            locale={locale}
            rows={itemRows}
            q={search.q}
            tag={search.tag}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Bulk add / paste list</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={bulkAddAction} className="space-y-2">
              <textarea
                name="bulkText"
                className="min-h-36 w-full rounded-md border bg-background p-2 text-sm"
                placeholder="2 HDMI cables, 1 powerbank&#10;winter gloves&#10;flashlight"
              />
              <Button type="submit" variant="outline">
                Add items
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Merge duplicates</CardTitle>
          </CardHeader>
          <CardContent>
            {duplicates.length === 0 ? (
              <div className="text-sm text-muted-foreground">No likely duplicates found.</div>
            ) : (
              <div className="space-y-3">
                {duplicates.map((group) => (
                  <form
                    key={group.map((row) => row.id).join("-")}
                    action={mergeItemsAction}
                    className="grid gap-2 rounded-md border p-3"
                  >
                    <div className="text-sm font-medium">{group[0]?.name}</div>
                    <select
                      name="sourceItemId"
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                    >
                      {group.map((row) => (
                        <option key={`source-${row.id}`} value={row.id}>
                          Source: {row.name} ({row.placements} placements)
                        </option>
                      ))}
                    </select>
                    <select
                      name="targetItemId"
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      defaultValue={group[0]?.id}
                    >
                      {group.map((row) => (
                        <option key={`target-${row.id}`} value={row.id}>
                          Keep: {row.name} ({row.quantityTotal} qty total)
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="outline" className="w-fit">
                      Merge
                    </Button>
                  </form>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedItemId ? (
        <Card>
          <CardHeader>
            <CardTitle>Where this item exists</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {placements.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No placements found.
              </div>
            ) : (
              placements.map((row) => (
                <div key={row.containerItem.id} className="rounded-md border p-3">
                  <div className="font-medium">
                    {row.location.name} {"->"} {row.room.name} {"->"}{" "}
                    {row.container.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Qty: {row.containerItem.quantity}
                  </div>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link href={`/${locale}/boxes/${row.container.id}`}>Open box</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
