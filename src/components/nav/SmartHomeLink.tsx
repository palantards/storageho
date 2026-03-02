import Link from "next/link";

import { brand } from "@/config/brand";
import { localizedHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";
import { getSession } from "@/lib/auth";

export async function SmartHomeLink({
  locale,
  className,
  children,
}: {
  locale: Locale;
  className?: string;
  children: React.ReactNode;
}) {
  const session = await getSession();
  const href = session
    ? localizedHref(locale, brand.urls?.appHome ?? "/dashboard")
    : `/${locale}`;

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

