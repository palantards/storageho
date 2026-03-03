import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { listFloors } from "@/lib/inventory/service";
import { SurfaceCard } from "@/components/inventory/SurfaceCard";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const selectedFloor = floors[0]?.location.id;

  return (
    <div className="space-y-4">
      <SurfaceCard variant="hero">
        <CardHeader>
          <CardTitle>Export CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/export" method="get" className="space-y-3">
            <input type="hidden" name="householdId" value={householdId} />

            <div className="grid gap-1 text-sm">
              <span>Floor scope (optional)</span>
              <Select name="floorId" defaultValue={selectedFloor ?? "all"}>
                <SelectTrigger>
                  <SelectValue placeholder="All floors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All floors</SelectItem>
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
      </SurfaceCard>
    </div>
  );
}
