import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

import { getStripe } from "@/lib/stripe/server";
import {
  claimWebhookEvent,
  findUserByStripeCustomerId,
  hashPayload,
  markEventProcessed,
  upsertSubscriptionFromStripe,
  type FinalWebhookStatus,
} from "@/server/stripe/webhookHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Webhook is not configured" },
      { status: 503 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 },
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Invalid Stripe signature";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  const payloadHash = hashPayload(rawBody);
  const claim = await claimWebhookEvent({
    eventId: event.id,
    type: event.type,
    created: event.created,
    payloadHash,
  });

  if (!claim.claimed) {
    if (claim.status === "processing") {
      return NextResponse.json(
        { error: "Webhook event is already being processed" },
        { status: 409 },
      );
    }

    return NextResponse.json({ received: true, status: claim.status });
  }

  let status: FinalWebhookStatus = "processed";
  let errorMessage: string | undefined;

  try {
    status = await handleStripeEvent(event);
  } catch (err) {
    status = "failed";
    errorMessage =
      err instanceof Error ? err.message : "Webhook handler failure";
  }

  await markEventProcessed({
    eventId: event.id,
    type: event.type,
    created: event.created,
    status,
    payloadHash,
    error: errorMessage,
  });

  if (status === "failed") {
    return NextResponse.json(
      { error: errorMessage || "Webhook handler failure" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true, status });
}

async function handleStripeEvent(
  event: Stripe.Event,
): Promise<FinalWebhookStatus> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscriptionEvent(event.data.object as Stripe.Subscription);
    case "invoice.paid":
    case "invoice.payment_failed":
      return handleInvoiceEvent(event.data.object as Stripe.Invoice);
    default:
      return "ignored";
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<FinalWebhookStatus> {
  const stripe = getStripe();
  const customerId = getCustomerId(session.customer);
  const subscriptionId = getSubscriptionId(session.subscription);

  if (!customerId || !subscriptionId) {
    throw new Error("Checkout session is missing customer or subscription");
  }

  const user = await findUserByStripeCustomerId(customerId);
  if (!user) {
    throw new Error(`No user found for Stripe customer ${customerId}`);
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  await upsertSubscriptionFromStripe({
    subscription,
    stripeCustomerId: customerId,
    userId: user.id,
  });

  return "processed";
}

async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
): Promise<FinalWebhookStatus> {
  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    throw new Error("Subscription event missing customer");
  }

  const user = await findUserByStripeCustomerId(customerId);
  if (!user) {
    throw new Error(`No user found for Stripe customer ${customerId}`);
  }

  await upsertSubscriptionFromStripe({
    subscription,
    stripeCustomerId: customerId,
    userId: user.id,
  });

  return "processed";
}
async function handleInvoiceEvent(
  invoice: Stripe.Invoice,
): Promise<FinalWebhookStatus> {
  const stripe = getStripe();
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : (invoice.customer?.id ?? null);

  const subscriptionId = getSubscriptionId(
    (invoice as unknown as { subscription?: unknown }).subscription,
  );

  if (!customerId || !subscriptionId) return "ignored";

  const user = await findUserByStripeCustomerId(customerId);
  if (!user) throw new Error(`No user found for Stripe customer ${customerId}`);

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  await upsertSubscriptionFromStripe({
    subscription,
    stripeCustomerId: customerId,
    userId: user.id,
  });

  return "processed";
}

function getCustomerId(
  customer:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | null
    | undefined,
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id || null;
}

function getSubscriptionId(subscription: unknown): string | null {
  if (!subscription) return null;
  if (typeof subscription === "string") return subscription;
  if (
    typeof subscription === "object" &&
    subscription &&
    "id" in subscription &&
    typeof subscription.id === "string"
  ) {
    return subscription.id;
  }
  return null;
}
