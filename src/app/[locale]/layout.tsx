import { notFound } from "next/navigation";

import { locales, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { I18nProvider } from "@/components/i18n/I18nProvider";

import { BrandStyles } from "@/components/brand/BrandStyles";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { PwaRegister } from "@/components/pwa/PwaRegister";

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as (typeof locales)[number])) notFound();
  const locale = raw as Locale;

  const messages = await getMessages(locale);

  return (
    <ThemeProvider>
      <I18nProvider locale={locale} messages={messages}>
        <BrandStyles />
        <PwaRegister />
        {children}
      </I18nProvider>
    </ThemeProvider>
  );
}
