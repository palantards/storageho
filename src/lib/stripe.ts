import Stripe from "stripe";

import { getStripe } from "@/lib/stripe/server";

const SUPABASE_USER_METADATA_KEY = "supabase_user_id";

function stripeClient() {
  return getStripe();
}

function buildCustomerMetadata(input: {
  supabaseUserId: string;
  company?: string;
}) {
  return {
    [SUPABASE_USER_METADATA_KEY]: input.supabaseUserId,
    ...(input.company ? { company: input.company } : {}),
  };
}

/**
 * Ensure a Stripe Customer exists for the given user details.
 * Returns the Stripe Customer ID.
 */
export async function ensureStripeCustomer({
  supabaseUserId,
  email,
  name,
  company,
}: {
  supabaseUserId: string;
  email: string;
  name?: string;
  company?: string;
}): Promise<string> {
  const stripe = stripeClient();

  const metadataMatch = await stripe.customers.search({
    query: `metadata['${SUPABASE_USER_METADATA_KEY}']:'${supabaseUserId}'`,
    limit: 1,
  });

  const existingCustomer = metadataMatch.data[0];
  if (existingCustomer) {
    const nextName = name ?? existingCustomer.name ?? undefined;
    const nextMetadata = {
      ...existingCustomer.metadata,
      ...buildCustomerMetadata({ supabaseUserId, company }),
    };
    const needsUpdate =
      existingCustomer.email !== email ||
      existingCustomer.name !== nextName ||
      existingCustomer.metadata?.[SUPABASE_USER_METADATA_KEY] !==
        supabaseUserId ||
      (company ? existingCustomer.metadata?.company !== company : false);

    if (needsUpdate) {
      await stripe.customers.update(existingCustomer.id, {
        email,
        name: nextName,
        metadata: nextMetadata,
      });
    }

    return existingCustomer.id;
  }

  const emailMatches = await stripe.customers.list({
    email,
    limit: 10,
  });

  const legacyCustomer =
    emailMatches.data.length === 1 &&
    !emailMatches.data[0].metadata?.[SUPABASE_USER_METADATA_KEY]
      ? emailMatches.data[0]
      : null;

  if (legacyCustomer) {
    await stripe.customers.update(legacyCustomer.id, {
      email,
      name: name ?? legacyCustomer.name ?? undefined,
      metadata: {
        ...legacyCustomer.metadata,
        ...buildCustomerMetadata({ supabaseUserId, company }),
      },
    });

    return legacyCustomer.id;
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: buildCustomerMetadata({ supabaseUserId, company }),
  });
  return customer.id;
}

/**
 * Create a Stripe Checkout Session for a subscription to the given price.
 * Returns an object with the session ID and URL.
 */
export async function createCheckoutSession({
  priceId,
  successUrl,
  cancelUrl,
  customerId,
}: {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId: string;
}) {
  const stripe = stripeClient();

  const successWithSession =
    successUrl.includes("{CHECKOUT_SESSION_ID}") ||
    successUrl.includes("session_id=")
      ? successUrl
      : successUrl +
        (successUrl.includes("?") ? "&" : "?") +
        "session_id={CHECKOUT_SESSION_ID}";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: successWithSession,
    cancel_url: cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
    customer: customerId,
  });

  return { id: session.id, url: session.url! };
}

/**
 * Create a Stripe billing portal session link for a customer.
 * Returns an object with the portal URL.
 */
export async function createBillingPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  const stripe = stripeClient();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: portalSession.url! };
}

/**
 * Fetch the latest Stripe Subscription for a given customer, if any.
 * Used to repair missing subscription records or to get updated status.
 */
export async function fetchLatestStripeSubscription(
  customerId: string,
): Promise<Stripe.Subscription | null> {
  const stripe = stripeClient();
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 1,
  });
  return subs.data[0] ?? null;
}
