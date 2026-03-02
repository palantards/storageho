"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Session } from "@/lib/auth";

import { TicketCard } from "./TicketCard";
import {
  PublicTicketCategory,
  TicketsPage,
  PublicTicketItem,
} from "@/lib/support";
import { loadPublicTicketsAction } from "@/app/[locale]/(marketing)/support/action";

const LIMIT = 10;

export function TicketColumn({
  title,
  category,
  session,
  initialPage,
}: {
  title: string;
  category: PublicTicketCategory;
  session: Session | null;
  initialPage: TicketsPage;
}) {
  const [items, setItems] = React.useState<PublicTicketItem[]>(
    initialPage.items,
  );
  const [cursor, setCursor] = React.useState(initialPage.nextCursor);
  const [hasMore, setHasMore] = React.useState(initialPage.hasMore);
  const [isLoading, setIsLoading] = React.useState(false);

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const loadMore = React.useCallback(async () => {
    if (isLoading || !hasMore || !cursor) return;

    setIsLoading(true);
    try {
      const page = await loadPublicTicketsAction({
        category,
        limit: LIMIT,
        cursorCreatedAt: cursor.createdAt,
        cursorId: cursor.id,
      });

      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } finally {
      setIsLoading(false);
    }
  }, [category, cursor, hasMore, isLoading]);

  // IntersectionObserver (real infinite scroll)
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "600px", threshold: 0 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="text-xs text-muted-foreground">
          {items.length} items
        </div>
      </div>

      <div className="space-y-3">
        {items.map((t) => (
          <TicketCard key={t.id} ticket={t} session={session} />
        ))}
      </div>

      {/* Sentinel */}
      <div ref={sentinelRef} />

      <div className="flex items-center justify-between pt-1">
        {hasMore ? (
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Load more"
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

