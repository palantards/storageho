import Link from "next/link";

import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { listItemPlacements, listItems, listTags } from "@/lib/inventory/service";
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

  const [items, tags] = await Promise.all([
    listItems({
      userId: context.user.id,
      householdId,
      q: search.q,
      tagId: search.tag,
    }),
    listTags({
      userId: context.user.id,
      householdId,
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
        householdId,
        itemId: selectedItemId,
      })
    : [];

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
