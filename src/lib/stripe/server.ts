import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
const apiVersion =
  (process.env.STRIPE_API_VERSION as Stripe.StripeConfig["apiVersion"]) ||
  "2025-12-15.clover";

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

let stripeSingleton: Stripe | null = null;

export function getStripe() {
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(secretKey, {
      apiVersion,
    });
  }
  return stripeSingleton;
}
