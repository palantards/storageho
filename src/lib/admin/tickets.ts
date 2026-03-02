// src/lib/admin/tickets.ts
import { db } from "@/server/db";
import { tickets, users, profiles, ticketVotes } from "@/server/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

export type TicketCategory = "support" | "suggestion" | "bug";
export type TicketStatus =
  | "new"
  | "planned"
  | "in_progress"
  | "done"
  | "closed";

export type AdminTicketRow = {
  ticket: typeof tickets.$inferSelect;
  reporterEmail: string | null;
  reporterName: string | null;
  voteCount: number;
};

export async function getAdminTickets(opts: {
  offset: number;
  limit: number;
  status?: string;
  category?: string;
  q?: string;
}): Promise<AdminTicketRow[]> {
  const { offset, limit, status, category, q } = opts;

  const where = and(
    status ? eq(tickets.status, status) : undefined,
    category ? eq(tickets.category, category) : undefined,
    q
      ? or(
          ilike(tickets.title, `%${q}%`),
          ilike(tickets.content, `%${q}%`),
          ilike(users.email, `%${q}%`),
          ilike(profiles.name, `%${q}%`),
        )
      : undefined,
  );

  return db
    .select({
      ticket: tickets,
      reporterEmail: users.email,
      reporterName: profiles.name,
      voteCount: sql<number>`
        (select count(*) from ${ticketVotes} tv where tv.ticket_id = ${tickets.id})
      `.as("voteCount"),
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.userId, users.id))
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .where(where)
    .orderBy(desc(tickets.createdAt))
    .limit(limit)
    .offset(offset);
}

