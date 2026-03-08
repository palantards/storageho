"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { UserWithProfileAndSubscription } from "@/lib/admin/users";
import { setUserBlockAction, setUserFlagAction } from "@/app/[locale]/(app)/admin/actions";

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
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

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
        `/api/admin?offset=${offset}&limit=${LIMIT}`,
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

  const updateUserState = React.useCallback(
    (
      userId: string,
      patch: Partial<UserWithProfileAndSubscription["users"]>,
    ) => {
      setUsers((prev) =>
        prev.map((entry) =>
          entry.users.id === userId
            ? { ...entry, users: { ...entry.users, ...patch } }
            : entry,
        ),
      );
    },
    [],
  );

  const handleFlagToggle = React.useCallback(
    (userId: string, isFlagged: boolean) => {
      setActionError(null);

      startTransition(async () => {
        const result = await setUserFlagAction({ userId, value: !isFlagged });
        if (!result.ok) {
          setActionError(result.error);
          return;
        }

        updateUserState(userId, { isFlagged: !isFlagged });
      });
    },
    [updateUserState],
  );

  const handleBlockToggle = React.useCallback(
    (userId: string, isBlocked: boolean) => {
      setActionError(null);

      startTransition(async () => {
        const result = await setUserBlockAction({ userId, value: !isBlocked });
        if (!result.ok) {
          setActionError(result.error);
          return;
        }

        updateUserState(userId, { isBlocked: !isBlocked });
      });
    },
    [updateUserState],
  );

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
      {actionError ? (
        <div className="text-sm text-destructive">{actionError}</div>
      ) : null}

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
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleFlagToggle(user.id, user.isFlagged)}
                    >
                      {user.isFlagged ? "Unflag" : "Flag"}
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleBlockToggle(user.id, user.isBlocked)}
                    >
                      {user.isBlocked ? "Unblock" : "Block"}
                    </Button>
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

