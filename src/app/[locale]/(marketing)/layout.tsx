import type { Locale } from "@/i18n/config";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-dvh flex flex-col">
      <MarketingHeader locale={locale} />

      <main className="flex-1">{children}</main>

      <MarketingFooter locale={locale} />
    </div>
  );
}
