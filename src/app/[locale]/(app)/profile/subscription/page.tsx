import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { t as tt } from "@/i18n/translate";
import { getSession } from "@/lib/auth";
import { getOrCreateStripeCustomerId } from "@/lib/billing/customer";
import { billingState, getSubscriptionFromDb } from "@/lib/billing-state";
import {
  createBillingPortalSession,
  createCheckoutSession,
} from "@/lib/stripe";
import {
  getPriceIdForPlan,
  planDefinitions,
  getPlanLabel,
  getPlanPrice,
} from "@/config/billing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { localizedHref } from "@/i18n/routing";
import { findDbUserBySupabaseId } from "@/lib/users";

const fallbackUrl =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

const checkoutPlanSchema = z.enum(["starter", "pro", "business"]);

export default async function ProfileSubscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const search = await searchParams;
  const messages = await getMessages(locale);
  const t = (key: string, vars?: Record<string, string | number>) =>
    tt(messages, key, vars);
  const session = await getSession();
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const checkoutStatus =
    typeof search?.checkout === "string" ? search.checkout : undefined;

  const appPath = localizedHref(locale, "/profile/subscription");

  const dbUser = session?.user.id
    ? await findDbUserBySupabaseId(session.user.id)
    : null;

  const customerId =
    stripeConfigured && session?.user.email
      ? await getOrCreateStripeCustomerId({
          supabaseUserId: session.user.id,
          email: session.user.email,
          name: session.user.name || undefined,
          company: session.user.company || undefined,
        })
      : dbUser?.stripeCustomerId || session?.user.stripeCustomerId || null;

  const billingUser =
    session?.user.id && (!dbUser || (customerId && !dbUser.stripeCustomerId))
      ? await findDbUserBySupabaseId(session.user.id)
      : dbUser;

  const subscription = billingUser?.id
    ? await getSubscriptionFromDb(billingUser.id)
    : null;

  async function checkoutAction(formData: FormData) {
    "use server";
    const plan = checkoutPlanSchema.parse(String(formData.get("plan") ?? ""));
    const userSession = await getSession();
    if (!userSession?.user.email) {
      redirect(localizedHref(locale, "/login"));
    }

    const stripeCustomerId = await getOrCreateStripeCustomerId({
      supabaseUserId: userSession.user.id,
      email: userSession.user.email,
      name: userSession.user.name || undefined,
      company: userSession.user.company || undefined,
    });

    const priceId = getPriceIdForPlan(plan);
    if (!priceId) {
      throw new Error(`No Stripe price configured for plan ${plan}`);
    }
    const successUrl = `${fallbackUrl}/${locale}/profile/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${fallbackUrl}/${locale}/profile/subscription?checkout=cancel`;
    const checkout = await createCheckoutSession({
      priceId,
      successUrl,
      cancelUrl,
      customerId: stripeCustomerId,
    });
    redirect(checkout.url);
  }

  async function portalAction() {
    "use server";
    const userSession = await getSession();
    if (!userSession?.user.email) {
      redirect(localizedHref(locale, "/login"));
    }

    const stripeCustomerId = await getOrCreateStripeCustomerId({
      supabaseUserId: userSession.user.id,
      email: userSession.user.email,
      name: userSession.user.name || undefined,
      company: userSession.user.company || undefined,
    });

    const portal = await createBillingPortalSession({
      customerId: stripeCustomerId,
      returnUrl: `${fallbackUrl}/${locale}/profile/subscription`,
    });

    redirect(portal.url);
  }

  async function refreshSubscriptionAction() {
    "use server";
    revalidatePath(appPath);
  }

  const state = billingUser?.id
    ? await billingState({
        userId: billingUser.id,
        stripeCustomerId: customerId,
        t,
      })
    : {
        planLabel: t("profile.subscription.freePlan"),
        statusLabel: t("profile.subscription.status.free"),
        renewalDate: t("profile.subscription.planHint"),
        subscriptionExists: false,
      };

  const showPendingSuccess = checkoutStatus === "success" && !subscription;
  const showConfirmedSuccess =
    checkoutStatus === "success" && Boolean(subscription);
  const showCancel = checkoutStatus === "cancel";

  const canManageBilling = stripeConfigured && Boolean(customerId);
  const canCheckout = stripeConfigured;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.subscription.cardTitle")}</CardTitle>
        <CardDescription>
          {t("profile.subscription.cardSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {showPendingSuccess && (
            <Alert>
              <AlertTitle>
                {t("profile.subscription.checkoutSuccessPendingTitle")}
              </AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>
                  {t("profile.subscription.checkoutSuccessPendingDescription")}
                </span>
                <form action={refreshSubscriptionAction}>
                  <Button type="submit" size="sm" variant="outline">
                    {t("profile.subscription.refreshStatusCta")}
                  </Button>
                </form>
              </AlertDescription>
            </Alert>
          )}

          {showConfirmedSuccess && (
            <Alert>
              <AlertTitle>
                {t("profile.subscription.checkoutSuccessTitle")}
              </AlertTitle>
              <AlertDescription>
                {t("profile.subscription.checkoutSuccessDescription", {
                  status: state.statusLabel,
                })}
              </AlertDescription>
            </Alert>
          )}

          {showCancel && (
            <Alert variant="destructive">
              <AlertTitle>
                {t("profile.subscription.checkoutCancelTitle")}
              </AlertTitle>
              <AlertDescription>
                {t("profile.subscription.checkoutCancelDescription")}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2 rounded-[var(--radius-md)] border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{state.planLabel}</div>
                <div className="text-xs text-muted-foreground">
                  {t("profile.subscription.planHint")}
                </div>
              </div>
              <Badge variant="default">{state.statusLabel}</Badge>
            </div>

            <div className="grid gap-2 pt-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("profile.subscription.renewalLabel")}
                </span>
                <span>{state.renewalDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("profile.subscription.statusLabel")}
                </span>
                <span>{state.statusLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <form action={portalAction}>
              <Button
                type="submit"
                variant="secondary"
                disabled={!canManageBilling}
              >
                {t("profile.subscription.manage")}
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              {planDefinitions.map((plan) => {
                const priceId = getPriceIdForPlan(plan.id);
                const missingPrice = !priceId;
                return (
                  <form
                    action={checkoutAction}
                    key={plan.id}
                    title={missingPrice ? t("pricing.missingPrice") : undefined}
                  >
                    <input type="hidden" name="plan" value={plan.id} />
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={!priceId || !canCheckout}
                    >
                      {t("pricing.cta")}: {getPlanLabel(plan, t)} ·{" "}
                      {getPlanPrice(plan, t)}
                    </Button>
                  </form>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
