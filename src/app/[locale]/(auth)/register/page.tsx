import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { t as tt } from "@/i18n/translate";
import { registerWithSupabase } from "@/lib/auth";
import { getOrCreateStripeCustomerId } from "@/lib/billing/customer";
import { localizedHref } from "@/i18n/routing";
import { ensureUserRecord } from "@/lib/user-sync";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = (key: string, vars?: Record<string, string | number>) =>
    tt(messages, key, vars);

  async function registerAction(
    prev: { errorKey?: string },
    formData: FormData,
  ) {
    "use server";
    const rawName = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    const company = String(formData.get("company") ?? "").trim();

    if (!email || !password) {
      return { errorKey: "required" };
    }

    // Create Supabase user
    const result = await registerWithSupabase({ email, password });
    if (!result.user) {
      return { errorKey: result.errorKey || "generic" };
    }

    // If Stripe is configured, create a Stripe customer and save the ID
    let stripeCustomerId = result.user.user_metadata?.stripe_customer_id as
      | string
      | undefined;
    try {
      if (stripeCustomerId) {
        await ensureUserRecord({
          id: result.user.id,
          email,
          stripeCustomerId,
        });
      } else if (process.env.STRIPE_SECRET_KEY) {
        stripeCustomerId = await getOrCreateStripeCustomerId({
          supabaseUserId: result.user.id,
          email,
          name: rawName || undefined,
          company: company || undefined,
        });
      } else {
        await ensureUserRecord({
          id: result.user.id,
          email,
        });
      }
    } catch (err) {
      console.error("Failed to save user record with Stripe ID", err);
    }

    // Redirect to dashboard after successful registration
    redirect(localizedHref(locale, "/dashboard"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.register.title")}</CardTitle>
        <CardDescription>{t("auth.register.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm
          action={registerAction}
          labels={{
            title: t("auth.register.title"),
            subtitle: t("auth.register.subtitle"),
            email: t("common.email"),
            password: t("common.password"),
            name: t("common.name"),
            company: t("common.company"),
            optional: t("common.optional"),
            submit: t("auth.register.submit"),
            switch: t("auth.register.switch"),
            switchHref: localizedHref(locale, "/login"),
            errors: {
              title: t("auth.register.errorTitle"),
              userExists: t("auth.register.errors.userExists"),
              weakPassword: t("auth.register.errors.weakPassword"),
              emailNotConfirmed: t("auth.register.errors.emailNotConfirmed"),
              required: t("auth.register.errors.required"),
              generic: t("auth.register.errors.generic"),
            },
          }}
        />
      </CardContent>
    </Card>
  );
}
