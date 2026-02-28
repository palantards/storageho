import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { brand } from "@/config/brand";
import { getSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SmartHomeLink } from "@/components/nav/SmartHomeLink";
import { Logo } from "@/components/brand/Logo";
import { ProductName } from "@/components/brand/ProductName";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (session) redirect(`/${locale}${brand.urls?.appHome ?? "/dashboard"}`);

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <SmartHomeLink locale={locale} className="flex items-center gap-2">
          <Logo variant="icon" size={28} />
          <ProductName />
        </SmartHomeLink>
        <ThemeToggle />
      </div>

      <div className="mx-auto grid max-w-6xl place-items-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
