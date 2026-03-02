"use client";

import Link from "next/link";

import { brand } from "@/config/brand";
import type { Locale } from "@/i18n/config";
import { localizedHref } from "@/i18n/routing";
import { useI18n } from "@/components/i18n/I18nProvider";

export function MarketingNav({ locale }: { locale: Locale }) {
  const { t } = useI18n();

  return (
    <nav className="hidden items-center gap-6 md:flex">
      {brand.nav.marketing.map((item) => (
        <Link
          key={item.href}
          href={localizedHref(locale, item.href)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t(item.labelKey)}
        </Link>
      ))}
    </nav>
  );
}

