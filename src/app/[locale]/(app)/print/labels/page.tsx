import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { listAllContainersInFloor, listFloors } from "@/lib/inventory/service";
import { PrintButton } from "@/components/inventory/PrintButton";
import { QRCodeRenderer } from "@/components/inventory/QRCodeRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

export default async function PrintLabelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams?: Promise<{ floorId?: string }>;
}) {
  const { locale } = await params;
  const search = (await searchParams) || {};
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return <div className="text-sm text-muted-foreground">No active household.</div>;
  }

  const floors = await listFloors({
    userId: context.user.id,
    householdId,
  });

  const floorId = search.floorId || floors[0]?.location.id;

  if (!floorId) {
    return <div className="text-sm text-muted-foreground">No floors to print.</div>;
  }

  const containers = await listAllContainersInFloor({
    userId: context.user.id,
    householdId,
    locationId: floorId,
  });

  return (
    <div className="space-y-4 print:space-y-0">
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Print labels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <form method="get" className="flex items-center gap-2">
            <select
              name="floorId"
              defaultValue={floorId}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {floors.map((entry) => (
                <option key={entry.location.id} value={entry.location.id}>
                  {entry.location.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Load
            </Button>
            <PrintButton />
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 print:grid-cols-3 print:gap-2">
        {containers.map((entry) => {
          const url = `${APP_URL}/${locale}/boxes/${entry.container.id}`;
          return (
            <div
              key={entry.container.id}
              className="break-inside-avoid rounded border p-3 text-xs print:border-black"
            >
              <div className="mb-2 text-sm font-semibold">{entry.container.name}</div>
              <div className="mb-2 text-[11px] text-muted-foreground">
                {entry.location.name} / {entry.room.name}
              </div>
              <div className="mb-2 text-[11px]">Code: {entry.container.code || "-"}</div>
              <QRCodeRenderer value={url} size={112} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
