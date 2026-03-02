import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { t as tt } from "@/i18n/translate";
import { loginWithSupabase } from "@/lib/auth";
import { localizedHref } from "@/i18n/routing";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = (key: string, vars?: Record<string, string | number>) =>
    tt(messages, key, vars);

  async function loginAction(prev: { errorKey?: string }, formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    const rememberMe = String(formData.get("rememberMe") ?? "on") === "on";

    if (!email || !password) {
      return { errorKey: "required" };
    }

    const result = await loginWithSupabase({ email, password, rememberMe });
    if (!result.ok) {
      return { errorKey: result.errorKey || "generic" };
    }

    redirect(localizedHref(locale, "/dashboard"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.login.title")}</CardTitle>
        <CardDescription>{t("auth.login.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm
          action={loginAction}
          labels={{
            email: t("common.email"),
            password: t("common.password"),
            submit: t("auth.login.submit"),
            forgot: t("auth.login.forgot"),
            switch: t("auth.login.switch"),
            title: t("auth.login.title"),
            subtitle: t("auth.login.subtitle"),
            forgotHref: localizedHref(locale, "/forgot-password"),
            switchHref: localizedHref(locale, "/register"),
            remember: "Remember me",
            errors: {
              title: t("auth.login.errorTitle"),
              invalidCredentials: t("auth.login.errors.invalidCredentials"),
              emailNotConfirmed: t("auth.login.errors.emailNotConfirmed"),
              required: t("auth.login.errors.required"),
              generic: t("auth.login.errors.generic"),
            },
          }}
        />
      </CardContent>
    </Card>
  );
}
