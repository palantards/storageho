"use client";

import type { Locale } from "@/i18n/config";
import { localizedHref } from "@/i18n/routing";
import { brand } from "@/config/brand";
import { useI18n } from "@/components/i18n/I18nProvider";
import { CtaSection } from "./sections/CtaSection";
import { FeaturesSection } from "./sections/FeaturesSection";
import { HeroSection } from "./sections/HeroSection";
import { PricingSection } from "./sections/PricingSection";

export type Feature = { title: string; desc: string };

export function LandingContent({
  locale,
  isAuthed,
}: {
  locale: Locale;
  isAuthed: boolean;
}) {
  const { t, m } = useI18n();

  const features = (m<Feature[]>("features.items") ?? []) as Feature[];

  const primaryHref = isAuthed
    ? localizedHref(locale, brand.urls?.appHome ?? "/dashboard")
    : localizedHref(locale, "/register");

  return (
    <div>
      <HeroSection locale={locale} primaryHref={primaryHref} t={t} />
      <FeaturesSection features={features} t={t} />
      <PricingSection primaryHref={primaryHref} />
      <CtaSection primaryHref={primaryHref} t={t} />
    </div>
  );
}
