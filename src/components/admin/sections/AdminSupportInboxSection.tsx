"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdminSupportRow,
  loadSupportRequestsAction,
  updateSupportRequestAction,
  convertSupportRequestToTicketAction,
} from "@/app/[locale]/(app)/admin/actions";

const LIMIT = 30;
type SupportStatusFilter = "all" | "open" | "closed";
type SupportStatus = "open" | "closed";

export function AdminSupportInboxSection() {
  const [rows, setRows] = React.useState<AdminSupportRow[]>([]);
  const [offset, setOffset] = React.useState(LIMIT);
  const [hasMore, setHasMore] = React.useState(false);

  const [status, setStatus] = React.useState<SupportStatusFilter>("open");
  const [q, setQ] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const load = (nextOffset: number, reset = false) => {
    startTransition(async () => {
      const statusParam: SupportStatus | undefined =
        status === "all" ? undefined : status;

      const data = await loadSupportRequestsAction({
        offset: nextOffset,
        limit: LIMIT,
        status: statusParam,
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

  React.useEffect(() => {
    load(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = () => load(0, true);

  const closeReq = (id: string) =>
    startTransition(async () => {
      await updateSupportRequestAction({ requestId: id, status: "closed" });
      await load(0, true);
    });

  const convert = (id: string, category: "support" | "suggestion" | "bug") =>
    startTransition(async () => {
      await convertSupportRequestToTicketAction({
        requestId: id,
        category,
        makePublic: category !== "support",
      });
      await load(0, true);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-[180px]">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as SupportStatusFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-[360px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email / subject / message"
            />
          </div>

          <Button onClick={apply} disabled={isPending}>
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
              <th className="text-left py-3 px-4">Subject</th>
              <th className="text-left py-3 px-4">From</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-right py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ request }) => (
              <tr key={request.id} className="border-t align-top">
                <td className="py-3 px-4">
                  <div className="font-medium">{request.subject}</div>
                  <div className="text-muted-foreground line-clamp-2 max-w-[720px]">
                    {request.message}
                  </div>
                  {request.ticketId ? (
                    <div className="mt-2">
                      <Badge variant="secondary">Linked to ticket</Badge>
                    </div>
                  ) : null}
                </td>

                <td className="py-3 px-4">
                  <div className="font-medium">{request.email}</div>
                </td>

                <td className="py-3 px-4">
                  <Badge
                    variant={
                      request.status === "open" ? "destructive" : "secondary"
                    }
                  >
                    {request.status}
                  </Badge>
                </td>

                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <div className="flex justify-end gap-2">
                    {!request.ticketId ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => convert(request.id, "support")}
                          disabled={isPending}
                        >
                          To ticket
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => convert(request.id, "suggestion")}
                          disabled={isPending}
                        >
                          To suggestion
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => convert(request.id, "bug")}
                          disabled={isPending}
                        >
                          To bug
                        </Button>
                      </>
                    ) : null}

                    {request.status !== "closed" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => closeReq(request.id)}
                        disabled={isPending}
                      >
                        Close
                      </Button>
                    ) : null}
                  </div>
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

