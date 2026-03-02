import { db } from "@/server/db";
import { tickets, ticketVotes } from "@/server/db/schema";
import { and, desc, eq, lt, ne, or, sql } from "drizzle-orm";

export type PublicTicketCategory = "support" | "suggestion" | "bug";

export type PublicTicketItem = {
  id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  isPublic: boolean;
  createdAt: string; // ISO
  voteCount: number;
  userHasVoted: boolean;
};

export type TicketsPage = {
  items: PublicTicketItem[];
  nextCursor: { createdAt: string; id: string } | null;
  hasMore: boolean;
};

export async function getPublicTicketsPage(opts: {
  category: PublicTicketCategory;
  limit: number;
  cursorCreatedAt?: Date;
  cursorId?: string;
  viewerUserId?: string; // optional: mark userHasVoted
}): Promise<TicketsPage> {
  const { category, limit, cursorCreatedAt, cursorId, viewerUserId } = opts;

  const cursorWhere =
    cursorCreatedAt && cursorId
      ? or(
          lt(tickets.createdAt, cursorCreatedAt),
          and(eq(tickets.createdAt, cursorCreatedAt), lt(tickets.id, cursorId)),
        )
      : undefined;

  // Fetch limit+1 to detect hasMore
  const rows = await db
    .select({
      ticket: tickets,
      voteCount: sql<number>`
        (select count(*) from ${ticketVotes} tv where tv.ticket_id = ${tickets.id})
      `.as("voteCount"),
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.isPublic, true),
        eq(tickets.category, category),
        ne(tickets.status, "closed"),
        cursorWhere,
      ),
    )
    .orderBy(desc(tickets.createdAt), desc(tickets.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  // Mark userHasVoted if viewer is logged in
  let votedSet = new Set<string>();
  if (viewerUserId && pageRows.length) {
    const ids = pageRows.map((r) => r.ticket.id);
    const votes = await db
      .select({ ticketId: ticketVotes.ticketId })
      .from(ticketVotes)
      .where(
        and(
          eq(ticketVotes.userId, viewerUserId),
          sql`${ticketVotes.ticketId} = any(${ids})`,
        ),
      );
    // NOTE: if your dialect doesn’t like ANY(array), tell me and I’ll swap to inArray().
    votedSet = new Set(votes.map((v) => v.ticketId));
  }

  const items: PublicTicketItem[] = pageRows.map(({ ticket, voteCount }) => ({
    id: ticket.id,
    title: ticket.title,
    content: ticket.content,
    category: ticket.category,
    status: ticket.status,
    isPublic: ticket.isPublic,
    createdAt: ticket.createdAt.toISOString(),
    voteCount,
    userHasVoted: votedSet.has(ticket.id),
  }));

  const last = items.at(-1);
  const nextCursor =
    hasMore && last ? { createdAt: last.createdAt, id: last.id } : null;

  return { items, hasMore, nextCursor };
}

