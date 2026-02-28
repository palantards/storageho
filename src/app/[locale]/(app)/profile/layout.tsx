import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { t as tt } from "@/i18n/translate";
import { localizedHref } from "@/i18n/routing";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = (key: string, vars?: Record<string, string | number>) =>
    tt(messages, key, vars);

  const tabs = [
    { href: "/profile/account", label: t("profile.tabs.account") },
    { href: "/profile/subscription", label: t("profile.tabs.subscription") },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t("profile.header.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("profile.header.subtitle")}
        </p>
      </div>

      <Card className="p-2">
        <nav className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={localizedHref(locale, tab.href)}
              className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </Card>

      <div>{children}</div>
    </div>
  );
}
