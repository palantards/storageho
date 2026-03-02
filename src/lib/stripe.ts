import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
// Initialize Stripe client if key is available
const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: "2025-12-15.clover" })
  : undefined;

if (!stripeSecret) {
  console.warn("Stripe secret key not set – Stripe API calls are disabled.");
}

/**
 * Ensure a Stripe Customer exists for the given user details.
 * Returns the Stripe Customer ID.
 */
export async function ensureStripeCustomer({
  email,
  name,
  company,
}: {
  email: string;
  name?: string;
  company?: string;
}): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY)");
  }
  // Try to find an existing customer by email to avoid duplicates
  const existingCustomers = await stripe.customers.search({
    query: `email:'${email}'`,
  });
  if (existingCustomers.data.length > 0) {
    const existing = existingCustomers.data[0];
    return existing.id;
  }
  // Create a new customer with the provided info
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: company ? { company } : undefined,
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
  customerEmail,
}: {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  customerEmail?: string;
}) {
  if (!stripe) {
    throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY)");
  }
  // Ensure the success URL contains the session_id if not already present
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
    // Use existing customer if we have one, otherwise let Stripe create a new customer using email
    ...(customerId
      ? { customer: customerId }
      : { customer_email: customerEmail }),
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
  if (!stripe) {
    throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY)");
  }
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
  customerId: string
): Promise<Stripe.Subscription | null> {
  if (!stripe) {
    throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY)");
  }
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 1,
  });
  if (subs.data.length === 0) return null;
  return subs.data[0];
}

