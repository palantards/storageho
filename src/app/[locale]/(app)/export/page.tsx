import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { listFloors } from "@/lib/inventory/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

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

            <div className="grid gap-1 text-sm">
              <span>Floor scope (optional)</span>
              <Select name="floorId" defaultValue="">
                <SelectTrigger>
                  <SelectValue placeholder="All floors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All floors</SelectItem>
                  {floors.map((entry) => (
                    <SelectItem key={entry.location.id} value={entry.location.id}>
                      {entry.location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit">Download CSV</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
