"use server";
import { getSession } from "@/lib/auth";
import { getPublicTicketsPage } from "@/lib/support";
import { findDbUserBySupabaseId, findDbUserIdBySupabaseId } from "@/lib/users";
import { dbAdmin as db, schema } from "@/server/db";
import { ticketVotes } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import z from "zod";

async function voteAction(formData: FormData) {
  const ticketIdRaw = formData.get("ticketId");
  const ticketId = z.string().uuid().safeParse(ticketIdRaw);
  const session = await getSession();
  if (!session?.user || !ticketId.success) {
    redirect(`/`);
  }

  const ticketIdValue = ticketId.data;
  const ticket = await db.query.tickets.findFirst({
    where: eq(schema.tickets.id, ticketIdValue),
    columns: {
      id: true,
      isPublic: true,
      category: true,
      status: true,
    },
  });
  if (
    !ticket ||
    !ticket.isPublic ||
    (ticket.category !== "bug" && ticket.category !== "suggestion") ||
    ticket.status === "closed"
  ) {
    redirect(`/`);
  }

  const dbUser = await findDbUserBySupabaseId(session.user.id);
  if (!dbUser) redirect(`/`);

  const existingVote = await db.query.ticketVotes.findFirst({
    where: and(
      eq(schema.ticketVotes.userId, dbUser.id),
      eq(schema.ticketVotes.ticketId, ticketIdValue),
    ),
  });
  if (existingVote) {
    await db
      .delete(ticketVotes)
      .where(
        and(
          eq(schema.ticketVotes.userId, dbUser.id),
          eq(schema.ticketVotes.ticketId, ticketIdValue),
        ),
      );
  } else {
    // Not voted yet, insert a new vote
    await db.insert(ticketVotes).values({
      userId: dbUser.id,
      ticketId: ticketIdValue,
    });
  }
  // After updating, the page will reload and show updated counts
}

const Schema = z.object({
  category: z.enum(["support", "suggestion", "bug"]),
  limit: z.number().int().min(1).max(50).default(10),
  cursorCreatedAt: z.string().datetime().optional(), // ISO string
  cursorId: z.string().uuid().optional(),
});

async function loadPublicTicketsAction(input: z.infer<typeof Schema>) {
  const { category, limit, cursorCreatedAt, cursorId } = Schema.parse(input);

  const session = await getSession();
  const viewerDbUserId = session?.user?.id
    ? (await findDbUserIdBySupabaseId(session.user.id))?.id
    : undefined;

  return getPublicTicketsPage({
    category,
    limit,
    cursorCreatedAt: cursorCreatedAt ? new Date(cursorCreatedAt) : undefined,
    cursorId,
    viewerDbUserId,
  });
}

export { voteAction, loadPublicTicketsAction };
