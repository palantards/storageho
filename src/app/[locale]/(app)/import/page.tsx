import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { ImportCsvPanel } from "@/components/inventory/ImportCsvPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Import CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportCsvPanel householdId={householdId} />
        </CardContent>
      </Card>
    </div>
  );
}