import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { t as tt } from "@/i18n/translate";
import { getSession } from "@/lib/auth";
import { getProfileBySupabaseId, updateProfile } from "@/lib/profile";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
function redirectWithStatus(
  loc: Locale,
  query: { saved?: string; error?: string },
) {
  const params = new URLSearchParams(query as Record<string, string>);
  return redirect(`/${loc}/profile/account?${params.toString()}`);
}
export default async function ProfileAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const { locale } = await params;
  const sp = (await searchParams) ?? {};
  const messages = await getMessages(locale);
  const t = (key: string, vars?: Record<string, string | number>) =>
    tt(messages, key, vars);

  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const profile = await getProfileBySupabaseId(session.user.id);
  const name = profile?.displayName || session.user.name || "";
  const company = session.user.company || "";
  const email = session.user.email;

  async function updateProfileAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    const company = String(formData.get("company") || "").trim();
    if (!name) {
      return redirectWithStatus(locale, { error: "name is required" });
    }
    if (!session?.user) {
      return redirectWithStatus(locale, { error: "session is invalid" });
    }
    await updateProfile({ supabaseUserId: session.user.id, name, company });
    return redirectWithStatus(locale, { saved: "1" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.account.cardTitle")}</CardTitle>
        <CardDescription>{t("profile.account.cardSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateProfileAction} className="grid gap-4">
          {sp.saved ? (
            <Alert>
              <AlertTitle>{t("profile.account.saveSuccessTitle")}</AlertTitle>
              <AlertDescription>
                {t("profile.account.saveSuccessDescription")}
              </AlertDescription>
            </Alert>
          ) : null}
          {sp.error ? (
            <Alert variant="destructive">
              <AlertTitle>{t("profile.account.saveErrorTitle")}</AlertTitle>
              <AlertDescription>
                {t("profile.account.saveErrorDescription")}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="name">{t("common.name")}</Label>
            <Input id="name" name="name" defaultValue={name} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input id="email" name="email" defaultValue={email} disabled />
            <p className="text-xs text-muted-foreground">
              {t("profile.account.emailHint")}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="company">{t("common.company")}</Label>
            <Input
              id="company"
              name="company"
              defaultValue={company}
              placeholder="Acme Inc."
            />
            <p className="text-xs text-muted-foreground">
              {t("common.optional")}
            </p>
          </div>

          <div className="flex items-center justify-end">
            <Button type="submit">{t("common.save")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
