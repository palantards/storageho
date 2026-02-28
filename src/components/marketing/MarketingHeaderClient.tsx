"use client";

import Link from "next/link";

import type { Locale } from "@/i18n/config";
import { brand } from "@/config/brand";
import { localizedHref } from "@/i18n/routing";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { ProductName } from "@/components/brand/ProductName";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { useI18n } from "@/components/i18n/I18nProvider";

export function MarketingHeaderClient({
  locale,
  homeHref,
  isAuthed,
}: {
  locale: Locale;
  homeHref: string;
  isAuthed: boolean;
}) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href={homeHref} className="flex items-center gap-2">
          <Logo variant="icon" size={28} />
          <ProductName />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <MarketingNav locale={locale} />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthed ? (
            <Button asChild>
              <Link
                href={localizedHref(
                  locale,
                  brand.urls?.appHome ?? "/dashboard",
                )}
              >
                {t("common.goToApp")}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <Link href={localizedHref(locale, "/login")}>
                {t("common.signIn")}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
