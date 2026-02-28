import Link from "next/link";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { t as tt } from "@/i18n/translate";
import { localizedHref } from "@/i18n/routing";
import { sendSupabasePasswordReset } from "@/lib/supabase";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function ForgotPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams?: Promise<{ sent?: string; error?: string }>;
}) {
  const { locale } = await params;
  const sp = (await searchParams) ?? {};

  const messages = await getMessages(locale);
  const t = (key: string, vars?: Record<string, string | number>) =>
    tt(messages, key, vars);

  async function sendLinkAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) redirect(localizedHref(locale, "/forgot-password"));

    const base =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";
    const redirectTo = `${base}/${locale}/reset-password`;

    try {
      await sendSupabasePasswordReset({ email, redirectTo });
      redirect(localizedHref(locale, "/forgot-password?sent=1"));
    } catch (error) {
      console.error("Failed to send password reset", error);
      redirect(localizedHref(locale, "/forgot-password?error=1"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.forgot.title")}</CardTitle>
        <CardDescription>{t("auth.forgot.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={sendLinkAction} className="grid gap-4">
          {sp.sent ? (
            <Alert>
              <AlertTitle>{t("auth.forgot.successTitle")}</AlertTitle>
              <AlertDescription>
                {t("auth.forgot.successDescription")}
              </AlertDescription>
            </Alert>
          ) : sp.error ? (
            <Alert variant="destructive">
              <AlertTitle>{t("auth.forgot.errorTitle")}</AlertTitle>
              <AlertDescription>
                {t("auth.forgot.errorDescription")}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </div>

          <Button type="submit" className="w-full">
            {t("auth.forgot.submit")}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <Link
              className="hover:text-foreground"
              href={localizedHref(locale, "/login")}
            >
              {t("auth.forgot.back")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
