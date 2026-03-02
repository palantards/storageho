import { desc, eq } from "drizzle-orm";

import { formatPlanName, formatSubscriptionStatus } from "@/config/billing";
import { db, schema } from "@/server/db";
import { fetchLatestStripeSubscription } from "@/lib/stripe";
import { upsertSubscriptionFromStripe } from "@/server/stripe/webhookHandlers";

type BillingState = {
  planLabel: string;
  statusLabel: string;
  renewalDate: string;
  subscriptionExists: boolean;
};

const developerStripeRepair = process.env.STRIPE_REPAIR_IF_MISSING === "true";

export async function getSubscriptionFromDb(userId: string) {
  return db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, userId),
    orderBy: [desc(schema.subscriptions.updatedAt)],
  });
}

export async function billingState({
  userId,
  stripeCustomerId,
  t,
}: {
  userId: string;
  stripeCustomerId?: string | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
}): Promise<BillingState> {
  let subscription = userId ? await getSubscriptionFromDb(userId) : null;

  if (
    !subscription &&
    developerStripeRepair &&
    stripeCustomerId &&
    process.env.STRIPE_SECRET_KEY
  ) {
    const latest = await fetchLatestStripeSubscription(stripeCustomerId);
    if (latest) {
      await upsertSubscriptionFromStripe({
        subscription: latest,
        userId,
        stripeCustomerId,
      });
      subscription = await getSubscriptionFromDb(userId);
    }
  }

  const planLabel = subscription
    ? formatPlanName({
        priceId: subscription.priceId,
        productId: subscription.productId,
        t,
      })
    : t("profile.subscription.freePlan");

  const statusLabel = subscription
    ? formatSubscriptionStatus(subscription.status, t)
    : t("profile.subscription.status.free");

  const renewalDate = subscription?.currentPeriodEnd
    ? subscription.currentPeriodEnd.toISOString().slice(0, 10)
    : t("profile.subscription.planHint");

  return {
    planLabel,
    statusLabel,
    renewalDate,
    subscriptionExists: Boolean(subscription),
  };
}

