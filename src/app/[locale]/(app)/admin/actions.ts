"use server";

import { z } from "zod";
import { db } from "@/server/db";
import {
  tickets,
  ticketVotes,
  users,
  profiles,
  supportRequests,
} from "@/server/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin/requireAdmin";

const LoadSchema = z.object({
  offset: z.number().int().min(0),
  limit: z.number().int().min(1).max(100).default(30),
  status: z.string().optional(),
  category: z.string().optional(),
  q: z.string().optional(),
});

export type AdminTicketRow = {
  ticket: typeof tickets.$inferSelect;
  reporterEmail: string | null;
  reporterName: string | null;
  voteCount: number;
};

export async function loadTicketsAction(input: z.infer<typeof LoadSchema>) {
  const guard = await requireAdmin();
  if (!guard.ok) throw new Error("Forbidden");

  const { offset, limit, status, category, q } = LoadSchema.parse(input);

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

  const rows = await db
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

  return rows as AdminTicketRow[];
}

const UpdateSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.string().optional(),
  category: z.string().optional(),
  isPublic: z.boolean().optional(),
  action: z.enum(["convert_to_bug"]).optional(),
});

const ALLOWED_STATUS = [
  "new",
  "planned",
  "in_progress",
  "done",
  "closed",
] as const;
const ALLOWED_CATEGORY = ["support", "suggestion", "bug"] as const;

export async function updateTicketAction(input: z.infer<typeof UpdateSchema>) {
  const guard = await requireAdmin();
  if (!guard.ok) throw new Error("Forbidden");

  const { ticketId, status, category, isPublic, action } =
    UpdateSchema.parse(input);

  const patch: Partial<typeof tickets.$inferInsert> = {};

  if (typeof status === "string") {
    if (!ALLOWED_STATUS.includes(status as (typeof ALLOWED_STATUS)[number]))
      throw new Error("Invalid status");
    patch.status = status;
  }

  if (typeof category === "string") {
    if (!ALLOWED_CATEGORY.includes(category as (typeof ALLOWED_CATEGORY)[number]))
      throw new Error("Invalid category");
    patch.category = category;
  }

  if (typeof isPublic === "boolean") patch.isPublic = isPublic;

  if (action === "convert_to_bug") {
    patch.category = "bug";
    patch.status = "planned";
    patch.isPublic = true;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  await db.update(tickets).set(patch).where(eq(tickets.id, ticketId));
  return { ok: true };
}

const LoadSupportSchema = z.object({
  offset: z.number().int().min(0),
  limit: z.number().int().min(1).max(100).default(30),
  status: z.enum(["open", "closed"]).optional(), // "open" | "closed"
  q: z.string().optional(),
});

export type AdminSupportRow = {
  request: typeof supportRequests.$inferSelect;
};

export async function loadSupportRequestsAction(
  input: z.infer<typeof LoadSupportSchema>,
) {
  const guard = await requireAdmin();
  if (!guard.ok) throw new Error("Forbidden");

  const { offset, limit, status, q } = LoadSupportSchema.parse(input);

  const where = and(
    status ? eq(supportRequests.status, status) : undefined,
    q
      ? or(
          ilike(supportRequests.email, `%${q}%`),
          ilike(supportRequests.subject, `%${q}%`),
          ilike(supportRequests.message, `%${q}%`),
        )
      : undefined,
  );

  const rows = await db
    .select({ request: supportRequests })
    .from(supportRequests)
    .where(where)
    .orderBy(desc(supportRequests.createdAt))
    .limit(limit)
    .offset(offset);

  return rows as AdminSupportRow[];
}

const UpdateSupportSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["open", "closed"]).optional(),
});

export async function updateSupportRequestAction(
  input: z.infer<typeof UpdateSupportSchema>,
) {
  const guard = await requireAdmin();
  if (!guard.ok) throw new Error("Forbidden");

  const { requestId, status } = UpdateSupportSchema.parse(input);
  if (!status) return { ok: true };

  await db
    .update(supportRequests)
    .set({ status })
    .where(eq(supportRequests.id, requestId));

  return { ok: true };
}

const ConvertSchema = z.object({
  requestId: z.string().uuid(),
  category: z.enum(["support", "suggestion", "bug"]).default("support"),
  makePublic: z.boolean().default(false),
});

export async function convertSupportRequestToTicketAction(
  input: z.infer<typeof ConvertSchema>,
) {
  const guard = await requireAdmin();
  if (!guard.ok) throw new Error("Forbidden");

  const { requestId, category, makePublic } = ConvertSchema.parse(input);

  const reqRow = await db.query.supportRequests.findFirst({
    where: eq(supportRequests.id, requestId),
  });
  if (!reqRow) throw new Error("Request not found");

  // If already linked to a ticket, return it
  if (reqRow.ticketId) {
    return { ok: true, ticketId: reqRow.ticketId };
  }

  const [created] = await db
    .insert(tickets)
    .values({
      userId: reqRow.userId ?? null,
      email: reqRow.email,
      title: reqRow.subject,
      content: reqRow.message,
      category,
      status: "new",
      isPublic: makePublic,
    })
    .returning({ id: tickets.id });

  await db
    .update(supportRequests)
    .set({ ticketId: created.id, status: "closed" })
    .where(eq(supportRequests.id, requestId));

  return { ok: true, ticketId: created.id };
}
