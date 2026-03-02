import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { listFloors } from "@/lib/inventory/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return <div className="text-sm text-muted-foreground">No active household.</div>;
  }

  const floors = await listFloors({
    userId: context.user.id,
    householdId,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Export CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/export" method="get" className="space-y-3">
            <input type="hidden" name="householdId" value={householdId} />

            <label className="grid gap-1 text-sm">
              Floor scope (optional)
              <select
                name="floorId"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">All floors</option>
                {floors.map((entry) => (
                  <option key={entry.location.id} value={entry.location.id}>
                    {entry.location.name}
                  </option>
                ))}
              </select>
            </label>

            <Button type="submit">Download CSV</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
