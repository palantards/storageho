import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

const DEFAULT_STRIPE_API_VERSION =
  Stripe.API_VERSION as Stripe.LatestApiVersion;

function resolveStripeApiVersion(): Stripe.LatestApiVersion {
  const configured = process.env.STRIPE_API_VERSION?.trim();
  if (!configured) {
    return DEFAULT_STRIPE_API_VERSION;
  }

  return configured as Stripe.LatestApiVersion;
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  if (!stripeSingleton) {
    stripeSingleton = new Stripe(secretKey, {
      apiVersion: resolveStripeApiVersion(),
      maxNetworkRetries: 2,
    });
  }
  return stripeSingleton;
}
