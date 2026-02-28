import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { t as tt } from "@/i18n/translate";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = (key: string, vars?: Record<string, string | number>) =>
    tt(messages, key, vars);

  const labels = {
    title: t("auth.reset.title"),
    subtitle: t("auth.reset.subtitle"),
    passwordLabel: t("auth.reset.password"),
    confirmLabel: t("auth.reset.confirm"),
    submit: t("auth.reset.submit"),
    successTitle: t("auth.reset.successTitle"),
    successDescription: t("auth.reset.successDescription"),
    errorTitle: t("auth.reset.errorTitle"),
    errorDescription: t("auth.reset.errorDescription"),
    tokenErrorTitle: t("auth.reset.tokenErrorTitle"),
    tokenErrorDescription: t("auth.reset.tokenErrorDescription"),
  };

  return (
    <Card>
      <CardContent>
        <ResetPasswordForm labels={labels} />
      </CardContent>
    </Card>
  );
}
