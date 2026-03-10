import Link from "next/link";

import { EmptyState } from "@/components/inventory/EmptyState";
import { ItemsFilterForm } from "@/components/inventory/ItemsFilterForm";
import {
  ItemsVirtualizedList,
  type ItemsVirtualizedRow,
} from "@/components/inventory/ItemsVirtualizedList";
import { PageFrame } from "@/components/inventory/PageFrame";
import { PageHeader } from "@/components/inventory/PageHeader";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { Button } from "@/components/ui/button";
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
  bulkAddItemsFormAction,
  mergeItemsFormAction,
} from "@/lib/actions/itemLibrary";
import { getInventoryShellContext } from "@/lib/inventory/page-context";
import {
  listItemPlacements,
  listItems,
  listTags,
} from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

export default async function ItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams?: Promise<{ q?: string; item?: string; tag?: string }>;
}) {
  const { locale } = await params;
  const search = (await searchParams) || {};
  const context = await getInventoryShellContext(locale);
  const userId = context.user.id;
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return (
      <div className="text-sm text-muted-foreground">No active household.</div>
    );
  }
  const activeHouseholdId = householdId;

  const tagFilter = search.tag && search.tag !== "all" ? search.tag : undefined;

  const { items, tags, placements } = await withRlsUserContext(
    userId,
    async () => {
      const [items, tags] = await Promise.all([
        listItems({
          userId,
          householdId: activeHouseholdId,
          q: search.q,
          tagId: tagFilter,
        }),
        listTags({
          userId,
          householdId: activeHouseholdId,
        }),
      ]);

      const placements = search.item
        ? await listItemPlacements({
            userId,
            householdId: activeHouseholdId,
            itemId: search.item,
          })
        : [];

      return {
        items,
        tags,
        placements,
      };
    },
  );

  const itemRows: ItemsVirtualizedRow[] = items.map((entry) => ({
    id: entry.item.id,
    name: entry.item.name,
    quantityTotal: Number(entry.quantityTotal ?? 0),
    placements: Number(entry.placements ?? 0),
  }));

  const selectedItemId = search.item;
  const bulkAddAction = bulkAddItemsFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const mergeItemsAction = mergeItemsFormAction.bind(null, {
    locale,
    householdId: activeHouseholdId,
  }) as unknown as (formData: FormData) => Promise<void>;

  const duplicates = items.reduce<Record<string, ItemsVirtualizedRow[]>>(
    (acc, row) => {
      const key = row.item.name.trim().toLowerCase();
      acc[key] = acc[key] || [];
      acc[key].push({
        id: row.item.id,
        name: row.item.name,
        quantityTotal: Number(row.quantityTotal ?? 0),
        placements: Number(row.placements ?? 0),
      });
      return acc;
    },
    {},
  );
  const duplicateGroups = Object.values(duplicates).filter(
    (group) => group.length > 1,
  );

  return (
    <PageFrame className="space-y-6">
      <PageHeader
        title="Items"
        description="Search, bulk add, and manage item placements across your household."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
          </Button>
        }
      />

      <div className="space-y-3">
        <SectionDivider title="Filters" />
        <ItemsFilterForm
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>

      <div className="space-y-3">
        <SectionDivider title="All items" />
        {itemRows.length === 0 ? (
          <EmptyState
            title="No items yet."
            description="Add items to see them listed here."
          />
        ) : (
          <ItemsVirtualizedList
            rows={itemRows}
            q={search.q}
            tag={search.tag}
            locale={locale}
          />
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
          {duplicateGroups.length === 0 ? (
            <EmptyState
              title="No likely duplicates found."
              description="Duplicate names will appear here automatically."
            />
          ) : (
            <div className="space-y-3">
              {duplicateGroups.map((group) => (
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
                  {row.location.name} → {row.room.name} →{" "}
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
