"use client";

import Link from "next/link";

import { VirtualizedList } from "@/components/inventory/VirtualizedList";

export type ItemsVirtualizedRow = {
  id: string;
  name: string;
  quantityTotal: number;
  placements: number;
};

export function ItemsVirtualizedList({
  locale,
  rows,
  q,
  tag,
}: {
  locale: string;
  rows: ItemsVirtualizedRow[];
  q?: string;
  tag?: string;
}) {
  return (
    <VirtualizedList
      rows={rows}
      estimateSize={62}
      renderRow={(entry) => {
        const params = new URLSearchParams({
          ...(q ? { q } : {}),
          ...(tag ? { tag } : {}),
          item: entry.id,
        });

        return (
          <Link
            href={`/${locale}/items?${params.toString()}`}
            className="block border-b p-3 hover:bg-muted"
          >
            <div className="font-medium">{entry.name}</div>
            <div className="text-xs text-muted-foreground">
              Qty total: {entry.quantityTotal} | Containers: {entry.placements}
            </div>
          </Link>
        );
      }}
    />
  );
}

