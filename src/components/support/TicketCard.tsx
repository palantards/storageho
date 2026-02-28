"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { voteAction } from "@/app/[locale]/(marketing)/support/action";
import { Loader2, ThumbsUp, ChevronDown, ChevronUp } from "lucide-react";
import type { Session } from "@/lib/auth";
import { PublicTicketItem } from "@/lib/support";

function statusLabel(status: string) {
  if (status === "in_progress") return "In progress";
  if (status === "done") return "Completed";
  if (status === "planned") return "Planned";
  if (status === "new") return "Planned";
  return status;
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "in_progress") return "secondary";
  if (status === "done") return "outline";
  return "default";
}

export function TicketCard({
  ticket,
  session,
}: {
  ticket: PublicTicketItem;
  session: Session | null;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [isVoting, startVote] = React.useTransition();

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium leading-tight truncate">
              {ticket.title}
            </h3>
            <Badge variant={statusVariant(ticket.status)}>
              {statusLabel(ticket.status)}
            </Badge>
          </div>
        </div>

        <div className="shrink-0">
          {session?.user ? (
            <form
              action={voteAction}
              onSubmit={(e) => {
                // Optional UX: show spinner during action submit
                startVote(async () => {});
              }}
            >
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Button
                type="submit"
                variant={ticket.userHasVoted ? "ghost" : "secondary"}
                size="sm"
                disabled={isVoting}
                className="gap-2"
              >
                {isVoting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="h-4 w-4" />
                )}
                {ticket.voteCount}
              </Button>
            </form>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Login to vote"
              className="gap-2"
            >
              <ThumbsUp className="h-4 w-4" />
              {ticket.voteCount}
            </Button>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <p className={expanded ? "whitespace-pre-wrap" : "line-clamp-2"}>
          {ticket.content}
        </p>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 px-0 h-auto text-xs text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <span className="inline-flex items-center gap-1">
              Read less <ChevronUp className="h-3 w-3" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              Read more <ChevronDown className="h-3 w-3" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
