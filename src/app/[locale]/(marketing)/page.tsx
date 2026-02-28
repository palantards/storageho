import type { Locale } from "@/i18n/config";
import { getSession } from "@/lib/auth";
import { LandingContent } from "@/components/marketing/LandingContent";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const session = await getSession();
  const { locale } = await params;

  return <LandingContent locale={locale} isAuthed={!!session} />;
}
