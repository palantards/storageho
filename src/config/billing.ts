export type PlanId = "starter" | "pro" | "business";

export type PlanDefinition = {
  id: PlanId;
  labelKey: string;
  descriptionKey: string;
  priceKey: string;
  featuresKey?: string;
  highlight?: boolean;
  stripePriceEnvVarName: string;
  // New fields for Stripe integration:
  productName: string;
  defaultPriceCents: number;
  defaultPriceCurrency: string;
  defaultPriceInterval: "month" | "year";
};

export const planDefinitions: PlanDefinition[] = [
  {
    id: "starter",
    labelKey: "pricing.tiers.starter.title",
    descriptionKey: "pricing.tiers.starter.description",
    priceKey: "pricing.tiers.starter.price",
    featuresKey: "pricing.tiers.starter.features",
    highlight: false,
    stripePriceEnvVarName: "STRIPE_PRICE_STARTER_ID",
    productName: "Starter",
    defaultPriceCents: 0,
    defaultPriceCurrency: "usd",
    defaultPriceInterval: "month",
  },
  {
    id: "pro",
    labelKey: "pricing.tiers.pro.title",
    descriptionKey: "pricing.tiers.pro.description",
    priceKey: "pricing.tiers.pro.price",
    featuresKey: "pricing.tiers.pro.features",
    highlight: true,
    stripePriceEnvVarName: "STRIPE_PRICE_PRO_ID",
    productName: "Pro",
    defaultPriceCents: 2900, // $29.00 in cents
    defaultPriceCurrency: "usd",
    defaultPriceInterval: "month",
  },
  {
    id: "business",
    labelKey: "pricing.tiers.business.title",
    descriptionKey: "pricing.tiers.business.description",
    priceKey: "pricing.tiers.business.price",
    featuresKey: "pricing.tiers.business.features",
    highlight: false,
    stripePriceEnvVarName: "STRIPE_PRICE_BUSINESS_ID",
    productName: "Business",
    defaultPriceCents: 7900, // $79.00 in cents
    defaultPriceCurrency: "usd",
    defaultPriceInterval: "month",
  },
];

// Helper to get the Stripe Price ID from env for a given plan
export function getPriceIdForPlan(planId: PlanId): string | undefined {
  const plan = planDefinitions.find((p) => p.id === planId);
  if (!plan) return undefined;
  return process.env[plan.stripePriceEnvVarName];
}

export function getPlanIdByPriceId(priceId?: string | null): PlanId | null {
  if (!priceId) return null;
  const match = planDefinitions.find(
    (p) => process.env[p.stripePriceEnvVarName] === priceId,
  );
  return match?.id ?? null;
}

export function getPlanLabel(
  plan: PlanDefinition,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  return t(plan.labelKey);
}

export function getPlanDescription(
  plan: PlanDefinition,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  return t(plan.descriptionKey);
}

export function getPlanPrice(
  plan: PlanDefinition,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  return t(plan.priceKey);
}

export function formatPlanName({
  priceId,
  productId,
  t,
}: {
  priceId?: string | null;
  productId?: string | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const planId = getPlanIdByPriceId(priceId || undefined);
  if (planId) {
    const def = planDefinitions.find((p) => p.id === planId)!;
    return getPlanLabel(def, t);
  }
  if (productId) return productId;
  if (priceId) return priceId;
  return t("profile.subscription.freePlan");
}

export function formatSubscriptionStatus(
  status: string | null | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (!status) return t("profile.subscription.status.free");
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "trialing":
      return t("profile.subscription.status.trialing");
    case "active":
      return t("profile.subscription.status.active");
    case "past_due":
    case "unpaid":
      return t("profile.subscription.status.paymentIssue");
    case "canceled":
    case "incomplete_expired":
      return t("profile.subscription.status.canceledExpired");
    default:
      return normalized;
  }
}
