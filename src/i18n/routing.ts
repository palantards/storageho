import type { Locale } from "@/i18n/config";

export function localizedHref(locale: Locale, href: string): string {
  // Anchors should target the landing page for that locale
  if (href.startsWith("#")) return `/${locale}${href}`;
  if (href.startsWith("/")) return `/${locale}${href}`;
  return href;
}
