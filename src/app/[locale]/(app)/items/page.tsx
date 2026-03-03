import Link from "next/link";
import { revalidatePath } from "next/cache";

import { ActionBar } from "@/components/inventory/ActionBar";
import { EmptyState } from "@/components/inventory/EmptyState";
import {
  ItemsVirtualizedList,
  type ItemsVirtualizedRow,
} from "@/components/inventory/ItemsVirtualizedList";
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
import { getInventoryContext } from "@/lib/inventory/page-context";
import { parseQuickAddText } from "@/lib/inventory/quick-add";
import {
  findOrCreateItemByName,
  listItemPlacements,
  listItems,
  listTags,
  mergeItems,
} from "@/lib/inventory/service";

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

  const tagFilter = search.tag && search.tag !== "all" ? search.tag : undefined;

  const [items, tags] = await Promise.all([
    listItems({
      userId: context.user.id,
      householdId: activeHouseholdId,
      q: search.q,
      tagId: tagFilter,
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

  async function bulkAddAction(formData: FormData) {
    "use server";

    const parsed = parseQuickAddText(String(formData.get("bulkText") || ""));
    for (const entry of parsed) {
      const item = await findOrCreateItemByName({
        userId: context.user.id,
        householdId: activeHouseholdId,
        name: entry.name,
      });
      await findOrCreateItemByName({
        userId: context.user.id,
        householdId: activeHouseholdId,
        name: item.name,
      });
    }

    revalidatePath(`/${locale}/items`);
  }

  async function mergeItemsAction(formData: FormData) {
    "use server";
    const sourceItemId = String(formData.get("sourceItemId") || "");
    const targetItemId = String(formData.get("targetItemId") || "");

    await mergeItems({
      userId: context.user.id,
      householdId: activeHouseholdId,
      sourceItemId,
      targetItemId,
    });

    revalidatePath(`/${locale}/items`);
  }

  const duplicates = items
    .filter((row) => row.duplicateGroupId)
    .reduce<Record<string, ItemsVirtualizedRow[]>>((acc, row) => {
      const group = row.duplicateGroupId || row.item.name;
      acc[group] = acc[group] || [];
      acc[group].push({
        id: row.item.id,
        name: row.item.name,
        quantityTotal: Number(row.quantityTotal ?? 0),
        placements: Number(row.placements ?? 0),
      });
      return acc;
    }, {});

  return (
    <PageFrame className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Items</div>
          <div className="text-sm text-muted-foreground">
            Search, bulk add, and manage item placements across your household.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <SectionDivider title="Filters" />
        <form className="grid gap-2 md:grid-cols-[2fr_1fr]">
          <Input
            name="q"
            placeholder="Search items"
            defaultValue={search.q || ""}
            className="w-full"
          />
          <Select name="tag" defaultValue={search.tag || "all"}>
            <SelectTrigger>
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit">Apply</Button>
            <Button type="button" variant="outline" asChild>
              <Link href={`/${locale}/items`}>Reset</Link>
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-3">
        <SectionDivider title="All items" />
        {itemRows.length === 0 ? (
          <EmptyState
            title="No items yet."
            description="Add items to see them listed here."
          />
        ) : (
          <ItemsVirtualizedList rows={itemRows} q={search.q} tag={search.tag} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <SectionDivider title="Bulk add / paste list" />
          <form action={bulkAddAction} className="space-y-2">
            <Textarea
              name="bulkText"
              className="min-h-36"
              placeholder="2 HDMI cables, 1 powerbank&#10;winter gloves&#10;flashlight"
            />
            <Button type="submit" variant="outline">
              Add items
            </Button>
          </form>
        </div>

        <div className="space-y-3">
          <SectionDivider
            title="Merge duplicates"
            description="Combine items with the same name to keep counts accurate."
          />
          {Object.keys(duplicates).length === 0 ? (
            <EmptyState
              title="No likely duplicates found."
              description="Duplicate names will appear here automatically."
            />
          ) : (
            <div className="space-y-3">
              {Object.values(duplicates).map((group) => (
                <form
                  key={group.map((row) => row.id).join("-")}
                  action={mergeItemsAction}
                  className="grid gap-2 rounded-md border p-3"
                >
                  <div className="text-sm font-medium">{group[0]?.name}</div>
                  <Select name="sourceItemId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose source" />
                    </SelectTrigger>
                    <SelectContent>
                      {group.map((row) => (
                        <SelectItem key={`source-${row.id}`} value={row.id}>
                          Source: {row.name} ({row.placements} placements)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    name="targetItemId"
                    defaultValue={group[0]?.id}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Keep item" />
                    </SelectTrigger>
                    <SelectContent>
                      {group.map((row) => (
                        <SelectItem key={`target-${row.id}`} value={row.id}>
                          Keep: {row.name} ({row.quantityTotal} qty total)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" variant="outline" className="w-fit">
                    Merge
                  </Button>
                </form>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedItemId ? (
        <div className="space-y-3">
          <SectionDivider
            title="Where this item exists"
            description="All boxes containing the selected item."
          />
          {placements.length === 0 ? (
            <EmptyState
              title="No placements found."
              description="Add the item to a box to see it here."
            />
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
                  <Link href={`/${locale}/boxes/${row.container.id}`}>
                    Open box
                  </Link>
                </Button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </PageFrame>
  );
}
