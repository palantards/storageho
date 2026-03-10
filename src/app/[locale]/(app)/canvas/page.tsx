import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { getInventoryShellContext } from "@/lib/inventory/page-context";

export default async function CanvasIndexPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const context = await getInventoryShellContext(locale);
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return <div className="text-sm text-muted-foreground">No active household.</div>;
  }

  redirect(`/${locale}/households/${householdId}/canvas`);
}
