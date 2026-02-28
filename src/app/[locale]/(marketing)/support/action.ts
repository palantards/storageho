"use server";
import { getSession } from "@/lib/auth";
import { getPublicTicketsPage, PublicTicketCategory } from "@/lib/support";
import { db, schema } from "@/server/db";
import { ticketVotes } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import z from "zod";

async function voteAction(formData: FormData) {
  const ticketId = formData.get("ticketId") as string;
  const session = await getSession();
  if (!session?.user || !ticketId) {
    redirect(`/`);
  }
  const dbUser = await db.query.users.findFirst({
    where: eq(schema.users.supabaseUserId, session.user.id),
  });
  if (!dbUser) redirect(`/`);

  const existingVote = await db.query.ticketVotes.findFirst({
    where:
      eq(schema.ticketVotes.userId, dbUser.id) &&
      eq(schema.ticketVotes.ticketId, ticketId),
  });
  if (existingVote) {
    await db
      .delete(ticketVotes)
      .where(
        eq(schema.ticketVotes.userId, dbUser.id) &&
          eq(schema.ticketVotes.ticketId, ticketId),
      );
  } else {
    // Not voted yet, insert a new vote
    await db.insert(ticketVotes).values({
      userId: dbUser.id,
      ticketId: ticketId,
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
  const viewerUserId = session?.user?.id;

  return getPublicTicketsPage({
    category: category as PublicTicketCategory,
    limit,
    cursorCreatedAt: cursorCreatedAt ? new Date(cursorCreatedAt) : undefined,
    cursorId,
    viewerUserId,
  });
}

export { voteAction, loadPublicTicketsAction };
