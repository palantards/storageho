import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { localizedHref } from "@/i18n/routing";

export default async function ProfileIndex({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  redirect(localizedHref(locale, "/profile/account"));
}
