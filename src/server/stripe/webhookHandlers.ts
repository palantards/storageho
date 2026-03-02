import "server-only";

import crypto from "node:crypto";
import Stripe from "stripe";
import { eq } from "drizzle-orm";

import { db, schema } from "../db";

const { subscriptions, users, webhookEvents } = schema;

export type WebhookStatus =
  (typeof schema.webhookStatusEnum.enumValues)[number];

export function hashPayload(rawBody: string) {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

export async function findUserByStripeCustomerId(stripeCustomerId: string) {
  if (!stripeCustomerId) return null;
  return db.query.users.findFirst({
    where: eq(users.stripeCustomerId, stripeCustomerId),
  });
}

export async function upsertSubscriptionFromStripe({
  subscription,
  userId,
  stripeCustomerId,
}: {
  subscription: Stripe.Subscription;
  userId: string;
  stripeCustomerId: string;
}) {
  const price = subscription.items.data[0]?.price;

  const currentPeriodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : null;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  const canceledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000)
    : null;
  const trialStart = subscription.trial_start
    ? new Date(subscription.trial_start * 1000)
    : null;
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;

  const priceId = typeof price?.id === "string" ? price.id : null;
  const productId = typeof price?.product === "string" ? price.product : null;

  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId,
      status: subscription.status,
      priceId,
      productId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      canceledAt,
      trialStart,
      trialEnd,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        userId,
        stripeCustomerId,
        status: subscription.status,
        priceId,
        productId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        canceledAt,
        trialStart,
        trialEnd,
        updatedAt: new Date(),
      },
    });
}

export async function markEventProcessed({
  eventId,
  type,
  created,
  status,
  processedAt = new Date(),
  payloadHash,
  error,
}: {
  eventId: string;
  type: string;
  created: number;
  status: WebhookStatus;
  processedAt?: Date;
  payloadHash?: string;
  error?: string | null;
}) {
  const createdAt = new Date(created * 1000);
  await db
    .insert(webhookEvents)
    .values({
      stripeEventId: eventId,
      type,
      created: createdAt,
      processedAt,
      payloadHash,
      status,
      error: error ?? null,
    })
    .onConflictDoUpdate({
      target: webhookEvents.stripeEventId,
      set: {
        processedAt,
        status,
        error: error ?? null,
        payloadHash,
        updatedAt: new Date(),
      },
    });
}

export async function getWebhookEventStatus(eventId: string) {
  return db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.stripeEventId, eventId),
  });
}

