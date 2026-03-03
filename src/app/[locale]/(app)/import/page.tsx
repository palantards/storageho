import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { ImportCsvPanel } from "@/components/inventory/ImportCsvPanel";
import { PageFrame } from "@/components/inventory/PageFrame";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Import CSV</div>
          <div className="text-sm text-muted-foreground">
            Upload containers, items, and placements from a CSV file.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
          </Button>
        </div>
      </div>
      <SectionDivider title="Import" />
      <ImportCsvPanel householdId={householdId} />
    </PageFrame>
  );
}
