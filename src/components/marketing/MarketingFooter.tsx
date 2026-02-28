"use client";

import React from "react";
import type { Locale } from "@/i18n/config";
import { brand } from "@/config/brand";
import { localizedHref } from "@/i18n/routing";
import { useI18n } from "@/components/i18n/I18nProvider";
import Link from "next/link";
export function MarketingFooter({ locale }: { locale: Locale }) {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border/60 bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">
          (c) {new Date().getFullYear()} {brand.name}.{" "}
          {t("landing.footer.rights")}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            href={localizedHref(locale, brand.urls?.terms ?? "#")}
          >
            {t("landing.footer.terms")}
          </Link>
          <Link
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            href={localizedHref(locale, brand.urls?.privacy ?? "#")}
          >
            {t("landing.footer.privacy")}
          </Link>
          <Link
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            href={localizedHref(locale, brand.urls?.support ?? "#")}
          >
            {t("landing.footer.support")}
          </Link>
        </div>
      </div>
    </footer>
  );
}

