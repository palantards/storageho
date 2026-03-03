"use client";

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function VirtualizedList<T>({
  rows,
  estimateSize = 56,
  renderRow,
}: {
  rows: T[];
  estimateSize?: number;
  renderRow: (row: T, index: number) => React.ReactNode;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 8,
  });

  const totalSize = useMemo(() => virtualizer.getTotalSize(), [virtualizer]);
  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="max-h-[60vh] overflow-auto rounded-md border">
      <div style={{ height: totalSize, position: "relative" }}>
        {items.map((item) => (
          <div
            key={item.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${item.start}px)`,
            }}
          >
            {renderRow(rows[item.index], item.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
