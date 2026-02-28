import type { Locale } from "@/i18n/config";
import { brand } from "@/config/brand";
import { localizedHref } from "@/i18n/routing";
import { getSession } from "@/lib/auth";
import { MarketingHeaderClient } from "@/components/marketing/MarketingHeaderClient";

export async function MarketingHeader({ locale }: { locale: Locale }) {
  const session = await getSession();
  const homeHref = session
    ? localizedHref(locale, brand.urls?.appHome ?? "/dashboard")
    : `/${locale}`;

  return (
    <MarketingHeaderClient locale={locale} homeHref={homeHref} isAuthed={!!session} />
  );
}
