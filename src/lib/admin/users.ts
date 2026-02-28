import { db, schema } from "@/server/db";
import { users, subscriptions, profiles, tickets } from "@/server/db/schema";
import { sql, inArray, eq, InferSelectModel, and, gte, ne } from "drizzle-orm";

export type UserWithProfileAndSubscription = {
  users: InferSelectModel<typeof users>;
  subscriptions: InferSelectModel<typeof subscriptions> | null;
  profiles: InferSelectModel<typeof profiles> | null;
};
export type AdminStats = {
  totalUserCount: number;
  payingCount: number;
  freeCount: number;
  monthlyRevenue: number;
  newTickets7d: number;
  openTickets: number;
};
export const getUsers = async ({
  offset,
  limit,
}: {
  offset: number;
  limit: number;
}): Promise<UserWithProfileAndSubscription[]> => {
  return db
    .select()
    .from(users)
    .limit(limit)
    .offset(offset)
    .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
    .leftJoin(profiles, eq(users.id, schema.profiles.userId));
};
export const getAdminStats = async (): Promise<AdminStats> => {
  const totalUsers = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);
  const totalUserCount = Number(totalUsers[0]?.count) || 0;

  // Count paying members (those with an active subscription):
  const payingSubs = await db
    .select({ count: sql<number>`count(distinct user_id)` })
    .from(subscriptions)
    .where(inArray(schema.subscriptions.status, ["active", "trialing"])); // consider trialing as "signed up"
  const payingCount = Number(payingSubs[0]?.count) || 0;
  const freeCount = totalUserCount - payingCount;

  // Calculate revenue (MRR) from active subscriptions:
  let monthlyRevenue = 0;
  if (payingCount > 0) {
    // Example: count how many pro vs business subscriptions
    const proPriceId = process.env.STRIPE_PRICE_PRO_ID;
    const businessPriceId = process.env.STRIPE_PRICE_BUSINESS_ID;
    if (!proPriceId || !businessPriceId) {
      throw new Error("Stripe price IDs are not configured.");
    }
    const proSubs = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.priceId, proPriceId),
          eq(subscriptions.status, "active"),
        ),
      );
    const businessSubs = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.priceId, businessPriceId),
          eq(subscriptions.status, "active"),
        ),
      );
    const proCount = Number(proSubs[0]?.count) || 0;
    const businessCount = Number(businessSubs[0]?.count) || 0;
    // Assuming Pro = $29/mo and Business = $79/mo as per your pricing:
    monthlyRevenue = proCount * 29 + businessCount * 79;
  }
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [{ count: newTickets7d }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tickets)
    .where(gte(tickets.createdAt, sevenDaysAgo));

  // If your "closed" status is something else, change this value.
  const [{ count: openTickets }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tickets)
    .where(ne(tickets.status, "closed"));

  return {
    totalUserCount,
    payingCount,
    freeCount,
    monthlyRevenue,

    newTickets7d,
    openTickets,
  };
};
