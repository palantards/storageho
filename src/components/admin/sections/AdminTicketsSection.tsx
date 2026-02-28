"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  loadTicketsAction,
  updateTicketAction,
} from "@/app/[locale]/(app)/admin/actions";
import { AdminTicketRow } from "@/lib/admin/tickets";

const LIMIT = 30;
// TODO FIX THIS,.
export function AdminTicketsSection({}: {}) {
  const [rows, setRows] = React.useState([] as AdminTicketRow[]);
  const [offset, setOffset] = React.useState(LIMIT);
  const [hasMore, setHasMore] = React.useState(false);

  const [status, setStatus] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [q, setQ] = React.useState("");

  const [isPending, startTransition] = React.useTransition();
  React.useEffect(() => {
    load(0, true);
  }, []);

  const load = (nextOffset: number, reset = false) => {
    startTransition(async () => {
      const data = await loadTicketsAction({
        offset: nextOffset,
        limit: LIMIT,
        status: status === "all" ? undefined : status,
        category: category === "all" ? undefined : category,
        q: q.trim() ? q.trim() : undefined,
      });

      if (reset) {
        setRows(data);
        setOffset(LIMIT);
      } else {
        setRows((prev) => [...prev, ...data]);
        setOffset((prev) => prev + LIMIT);
      }

      setHasMore(data.length === LIMIT);
    });
  };

  const refresh = () => load(0, true);

  const update = (ticketId: string, patch: any) => {
    // optimistic
    setRows((prev) =>
      prev.map((r) =>
        r.ticket.id === ticketId
          ? { ...r, ticket: { ...r.ticket, ...patch } }
          : r,
      ),
    );

    startTransition(async () => {
      try {
        await updateTicketAction({ ticketId, ...patch });
      } catch {
        // simplest: reload page 0 to revert if anything fails
        await loadTicketsAction({
          offset: 0,
          limit: LIMIT,
          status: status === "all" ? undefined : status,
          category: category === "all" ? undefined : category,
          q: q.trim() ? q.trim() : undefined,
        }).then((data) => {
          setRows(data);
          setOffset(LIMIT);
          setHasMore(data.length === LIMIT);
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-[180px]">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["new", "planned", "in_progress", "done", "closed"].map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-[200px]">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {["support", "suggestion", "bug"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-[320px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
            />
          </div>

          <Button onClick={refresh} disabled={isPending}>
            Apply
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          {isPending ? (
            "Loading…"
          ) : (
            <>
              Showing <b>{rows.length}</b>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-background overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left py-3 px-4">Title</th>
              <th className="text-left py-3 px-4">Category</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-right py-3 px-4">Votes</th>
              <th className="text-center py-3 px-4">Public</th>
              <th className="text-right py-3 px-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.ticket.id} className="border-t align-top">
                <td className="py-3 px-4">
                  <div className="font-medium">{r.ticket.title}</div>
                  <div className="text-muted-foreground line-clamp-2 max-w-[560px]">
                    {r.ticket.content}
                  </div>
                </td>

                <td className="py-3 px-4">
                  <Select
                    value={r.ticket.category}
                    onValueChange={(v) => update(r.ticket.id, { category: v })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["support", "suggestion", "bug"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>

                <td className="py-3 px-4">
                  <Select
                    value={r.ticket.status}
                    onValueChange={(v) => update(r.ticket.id, { status: v })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["new", "planned", "in_progress", "done", "closed"].map(
                        (s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </td>

                <td className="py-3 px-4 text-right">
                  <Badge variant="secondary">{r.voteCount}</Badge>
                </td>

                <td className="py-3 px-4">
                  <div className="flex justify-center">
                    <Switch
                      checked={r.ticket.isPublic}
                      onCheckedChange={(checked) =>
                        update(r.ticket.id, { isPublic: checked })
                      }
                    />
                  </div>
                </td>

                <td className="py-3 px-4 text-right whitespace-nowrap">
                  {r.ticket.category === "suggestion" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        update(r.ticket.id, { action: "convert_to_bug" })
                      }
                      disabled={isPending}
                    >
                      Convert to bug
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between p-4 border-t">
          <div className="text-sm text-muted-foreground">
            {isPending
              ? "Loading…"
              : hasMore
                ? "More available"
                : "End of list"}
          </div>

          {hasMore ? (
            <Button onClick={() => load(offset, false)} disabled={isPending}>
              Load more
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
