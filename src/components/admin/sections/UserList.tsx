"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { UserWithProfileAndSubscription } from "@/lib/admin/users";

const LIMIT = 30;

export function UserList({
  initialUsers,
}: {
  initialUsers: UserWithProfileAndSubscription[];
}) {
  const [users, setUsers] = React.useState(initialUsers);
  const [offset, setOffset] = React.useState(LIMIT);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);

  const loaderRef = React.useRef<HTMLDivElement | null>(null);

  // Hard locks (avoid race conditions)
  const inFlightRef = React.useRef(false);

  // "Arming" prevents auto-fill spam
  const armedRef = React.useRef(true);

  // Re-arm only when user scrolls
  React.useEffect(() => {
    const onScroll = () => {
      armedRef.current = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fetchMore = React.useCallback(async () => {
    if (!hasMore) return;
    if (inFlightRef.current) return;

    // Require a scroll event between loads (prevents spam)
    if (!armedRef.current) return;

    armedRef.current = false; // disarm until user scrolls again
    inFlightRef.current = true;
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/admin/users?offset=${offset}&limit=${LIMIT}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;

      const data: UserWithProfileAndSubscription[] = await res.json();

      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }

      setUsers((prev) => [...prev, ...data]);
      setOffset((prev) => prev + LIMIT);

      if (data.length < LIMIT) setHasMore(false);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [hasMore, offset]);

  React.useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchMore();
      },
      {
        threshold: 0,
        rootMargin: "200px 0px",
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchMore, hasMore]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">User Management</h2>
        <div className="text-sm text-muted-foreground">
          {users.length} loaded
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3 px-4">Email</th>
              <th className="text-left py-3 px-4">Subscription</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {users.map(({ users: user, profiles, subscriptions }) => (
              <tr
                key={user.id}
                className={[
                  "border-t",
                  user.isFlagged ? "bg-yellow-50" : "",
                ].join(" ")}
              >
                <td className="py-3 px-4">{profiles?.name || "(no name)"}</td>
                <td className="py-3 px-4">{user.email}</td>
                <td className="py-3 px-4">{subscriptions?.status || "Free"}</td>
                <td className="py-3 px-4">
                  {user.isBlocked ? (
                    <Badge variant="destructive">Blocked</Badge>
                  ) : (
                    <Badge variant="secondary">Active</Badge>
                  )}
                  {user.isFlagged && !user.isBlocked && (
                    <Badge variant="outline" className="ml-2">
                      Flagged
                    </Badge>
                  )}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="flex gap-2">
                    <form action="/api/admin/flag-user" method="POST">
                      <input type="hidden" name="userId" value={user.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        {user.isFlagged ? "Unflag" : "Flag"}
                      </Button>
                    </form>

                    <form action="/api/admin/block-user" method="POST">
                      <input type="hidden" name="userId" value={user.id} />
                      <Button type="submit" variant="destructive" size="sm">
                        {user.isBlocked ? "Unblock" : "Block"}
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Sentinel */}
        {hasMore && (
          <div ref={loaderRef} className="flex justify-center py-6">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          </div>
        )}
      </div>
    </div>
  );
}

