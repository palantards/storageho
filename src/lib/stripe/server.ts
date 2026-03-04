import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  if (!stripeSingleton) {
    stripeSingleton = new Stripe(secretKey);
  }
  return stripeSingleton;
}
