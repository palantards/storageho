import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { ImportCsvPanel } from "@/components/inventory/ImportCsvPanel";
import { PageFrame } from "@/components/inventory/PageFrame";
import { PageHeader } from "@/components/inventory/PageHeader";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  return (
    <PageFrame className="space-y-4">
      <PageHeader
        title="Import CSV"
        description="Upload containers, items, and placements from a CSV file."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
          </Button>
        }
      />
      <SectionDivider title="Import" />
      <ImportCsvPanel householdId={householdId} />
    </PageFrame>
  );
}
